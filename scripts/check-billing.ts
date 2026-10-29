/** End-to-end domain checks, restricted to the disposable loopback PostgreSQL cluster. */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
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
  const { db, dbBase } = await import("@nassican/db");
  const {
    getBillingView,
    saveBillingPlan,
    issueBillingCharge,
    recordBillingReceipt,
    cancelBillingCharge,
  } = await import("../apps/admin/src/lib/billing");
  const { emptyBillingIssuer, emptyBillingParty } =
    await import("../apps/admin/src/lib/billing-values");
  const { setPricingQuoteStatus } = await import("../apps/admin/src/lib/pricing");
  const directory = join(tmpdir(), "nassican-pricing-qa");
  const fixture = JSON.parse(await readFile(join(directory, "fixtures.json"), "utf8"));
  assert.equal(
    (await db.pricingService.findUniqueOrThrow({ where: { id: fixture.serviceId } })).name,
    fixture.marker,
  );
  try {
    if (process.argv.includes("--cleanup")) {
      const plans = await db.billingPlan.findMany({
        where: {
          OR: [
            { quote: { clientId: fixture.clientId } },
            { project: { clientId: fixture.clientId } },
          ],
        },
        include: { charges: { select: { id: true } } },
      });
      const chargeIds = plans.flatMap((p) => p.charges.map((c) => c.id));
      const receipts = await db.billingReceipt.findMany({
        where: { chargeId: { in: chargeIds } },
        select: { id: true },
      });
      await db.billingReceipt.deleteMany({ where: { chargeId: { in: chargeIds } } });
      await db.billingCharge.deleteMany({ where: { id: { in: chargeIds } } });
      await db.billingPlan.deleteMany({ where: { id: { in: plans.map((p) => p.id) } } });
      await dbBase.auditLog.deleteMany({
        where: {
          entityId: { in: [...chargeIds, ...plans.map((p) => p.id), ...receipts.map((p) => p.id)] },
        },
      });
      console.log("Synthetic billing plans, charges, receipts and their audit entries removed.");
      return;
    }
    const quote = await db.pricingQuote.findUniqueOrThrow({ where: { id: fixture.quoteId } });
    const hash = createHash("sha256").update(JSON.stringify(quote.snapshot)).digest("hex");
    const view = await getBillingView({ quoteId: quote.id });
    const draft = {
      quoteId: quote.id,
      projectId: "",
      revision: 0,
      mode: "percent" as const,
      issuer: {
        ...emptyBillingIssuer(),
        name: "Emisor de prueba Nassican",
        identification: "CC 00000001",
        city: "Pasto",
        bank: "Banco de ejemplo",
        accountType: "Ahorros",
        accountNumber: "0000000000",
      },
      recipient: {
        ...emptyBillingParty(),
        name: "Cliente de prueba",
        identification: "NIT 00000002",
      },
      installments: ["50", "30", "20"].map((value, i) => ({
        id: randomUUID(),
        label: ["Anticipo", "Desarrollo", "Entrega"][i],
        value,
        dueDate: "",
      })),
      paymentTerms: "Transferencia según hitos acordados.",
      deliveryTerms: "Entrega por hitos; fechas por acordar.",
      period: "",
    };
    const plan = await saveBillingPlan(draft);
    await assert.rejects(
      issueBillingCharge(plan.id, draft.installments[0].id, "Anticipo"),
      /Acepta primero/,
    );
    const accepted = await setPricingQuoteStatus(quote.id, "accepted");
    assert.ok(accepted.ok);
    const acceptedPlan = await db.billingPlan.findUniqueOrThrow({ where: { id: plan.id } });
    assert.equal(acceptedPlan.projectId, accepted.row.projectId);
    const first = await issueBillingCharge(
      plan.id,
      draft.installments[0].id,
      "Anticipo del proyecto de prueba",
    );
    assert.equal(
      (await issueBillingCharge(plan.id, draft.installments[0].id, "No duplica el documento")).id,
      first.id,
    );
    const frozen = JSON.stringify(first.snapshot);
    await assert.rejects(
      saveBillingPlan({ ...draft, revision: acceptedPlan.revision }),
      /emitidas/,
    );
    const receipt = {
      id: randomUUID(),
      chargeId: first.id,
      amount: "100.000",
      paidAt: view.today,
      reference: "Abono local de prueba",
    };
    const stored = await recordBillingReceipt(receipt);
    assert.equal((await recordBillingReceipt(receipt)).id, stored.id);
    await assert.rejects(
      recordBillingReceipt({ ...receipt, amount: "1", reference: "Otro dato" }),
      /identificador/,
    );
    await assert.rejects(
      recordBillingReceipt({ ...receipt, id: randomUUID(), amount: "2.000.000" }),
      /supera/,
    );
    await assert.rejects(cancelBillingCharge(first.id, "No debe anularse con abonos"), /abonos/);
    const second = await issueBillingCharge(plan.id, draft.installments[1].id, "Desarrollo");
    const parallel = await Promise.allSettled(
      [1, 2].map((n) =>
        recordBillingReceipt({
          id: randomUUID(),
          chargeId: second.id,
          amount: String(Number(second.amount) * 0.75).replace(".", ","),
          paidAt: view.today,
          reference: `Abono simultáneo ${n}`,
        }),
      ),
    );
    assert.equal(parallel.filter((p) => p.status === "fulfilled").length, 1);
    const third = await issueBillingCharge(plan.id, draft.installments[2].id, "Entrega");
    await cancelBillingCharge(third.id, "Cancelación de prueba sin abonos");
    await assert.rejects(
      recordBillingReceipt({ ...receipt, id: randomUUID(), chargeId: third.id }),
      /anulada/,
    );
    const replacement = await issueBillingCharge(
      plan.id,
      draft.installments[2].id,
      "Entrega reemitida",
    );
    assert.notEqual(replacement.id, third.id);
    assert.equal(
      JSON.stringify(
        (await db.billingCharge.findUniqueOrThrow({ where: { id: first.id } })).snapshot,
      ),
      frozen,
    );
    assert.equal(
      createHash("sha256")
        .update(
          JSON.stringify(
            (await db.pricingQuote.findUniqueOrThrow({ where: { id: quote.id } })).snapshot,
          ),
        )
        .digest("hex"),
      hash,
    );
    const { getClientProjects } = await import("../apps/admin/src/lib/client-projects");
    const work = (await getClientProjects()).rows.find((p) => p.id === accepted.row.projectId)!;
    assert.equal(work.billing?.received, 100000 + Number(second.amount) * 0.75);
    await writeFile(
      join(directory, "billing-fixtures.json"),
      JSON.stringify({
        planId: plan.id,
        chargeId: first.id,
        projectId: accepted.row.projectId,
        quoteId: quote.id,
      }),
    );
    console.log(
      "Billing passed: exact custom quotas, accepted-project link, stable snapshots, duplicate protection, partial/parallel receipts, overpayment rejection, cancellation and project balances.",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
