/** Disposable database checks; --fixtures keeps only the rows needed by UI QA. */
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(join(process.cwd(), "apps/admin"));
  const { db, dbBase } = await import("@nassican/db");
  const {
    getPricingCalculator,
    savePricingClient,
    savePricingService,
    savePricingQuote,
    listPricingQuotes,
    savePricingFinancial,
    pricingSnapshot,
    saveMarketQuote,
    getMarketQuotes,
    saveRegionFactor,
    saveIncomeEstimate,
    getPricingGeography,
    setPricingQuoteStatus,
    pricingToday,
  } = await import("../apps/admin/src/lib/pricing");
  const { emptyPricingClient, emptyPricingService, emptyPricingQuote } =
    await import("../apps/admin/src/lib/pricing-draft");
  const directory = join(tmpdir(), "nassican-pricing-qa");
  const manifest = join(directory, "fixtures.json");
  await mkdir(directory, { recursive: true });
  if (process.argv.includes("--prepare-ui")) {
    const ids: {
      clientId: string;
      serviceId: string;
      quoteId: string;
      sessionId: string;
      marker: string;
    } = JSON.parse(await readFile(manifest, "utf8"));
    assert.ok(ids.marker.startsWith("__pricing_qa_"));
    assert.equal(
      (
        await db.pricingService.findUniqueOrThrow({
          where: { id: ids.serviceId },
        })
      ).name,
      ids.marker,
    );
    const { calendarDate } = await import("@nassican/shared");
    const { getTimezone } = await import("../apps/admin/src/lib/site-config");
    const { addDays } = await import("../apps/admin/src/lib/journal-draft");
    const today = calendarDate(await getTimezone());
    assert.equal(
      (await db.pricingQuote.findUniqueOrThrow({ where: { id: ids.quoteId } }))
        .projectId,
      null,
    );
    await db.pricingQuote.update({
      where: { id: ids.quoteId },
      data: {
        title: `${ids.marker} recordatorio`,
        status: "sent",
        sentAt: new Date(Date.now() - 8 * 86400000),
        validUntil: addDays(today, 3),
      },
    });
    await db.marketQuote.deleteMany({
      where: {
        serviceId: ids.serviceId,
        description: `${ids.marker} observed`,
      },
    });
    await db.marketQuote.createMany({
      data: Array.from({ length: 6 }, (_, index) => ({
        serviceId: ids.serviceId,
        scope: "standard" as const,
        description: `${ids.marker} observed`,
        price: index < 3 ? 2000000 : 1000000,
        unit: "project" as const,
        currency: "COP" as const,
        provider: ids.marker,
        country: index < 3 ? ids.marker : `${ids.marker} referencia`,
        mode: "remote" as const,
        date: today,
        source: "received" as const,
        origin: "observed" as const,
      })),
    });
    await dbBase.session.update({
      where: { id: ids.sessionId },
      data: { expiresAt: new Date(Date.now() + 3600000) },
    });
    console.log(
      "UI fixtures prepared: an 8-day follow-up, a three-day expiry and six observed regional samples.",
    );
    await dbBase.$disconnect();
    return;
  }
  if (process.argv.includes("--renew")) {
    const ids: { sessionId: string } = JSON.parse(
      await readFile(manifest, "utf8"),
    );
    await dbBase.session.update({
      where: { id: ids.sessionId },
      data: { expiresAt: new Date(Date.now() + 3600000) },
    });
    console.log("Temporary local QA session renewed for one hour.");
    await dbBase.$disconnect();
    return;
  }
  if (process.argv.includes("--inspect")) {
    const ids: { clientId: string } = JSON.parse(
      await readFile(manifest, "utf8"),
    );
    const view = await getPricingCalculator();
    console.log({
      periods: view.financials
        .filter((r) => r.clientId === ids.clientId)
        .map((r) => ({
          id: r.id,
          start: r.start,
          end: r.end,
          format: r.format,
        })),
    });
    await dbBase.$disconnect();
    return;
  }
  if (process.argv.includes("--cleanup")) {
    const ids: {
      clientId: string;
      serviceId: string;
      sessionId: string;
      marker: string;
    } = JSON.parse(await readFile(manifest, "utf8"));
    assert.ok(ids.marker.startsWith("__pricing_qa_"));
    assert.equal(
      (
        await db.pricingService.findUniqueOrThrow({
          where: { id: ids.serviceId },
        })
      ).name,
      ids.marker,
    );
    const quoteIds = (
      await db.pricingQuote.findMany({
        where: { serviceId: ids.serviceId },
        select: { id: true },
      })
    ).map((r) => r.id);
    const [financials, market, factors, incomes, projects, signals] =
      await Promise.all([
        db.pricingClientFinancial.findMany({
          where: { clientId: ids.clientId },
          select: { id: true },
        }),
        db.marketQuote.findMany({
          where: { serviceId: ids.serviceId },
          select: { id: true },
        }),
        db.pricingRegionFactor.findMany({
          where: { region: { country: ids.marker } },
          select: { id: true },
        }),
        db.pricingIncomeEstimate.findMany({
          where: { region: { country: ids.marker } },
          select: { id: true },
        }),
        db.clientProject.findMany({
          where: { clientId: ids.clientId },
          select: { id: true },
        }),
        db.pricingClientSignal.findMany({
          where: { clientId: ids.clientId },
          select: { id: true },
        }),
      ]);
    const disposableIds = [
      ...quoteIds,
      ids.clientId,
      ids.serviceId,
      ...[financials, market, factors, incomes, projects, signals]
        .flat()
        .map((r) => r.id),
    ];
    await db.pricingQuote.deleteMany({ where: { serviceId: ids.serviceId } });
    await db.marketQuote.deleteMany({ where: { serviceId: ids.serviceId } });
    await db.clientProject.deleteMany({
      where: { id: { in: projects.map((r) => r.id) } },
    });
    await db.pricingClient.deleteMany({ where: { id: ids.clientId } });
    await db.pricingService.deleteMany({ where: { id: ids.serviceId } });
    await db.pricingRegion.deleteMany({ where: { country: ids.marker } });
    await dbBase.session.deleteMany({ where: { id: ids.sessionId } });
    await dbBase.auditLog.deleteMany({
      where: { entityId: { in: disposableIds } },
    });
    await dbBase.trashItem.deleteMany({
      where: {
        OR: [
          { entityId: { in: disposableIds } },
          { label: { startsWith: ids.marker } },
        ],
      },
    });
    const remaining = await Promise.all([
      db.pricingClient.count({ where: { id: ids.clientId } }),
      db.pricingService.count({ where: { id: ids.serviceId } }),
      db.pricingQuote.count({ where: { serviceId: ids.serviceId } }),
      db.marketQuote.count({ where: { serviceId: ids.serviceId } }),
      db.pricingClientFinancial.count({ where: { clientId: ids.clientId } }),
      db.pricingClientSignal.count({ where: { clientId: ids.clientId } }),
      db.clientProject.count({
        where: { id: { in: projects.map((r) => r.id) } },
      }),
      db.pricingRegion.count({ where: { country: ids.marker } }),
      dbBase.session.count({ where: { id: ids.sessionId } }),
      dbBase.auditLog.count({ where: { entityId: { in: disposableIds } } }),
      dbBase.trashItem.count({ where: { label: { startsWith: ids.marker } } }),
    ]);
    assert.ok(
      remaining.every((count) => count === 0),
      "Disposable UI records remain",
    );
    await rm(manifest);
    console.log(
      "UI fixtures, their audit/trash records and temporary session removed; zero remaining records verified.",
    );
    await dbBase.$disconnect();
    return;
  }
  const marker = `__pricing_qa_${randomUUID()}`;
  const client = await savePricingClient({
    ...emptyPricingClient(),
    name: marker,
    monthlyIncome: "5.000.000",
    stratum: "0",
  });
  const service = await savePricingService({
    ...emptyPricingService(),
    name: marker,
    minimum: "500.000",
  });
  const fixtures = process.argv.includes("--fixtures");
  try {
    const quote = await savePricingQuote({
      ...emptyPricingQuote(),
      clientId: client.id,
      serviceId: service.id,
      title: marker,
      hours: "20",
      directCosts: "34.225",
      final: "2.000.000",
    });
    assert.equal(Number(quote.final), 2000000);
    assert.equal(quote.snapshot.inputs.directCosts, 34225);
    assert.equal(quote.snapshot.client.stratum, 0);
    assert.equal(quote.snapshot.parameters.billableHours > 0, true);
    if (process.argv.includes("--family")) {
      const familyQuote = await savePricingQuote({
        ...emptyPricingQuote(),
        clientId: client.id,
        serviceId: service.id,
        title: `${marker} familiar`,
        family: true,
        hours: "20",
        directCosts: "34.225",
      });
      const stored = await db.pricingQuote.findUniqueOrThrow({
        where: { id: familyQuote.id },
      });
      assert.equal(stored.snapshot.inputs.family, true);
      assert.equal(
        stored.snapshot.result.family?.percent,
        stored.snapshot.parameters.familyDiscount,
      );
      assert.equal(Number(stored.final), stored.snapshot.result.suggested);
      assert.ok(Number(stored.final) >= stored.snapshot.result.floor);
      assert.ok(stored.snapshot.result.family!.normal >= Number(stored.final));
      console.log(
        "Family pricing persisted with its percentage, effective discount and protected floor.",
      );
    }
    assert.ok(
      (await listPricingQuotes()).some(
        (r) => r.id === quote.id && r.snapshot.result.explanation.length > 0,
      ),
    );
    await db.pricingService.update({
      where: { id: service.id },
      data: { minimum: 9000000 },
    });
    assert.equal(
      (await db.pricingQuote.findUniqueOrThrow({ where: { id: quote.id } }))
        .snapshot.inputs.minimum,
      500000,
    );
    await db.pricingService.update({
      where: { id: service.id },
      data: { minimum: 500000 },
    });
    const view = await getPricingCalculator();
    assert.ok(view.clients.some((r) => r.id === client.id));
    assert.ok(view.services.some((r) => r.id === service.id));
    assert.equal(view.tiers.length >= 3, true);
    console.log(
      "Database checks passed: client, service, es-CO money, immutable snapshot, list and seeded settings/tiers.",
    );
    if (process.argv.includes("--phase2")) {
      const { emptyFinancial, readFinancial } =
        await import("../apps/admin/src/lib/pricing-financial");
      const financialDraft = {
        ...emptyFinancial(client.id),
        start: "2025",
        end: "2025",
        annual: false,
        revenue41: "1.500.000.000",
        expense51: "0",
        expense52: "0",
        cost61: "1.455.000.000",
        assets: "1.000.000.000",
        liabilities: "500.000.000",
      };
      const period = await savePricingFinancial(
        financialDraft,
        readFinancial(financialDraft),
      );
      await db.pricingClient.update({
        where: { id: client.id },
        data: { type: "company" },
      });
      const snap = await pricingSnapshot({
        ...emptyPricingQuote(),
        clientId: client.id,
        serviceId: service.id,
        financialId: period.id,
        title: marker,
      });
      assert.equal(snap.inputs.capacity, 9000000);
      assert.ok(snap.notes.some((n) => n.includes("tope por utilidad")));
      const saved = await savePricingQuote({
        ...emptyPricingQuote(),
        clientId: client.id,
        serviceId: service.id,
        financialId: period.id,
        title: marker,
      });
      await db.pricingClientFinancial.update({
        where: { id: period.id },
        data: { cost61: 0 },
      });
      assert.equal(
        (await db.pricingQuote.findUniqueOrThrow({ where: { id: saved.id } }))
          .snapshot.financial?.cost61,
        1455000000,
      );
      console.log(
        "Company database checks passed: period, 1% bracket, profit cap and frozen financial evidence.",
      );
    }
    if (process.argv.includes("--phase3")) {
      const { emptyMarketQuote } =
        await import("../apps/admin/src/lib/pricing-market");
      const base = {
        ...emptyMarketQuote(),
        serviceId: service.id,
        provider: marker,
        description: marker,
        date: "2026-10",
      };
      await saveMarketQuote({ ...base, price: "1.000.000" });
      await saveMarketQuote({ ...base, price: "2.000.000" });
      await saveMarketQuote({ ...base, price: "500", currency: "EUR" });
      await saveMarketQuote({
        ...base,
        price: "999.000.000",
        scope: "advanced",
      });
      const snap = await pricingSnapshot({
        ...emptyPricingQuote(),
        clientId: client.id,
        serviceId: service.id,
        title: marker,
      });
      assert.equal(snap.inputs.market, 1500000);
      assert.equal(snap.marketEvidence.length, 2);
      assert.ok(snap.notes.some((n) => n.includes("EUR")));
      await db.pricingQuote.update({
        where: { id: quote.id },
        data: { status: "accepted" },
      });
      assert.ok(
        (await getMarketQuotes()).some(
          (q) => q.id === `own:${quote.id}` && q.source === "own",
        ),
      );
      console.log(
        "Market database checks passed: comparables, currency exclusion, adjusted evidence and accepted own references.",
      );
    }
    if (process.argv.includes("--phase4")) {
      const {
        emptyRegionFactor,
        emptyIncomeEstimate,
        observedRegionalFactor,
        resolveRegionFactor,
      } = await import("../apps/admin/src/lib/pricing-geography");
      const { emptyMarketQuote } =
        await import("../apps/admin/src/lib/pricing-market");
      const country = {
        ...emptyRegionFactor(),
        country: marker,
        serviceId: service.id,
        date: "2026-10-27",
        justification: marker,
      };
      await saveRegionFactor({ ...country, factor: "1,1" });
      await saveRegionFactor({
        ...country,
        department: "Departamento",
        factor: "1,2",
      });
      const cityFactor = await saveRegionFactor({
        ...country,
        department: "Departamento",
        municipality: "Ciudad",
        factor: "1,5",
      });
      await saveIncomeEstimate({
        ...emptyIncomeEstimate(),
        country: marker,
        stratum: "0",
        income: "1.000.000",
        date: "2026-10-27",
        justification: marker,
      });
      await db.pricingClient.update({
        where: { id: client.id },
        data: {
          country: marker,
          department: "Departamento",
          municipality: "Ciudad",
          monthlyIncome: null,
          incomeOrigin: "missing",
        },
      });
      const snap = await pricingSnapshot({
        ...emptyPricingQuote(),
        clientId: client.id,
        serviceId: service.id,
        title: marker,
      });
      assert.equal(snap.geography.factor, 1.5);
      assert.equal(snap.geography.level, "municipio");
      assert.equal(snap.inputs.incomeOrigin, "estimated");
      assert.equal(snap.inputs.monthlyIncome, 1363636.36);
      const geo = await getPricingGeography();
      assert.ok(geo.places.some((r) => r.code === "05001"));
      assert.equal(
        resolveRegionFactor(geo.factors)(
          { country: marker, department: "Departamento", municipality: "Otra" },
          service.id,
          "remote",
        ).factor,
        1.2,
      );
      for (let index = 0; index < 6; index++)
        await saveMarketQuote({
          ...emptyMarketQuote(),
          serviceId: service.id,
          country: marker,
          department: "Departamento",
          municipality: index < 3 ? "Ciudad" : "Referencia",
          provider: marker,
          description: marker,
          price: index < 3 ? "200.000" : "100.000",
          date: "2026-10-27",
        });
      const observed = observedRegionalFactor(
        await getMarketQuotes(),
        { country: marker, department: "Departamento", municipality: "Ciudad" },
        {
          country: marker,
          department: "Departamento",
          municipality: "Referencia",
        },
        {
          serviceId: service.id,
          scope: "standard",
          unit: "project",
          mode: "remote",
        },
        null,
      );
      assert.equal(observed.factor, 2);
      await assert.rejects(
        db.pricingRegionFactor.update({
          where: { id: cityFactor.id },
          data: { factor: 1.7, justification: "" },
        }),
      );
      console.log(
        "Geography database checks passed: cascade, explicit estimated income, DIVIPOLA, observed samples and database justification constraint.",
      );
    }
    if (process.argv.includes("--phase5")) {
      const { emptyFinancial, readFinancial } =
        await import("../apps/admin/src/lib/pricing-financial");
      const { emptyMarketQuote } =
        await import("../apps/admin/src/lib/pricing-market");
      const { moveToTrash, restoreFromTrash } =
        await import("../apps/admin/src/lib/trash");
      const { logAudit } = await import("../apps/admin/src/lib/audit");
      const { readActivity } = await import("../apps/admin/src/lib/journal");
      const { listCommands } = await import("../apps/admin/src/lib/commands");
      const { calendarDate } = await import("@nassican/shared");
      const { getTimezone } = await import("../apps/admin/src/lib/site-config");
      const { addDays } = await import("../apps/admin/src/lib/journal-draft");
      const timezone = await getTimezone();
      const today = calendarDate(timezone);
      const email = (process.env.ADMIN_ALLOWED_EMAILS ?? "")
        .split(",")[0]
        ?.trim()
        .toLowerCase();
      const user = await dbBase.user.findUniqueOrThrow({ where: { email } });
      await setPricingQuoteStatus(quote.id, "sent");
      await db.pricingQuote.update({
        where: { id: quote.id },
        data: {
          sentAt: new Date(Date.now() - 8 * 86400000),
          validUntil: addDays(today, 3),
        },
      });
      const reminders = await pricingToday(today, timezone);
      assert.ok(reminders.followUps.some((r) => r.id === quote.id));
      assert.ok(reminders.expiring.some((r) => r.id === quote.id));
      assert.ok(
        (await listCommands()).some((r) => r.id === `pricing:${quote.id}`),
      );
      const accepted = await Promise.all([
        setPricingQuoteStatus(quote.id, "accepted"),
        setPricingQuoteStatus(quote.id, "accepted"),
      ]);
      assert.ok(accepted.every((r) => r.ok));
      assert.equal(accepted.filter((r) => r.ok && r.projectCreated).length, 1);
      const acceptedQuote = await db.pricingQuote.findUniqueOrThrow({
        where: { id: quote.id },
      });
      assert.ok(acceptedQuote.projectId);
      const project = await db.clientProject.findUniqueOrThrow({
        where: { id: acceptedQuote.projectId },
      });
      assert.equal(Number(project.amount), 2000000);
      assert.equal(project.currency, "COP");
      assert.equal(project.clientId, client.id);
      assert.equal(
        (await setPricingQuoteStatus(quote.id, "rejected")).ok,
        false,
      );
      const usd = await db.pricingQuote.create({
        data: {
          title: `${marker} USD`,
          clientId: client.id,
          serviceId: service.id,
          snapshot: (await import("@nassican/db")).prismaJson.pricing(
            quote.snapshot,
          ),
          suggested: "1234.56",
          final: "1234.56",
          currency: "USD",
          unit: "project",
        },
      });
      const usdOutcome = await setPricingQuoteStatus(usd.id, "accepted");
      assert.ok(usdOutcome.ok && usdOutcome.row.projectId);
      if (!usdOutcome.ok || !usdOutcome.row.projectId)
        throw new Error("USD acceptance missing project");
      const usdProject = await db.clientProject.findUniqueOrThrow({
        where: { id: usdOutcome.row.projectId },
      });
      assert.equal(usdProject.currency, "USD");
      assert.equal(usdProject.amount?.toString(), "1234.56");
      await logAudit({
        userId: user.id,
        action: "create",
        entityType: "pricing_quote",
        entityId: quote.id,
        diff: {
          title: marker,
          client: marker,
          amount: "2000000",
          currency: "COP",
        },
      });
      await logAudit({
        userId: user.id,
        action: "update",
        entityType: "pricing_quote",
        entityId: quote.id,
        diff: {
          title: marker,
          client: marker,
          status: "accepted",
          amount: "2000000",
          currency: "COP",
        },
      });
      const activity = await readActivity(today, addDays(today, 1), timezone);
      assert.ok(
        activity.some(
          (r) =>
            r.item.text.includes(marker) &&
            r.item.text.startsWith("Cotizaste") &&
            !r.item.highlight,
        ),
      );
      assert.ok(
        activity.some(
          (r) =>
            r.item.text.includes(marker) &&
            r.item.tally === "quote-accepted" &&
            r.item.highlight,
        ),
      );
      const periodDraft = {
        ...emptyFinancial(client.id),
        start: "2025",
        end: "2025",
        revenue41: "60.000.000",
        expense51: "0",
        expense52: "0",
        cost61: "10.000.000",
      };
      await savePricingFinancial(periodDraft, readFinancial(periodDraft));
      await db.pricingClientSignal.create({
        data: { clientId: client.id, network: "instagram", followers: 1000 },
      });
      await moveToTrash("pricing_client", client.id, user.id);
      assert.equal(
        await db.pricingClient.count({ where: { id: client.id } }),
        0,
      );
      assert.equal(
        (await db.pricingQuote.findUniqueOrThrow({ where: { id: quote.id } }))
          .clientId,
        null,
      );
      assert.equal(
        (
          await db.clientProject.findUniqueOrThrow({
            where: { id: project.id },
          })
        ).clientId,
        null,
      );
      const clientTrash = await db.trashItem.findFirstOrThrow({
        where: { kind: "pricing_client", entityId: client.id },
      });
      assert.equal(clientTrash.label, marker);
      assert.ok(
        clientTrash.payload.parts.some(
          (p) => p.model === "PricingClientFinancial",
        ),
      );
      assert.ok(
        clientTrash.payload.parts.some(
          (p) => p.model === "PricingClientSignal",
        ),
      );
      assert.ok((await restoreFromTrash(clientTrash.id)).ok);
      assert.equal(
        await db.pricingClientSignal.count({ where: { clientId: client.id } }),
        1,
      );
      assert.equal(
        (
          await db.clientProject.findUniqueOrThrow({
            where: { id: project.id },
          })
        ).clientId,
        client.id,
      );
      assert.equal(
        (await db.pricingQuote.findUniqueOrThrow({ where: { id: quote.id } }))
          .clientId,
        client.id,
      );
      await moveToTrash("pricing_quote", quote.id, user.id);
      assert.equal(
        await db.clientProject.count({ where: { id: project.id } }),
        1,
      );
      const quoteTrash = await db.trashItem.findFirstOrThrow({
        where: { kind: "pricing_quote", entityId: quote.id },
      });
      assert.ok((await restoreFromTrash(quoteTrash.id)).ok);
      assert.equal(
        (await db.pricingQuote.findUniqueOrThrow({ where: { id: quote.id } }))
          .snapshot.inputs.directCosts,
        34225,
      );
      const market = await saveMarketQuote({
        ...emptyMarketQuote(),
        serviceId: service.id,
        provider: marker,
        description: marker,
        price: "100.000",
        date: today,
      });
      await moveToTrash("market_quote", market.id, user.id);
      const marketTrash = await db.trashItem.findFirstOrThrow({
        where: { kind: "market_quote", entityId: market.id },
      });
      assert.equal(marketTrash.label, marker);
      assert.ok((await restoreFromTrash(marketTrash.id)).ok);
      assert.equal(
        Number(
          (await db.marketQuote.findUniqueOrThrow({ where: { id: market.id } }))
            .price,
        ),
        100000,
      );
      console.log(
        "Integration database checks passed: concurrent acceptance creates one work item, COP/USD amounts, Today, commands, journal and trash round trips with client children and backlinks.",
      );
    }
    if (fixtures) {
      const email = (process.env.ADMIN_ALLOWED_EMAILS ?? "")
        .split(",")[0]
        ?.trim()
        .toLowerCase();
      const user = await dbBase.user.findUniqueOrThrow({ where: { email } });
      const secret = process.env.BETTER_AUTH_SECRET;
      assert.ok(secret);
      const token = randomUUID();
      const session = await dbBase.session.create({
        data: {
          token,
          userId: user.id,
          expiresAt: new Date(Date.now() + 3600000),
          userAgent: "Pricing local QA",
        },
      });
      const signature = createHmac("sha256", secret)
        .update(token)
        .digest("base64");
      await writeFile(
        manifest,
        JSON.stringify({
          clientId: client.id,
          serviceId: service.id,
          quoteId: quote.id,
          sessionId: session.id,
          marker,
          cookie: {
            name: "better-auth.session_token",
            value: `${token}.${signature}`,
            domain: "localhost",
            path: "/",
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
          },
        }),
      );
      console.log(
        "Disposable UI fixtures and a one-hour local session are ready; credentials were not printed.",
      );
    }
  } finally {
    if (!fixtures) {
      const disposable = await db.pricingQuote.findMany({
        where: { serviceId: service.id },
        select: { id: true },
      });
      await dbBase.auditLog.deleteMany({
        where: { entityId: { in: disposable.map((r) => r.id) } },
      });
      await db.pricingQuote.deleteMany({ where: { serviceId: service.id } });
      await db.marketQuote.deleteMany({ where: { serviceId: service.id } });
      await db.clientProject.deleteMany({
        where: { title: { startsWith: marker } },
      });
      await db.pricingClient.deleteMany({ where: { id: client.id } });
      await db.pricingService.deleteMany({ where: { id: service.id } });
      await db.pricingRegion.deleteMany({ where: { country: marker } });
      await dbBase.trashItem.deleteMany({
        where: { label: { startsWith: marker } },
      });
    }
    await dbBase.$disconnect();
  }
}
main().catch(() => {
  console.error(
    "Pricing database verification failed. No environment values were printed.",
  );
  process.exitCode = 1;
});
