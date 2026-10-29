/** Financial domain checks restricted to the existing disposable PostgreSQL cluster. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(join(process.cwd(), "apps/admin"));
  const target = new URL(process.env.DATABASE_URL!);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.port, "55432");
  assert.equal(target.username, "pricing_qa");
  const { dbBase: db } = await import("@nassican/db");
  const {
    getBillingView,
    saveBillingPlan,
    recordFlexibleReceipt,
    saveExpectedPayment,
    removeExpectedPayment,
  } = await import("../apps/admin/src/lib/billing");
  const { emptyBillingIssuer, emptyBillingParty, parseBillingDetails } =
    await import("../apps/admin/src/lib/billing-values");
  const { saveClientProject, getClientProjects } =
    await import("../apps/admin/src/lib/client-projects");
  const { emptyClientProject } = await import("../apps/admin/src/lib/client-project-draft");
  const directory = join(tmpdir(), "nassican-pricing-qa");
  const fixture = JSON.parse(await readFile(join(directory, "fixtures.json"), "utf8"));
  assert.equal(
    (await db.pricingService.findUniqueOrThrow({ where: { id: fixture.serviceId } })).name,
    fixture.marker,
  );
  try {
    const project = await db.clientProject.create({
      data: {
        title: `${fixture.marker} pagos variables`,
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
      recipient: { ...emptyBillingParty(), name: fixture.marker },
      installments: [],
      paymentTerms: "",
      deliveryTerms: "",
      period: "",
    };
    const plan = await saveBillingPlan(draft);
    const first = {
      id: randomUUID(),
      planId: plan.id,
      amount: "125.000",
      paidAt: view.today,
      concept: "Avance del catálogo",
      reference: "",
      expectedId: "",
    };
    await recordFlexibleReceipt(first);
    await recordFlexibleReceipt(first);
    await assert.rejects(recordFlexibleReceipt({ ...first, amount: "125.001" }), /identificador/);
    await assert.rejects(
      recordFlexibleReceipt({ ...first, id: randomUUID(), amount: "1.000.000" }),
      /superan/,
    );
    await assert.rejects(
      recordFlexibleReceipt({ ...first, id: randomUUID(), paidAt: "2099-01-01" }),
      /futura/,
    );
    const future = {
      id: randomUUID(),
      planId: plan.id,
      amount: "",
      expectedAt: "2027-01",
      concept: "Próximo avance, importe por acordar",
    };
    await saveExpectedPayment(future);
    await saveExpectedPayment(future);
    const later = {
      ...future,
      id: randomUUID(),
      amount: "300.000",
      expectedAt: "",
      concept: "Previsión que se retira",
    };
    await saveExpectedPayment(later);
    await removeExpectedPayment(plan.id, later.id);
    let saved = await db.billingPlan.findUniqueOrThrow({ where: { id: plan.id } });
    let details = parseBillingDetails(saved.details, Number(saved.amount));
    assert.equal(details.flexiblePayments!.receipts.length, 1);
    assert.equal(details.flexiblePayments!.expected.length, 1);
    assert.equal(details.flexiblePayments!.expected[0].amount, null);
    assert.equal(
      (await getClientProjects()).rows.find((p) => p.id === project.id)!.billing!.received,
      125000,
    );
    const confirmation = {
      ...first,
      id: randomUUID(),
      amount: "250.000",
      concept: future.concept,
      expectedId: future.id,
    };
    await recordFlexibleReceipt(confirmation);
    await assert.rejects(
      recordFlexibleReceipt({ ...confirmation, id: randomUUID() }),
      /ya fue recibido/,
    );
    await assert.rejects(removeExpectedPayment(plan.id, future.id), /historial/);
    saved = await db.billingPlan.findUniqueOrThrow({ where: { id: plan.id } });
    details = parseBillingDetails(saved.details, Number(saved.amount));
    const history = JSON.stringify(details.flexiblePayments);
    await saveBillingPlan({
      ...draft,
      revision: saved.revision,
      issuer: { ...draft.issuer, name: "Emisor actualizado sin borrar pagos" },
    });
    saved = await db.billingPlan.findUniqueOrThrow({ where: { id: plan.id } });
    assert.equal(
      JSON.stringify(parseBillingDetails(saved.details, 1000000).flexiblePayments),
      history,
    );
    await assert.rejects(
      saveBillingPlan({
        ...draft,
        revision: saved.revision,
        mode: "amount",
        installments: [{ id: randomUUID(), label: "Todo", value: "1.000.000", dueDate: "" }],
      }),
      /modalidad|previsiones/,
    );
    await assert.rejects(
      saveClientProject({
        ...emptyClientProject(),
        id: project.id,
        title: project.title,
        company: fixture.marker,
        amount: "2.000.000",
      }),
      /pagos recibidos/,
    );
    const parallel = await Promise.allSettled(
      [1, 2].map((n) =>
        recordFlexibleReceipt({
          ...first,
          id: randomUUID(),
          amount: "468.750",
          concept: `Pago simultáneo ${n}`,
        }),
      ),
    );
    assert.equal(parallel.filter((r) => r.status === "fulfilled").length, 1);
    const summary = (await getClientProjects()).rows.find((p) => p.id === project.id)!.billing!;
    assert.equal(summary.received, 843750);
    assert.equal(summary.remaining, 156250);
    await recordFlexibleReceipt({
      ...first,
      id: randomUUID(),
      amount: "156.250",
      concept: "Saldo final",
    });
    assert.equal(
      (await getClientProjects()).rows.find((p) => p.id === project.id)!.billing!.remaining,
      0,
    );
    assert.equal(await db.billingCharge.count({ where: { planId: plan.id } }), 0);
    const ui = await db.clientProject.create({
      data: {
        title: `${fixture.marker} proyecto UI flexible`,
        company: fixture.marker,
        clientId: fixture.clientId,
        amount: 1000000,
        currency: "COP",
      },
    });
    await writeFile(
      join(directory, "flexible-fixtures.json"),
      JSON.stringify({ projectId: ui.id, domainProjectId: project.id }),
    );
    console.log(
      "Flexible billing passed: no fixed quotas or legal-ID requirement, unequal receipts, unknown future amount/month, idempotency, expected-payment confirmation, retained history on edit, protected contract, concurrent overpayment prevention, project balances, no manufactured accounts.",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
