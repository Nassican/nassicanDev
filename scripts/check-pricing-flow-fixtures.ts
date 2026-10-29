/** Creates only synthetic workflow-study records in the disposable loopback database. */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(join(process.cwd(), "apps/admin"));
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55432");
  assert.equal(url.username, "pricing_qa");
  const { dbBase: db, prismaJson } = await import("@nassican/db");
  const { getBillingView, saveBillingPlan, recordFlexibleReceipt } =
    await import("../apps/admin/src/lib/billing");
  const { emptyBillingIssuer, emptyBillingParty } =
    await import("../apps/admin/src/lib/billing-values");
  const { emptyPricingQuote } = await import("../apps/admin/src/lib/pricing-draft");
  const { savePricingQuote } = await import("../apps/admin/src/lib/pricing");
  const directory = join(tmpdir(), "nassican-pricing-qa");
  const fixture = JSON.parse(await readFile(join(directory, "fixtures.json"), "utf8"));
  assert.equal(
    (await db.pricingService.findUniqueOrThrow({ where: { id: fixture.serviceId } })).name,
    fixture.marker,
  );
  try {
    if (process.argv.includes("--reset-acceptance")) {
      const saved = JSON.parse(await readFile(join(directory, "flow-fixtures.json"), "utf8"));
      const quote = await db.pricingQuote.findUniqueOrThrow({ where: { id: saved.quoteId } });
      assert.equal(quote.clientId, fixture.clientId);
      const plan = await db.billingPlan.findUniqueOrThrow({ where: { quoteId: quote.id } });
      const details = (await getBillingView({ quoteId: quote.id })).plan!.details;
      const payments = details.flexiblePayments?.receipts ?? [];
      assert.ok(
        payments.length <= 1 &&
          payments.every(
            (payment) =>
              payment.concept === "Avance tras aceptación explícita" &&
              payment.amount === "100000.00",
          ),
      );
      assert.equal(await db.billingCharge.count({ where: { planId: plan.id } }), 0);
      if (quote.projectId) {
        assert.equal(
          (await db.clientProject.findUniqueOrThrow({ where: { id: quote.projectId } })).clientId,
          fixture.clientId,
        );
        await db.$transaction([
          db.billingPlan.update({
            where: { id: plan.id },
            data: {
              projectId: null,
              details: prismaJson.billing({
                ...details,
                flexiblePayments: { receipts: [], expected: [] },
              }),
              revision: { increment: 1 },
            },
          }),
          db.pricingQuote.update({
            where: { id: quote.id },
            data: { status: "draft", projectId: null },
          }),
          db.clientProject.delete({ where: { id: quote.projectId } }),
        ]);
      }
      console.log(
        "Only the guarded synthetic acceptance case was reset; baseline project and snapshot preserved.",
      );
      return;
    }
    if (process.argv.includes("--prepare-checks")) {
      const file = join(directory, "flow-fixtures.json");
      const saved = JSON.parse(await readFile(file, "utf8"));
      const quote = await db.pricingQuote.findUniqueOrThrow({ where: { id: saved.quoteId } });
      assert.equal(quote.status, "draft");
      const fresh = await db.clientProject.create({
        data: {
          title: `${fixture.marker} trabajo sin plan`,
          company: fixture.marker,
          clientId: fixture.clientId,
          amount: 1000000,
          currency: "COP",
        },
      });
      await writeFile(
        file,
        JSON.stringify({
          ...saved,
          freshProjectId: fresh.id,
          quoteSnapshotHash: createHash("sha256")
            .update(JSON.stringify(quote.snapshot))
            .digest("hex"),
        }),
      );
      console.log("Original baseline records retained; fresh-job check prepared.");
      return;
    }
    if (process.argv.includes("--verify")) {
      const saved = JSON.parse(await readFile(join(directory, "flow-fixtures.json"), "utf8"));
      const quote = await db.pricingQuote.findUniqueOrThrow({ where: { id: saved.quoteId } });
      assert.equal(quote.status, "accepted");
      assert.ok(quote.projectId);
      assert.equal(
        createHash("sha256").update(JSON.stringify(quote.snapshot)).digest("hex"),
        saved.quoteSnapshotHash,
      );
      assert.equal(
        (await db.billingPlan.findUniqueOrThrow({ where: { quoteId: quote.id } })).projectId,
        quote.projectId,
      );
      assert.equal(await db.billingPlan.count({ where: { projectId: saved.freshProjectId } }), 0);
      console.log(
        "Workflow verified: explicit acceptance links the same plan/project, snapshot unchanged, opening a fresh job creates no financial records.",
      );
      return;
    }
    const project = await db.clientProject.create({
      data: {
        title: `${fixture.marker} estudio de flujo`,
        company: fixture.marker,
        clientId: fixture.clientId,
        amount: 1000000,
        currency: "COP",
      },
    });
    const view = await getBillingView({ projectId: project.id });
    const draft = {
      quoteId: "",
      projectId: project.id,
      revision: 0,
      mode: "flexible" as const,
      issuer: emptyBillingIssuer(),
      recipient: { ...emptyBillingParty(), name: "Cliente de estudio ficticio" },
      installments: [],
      paymentTerms: "",
      deliveryTerms: "",
      period: "",
    };
    const plan = await saveBillingPlan(draft);
    await recordFlexibleReceipt({
      planId: plan.id,
      id: randomUUID(),
      amount: "300.000",
      paidAt: view.today,
      concept: "Primer avance del estudio",
      reference: "",
      expectedId: "",
    });
    const quote = await savePricingQuote({
      ...emptyPricingQuote(),
      clientId: fixture.clientId,
      serviceId: fixture.serviceId,
      title: `${fixture.marker} aceptación desde cobros`,
      hours: "20",
      final: "1.000.000",
    });
    await saveBillingPlan({ ...draft, projectId: "", quoteId: quote.id });
    const fresh = await db.clientProject.create({
      data: {
        title: `${fixture.marker} trabajo sin plan`,
        company: fixture.marker,
        clientId: fixture.clientId,
        amount: 1000000,
        currency: "COP",
      },
    });
    await writeFile(
      join(directory, "flow-fixtures.json"),
      JSON.stringify({
        projectId: project.id,
        quoteId: quote.id,
        planId: plan.id,
        freshProjectId: fresh.id,
        quoteSnapshotHash: createHash("sha256")
          .update(
            JSON.stringify(
              (await db.pricingQuote.findUniqueOrThrow({ where: { id: quote.id } })).snapshot,
            ),
          )
          .digest("hex"),
      }),
    );
    console.log(
      "Synthetic study fixtures ready: existing project with partial payment and draft quote awaiting explicit acceptance.",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
