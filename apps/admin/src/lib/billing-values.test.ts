import assert from "node:assert/strict";
import { test } from "node:test";
import {
  billingDecimal,
  billingInputAmount,
  billingMinor,
  billingMoney,
  emptyBillingIssuer,
  emptyBillingParty,
  equalBillingQuotas,
  parseBillingDetails,
  readBillingPlan,
  readFlexiblePayments,
  requireChargeIdentity,
  type BillingPlanDraft,
} from "./billing-values";
import { moneyInWords } from "./money-words";
const ids = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
];
const draft = (mode: "amount" | "percent" = "amount"): BillingPlanDraft => ({
  quoteId: ids[0],
  projectId: "",
  revision: 0,
  mode,
  issuer: emptyBillingIssuer(),
  recipient: emptyBillingParty(),
  installments: ids.map((id, i) => ({
    id,
    label: `Cuota ${i + 1}`,
    value: mode === "percent" ? ["50", "30", "20"][i] : ["5.000", "3.000", "2.000"][i],
    dueDate: "",
  })),
  paymentTerms: "Transferencia",
  deliveryTerms: "Contra entrega",
  period: "",
});

test("custom percentages and fixed amounts preserve the exact agreed total", () => {
  assert.deepEqual(
    readBillingPlan(draft("percent"), 9386000).installments.map((q) => q.amount),
    ["4693000.00", "2815800.00", "1877200.00"],
  );
  assert.deepEqual(
    readBillingPlan(draft(), 10000).installments.map((q) => q.amount),
    ["5000.00", "3000.00", "2000.00"],
  );
  for (const total of [0.01, 1, 100, 1234.56, 9386000]) {
    const rows = equalBillingQuotas(total, total < 1 ? 1 : 3, total < 1 ? [ids[0]] : ids);
    const plan = readBillingPlan({ ...draft(), installments: rows }, total);
    assert.equal(
      plan.installments.reduce((sum, q) => sum + billingMinor(q.amount), BigInt(0)),
      billingMinor(total),
    );
  }
  assert.deepEqual(
    equalBillingQuotas(100, 3, ids).map((q) => q.value),
    ["33,33", "33,33", "33,34"],
  );
  assert.match(billingMoney(33.34), /33,34/);
});

test("invalid totals, dates, repeated rows and unsafe amounts fail before persistence", () => {
  assert.throws(() => readBillingPlan(draft(), 9999));
  assert.throws(() =>
    readBillingPlan(
      {
        ...draft("percent"),
        installments: draft("percent").installments.map((q) => ({ ...q, value: "30" })),
      },
      100,
    ),
  );
  assert.throws(() =>
    readBillingPlan(
      { ...draft(), installments: draft().installments.map((q) => ({ ...q, id: ids[0] })) },
      10000,
    ),
  );
  assert.throws(() =>
    readBillingPlan(
      {
        ...draft(),
        installments: draft().installments.map((q) => ({ ...q, dueDate: "2026-02-30" })),
      },
      10000,
    ),
  );
  for (const value of [-1, NaN, Infinity, 1.005, 1e16]) assert.throws(() => billingMinor(value));
  assert.equal(billingInputAmount("1.234,56"), BigInt(123456));
  assert.equal(billingInputAmount("1234.56"), BigInt(123456));
  assert.equal(billingDecimal(billingMinor(123456789012.34)), "123456789012.34");
});

test("persisted plans validate money and identity remains necessary only when issuing", () => {
  const plan = readBillingPlan(draft(), 10000);
  assert.deepEqual(parseBillingDetails(plan, 10000), plan);
  assert.throws(() =>
    parseBillingDetails({ ...plan, installments: [{ ...plan.installments[0], amount: null }] }, 0),
  );
  assert.throws(() => requireChargeIdentity(plan));
  requireChargeIdentity({
    ...plan,
    issuer: { ...plan.issuer, name: "Emisor", identification: "CC 123" },
    recipient: { ...plan.recipient, name: "Cliente", identification: "NIT 456" },
  });
});

test("amounts in words agree with figures, Spanish grammar and cents", () => {
  assert.equal(
    moneyInWords(9386000, "COP"),
    "Nueve millones trescientos ochenta y seis mil pesos colombianos",
  );
  assert.equal(moneyInWords(1000000, "COP"), "Un millón de pesos colombianos");
  assert.equal(moneyInWords(1.01, "USD"), "Un dólar estadounidense con un centavo");
  assert.equal(moneyInWords(0, "COP"), "Cero pesos colombianos");
  assert.equal(moneyInWords(21, "COP"), "Veintiún pesos colombianos");
});

test("flexible agreements do not require installments, amounts or dates for future payments", () => {
  const plan = readBillingPlan({ ...draft(), mode: "flexible", installments: [] }, 10000);
  assert.equal(plan.paymentMode, "flexible");
  assert.deepEqual(plan.installments, []);
  assert.match(plan.paymentTerms, /Transferencia/);
  assert.deepEqual(parseBillingDetails(plan, 10000), plan);
  const ledger = readFlexiblePayments(
    {
      receipts: [
        {
          id: ids[0],
          amount: "1200.50",
          paidAt: "2026-10-28",
          concept: "Avance del catálogo",
          reference: "",
          expectedId: null,
        },
      ],
      expected: [
        {
          id: ids[1],
          amount: null,
          expectedAt: "2026-11",
          concept: "Siguiente avance",
          receiptId: null,
        },
      ],
    },
    10000,
  );
  assert.equal(ledger.receipts[0].amount, "1200.50");
  assert.equal(ledger.expected[0].amount, null);
  assert.equal(ledger.expected[0].expectedAt, "2026-11");
  assert.deepEqual(
    parseBillingDetails({ ...plan, flexiblePayments: ledger }, 10000).flexiblePayments,
    ledger,
  );
  assert.throws(() =>
    parseBillingDetails({ ...readBillingPlan(draft(), 10000), flexiblePayments: ledger }, 10000),
  );
});

test("flexible history rejects overpayment, invalid dates and inconsistent received/expected links", () => {
  const received = {
    id: ids[0],
    amount: "500.00",
    paidAt: "2026-10-28",
    concept: "Primera entrega",
    reference: "",
    expectedId: ids[1],
  };
  const expected = {
    id: ids[1],
    amount: null,
    expectedAt: null,
    concept: "Avance previsto",
    receiptId: ids[0],
  };
  const ledger = { receipts: [received], expected: [expected] };
  assert.deepEqual(readFlexiblePayments(ledger, 500), ledger);
  assert.throws(() => readFlexiblePayments(ledger, 499.99));
  assert.throws(() =>
    readFlexiblePayments({ ...ledger, receipts: [{ ...received, paidAt: "2026-10" }] }, 500),
  );
  assert.throws(() =>
    readFlexiblePayments({ ...ledger, expected: [{ ...expected, expectedAt: "2026-02-30" }] }, 500),
  );
  assert.throws(() =>
    readFlexiblePayments({ ...ledger, expected: [{ ...expected, receiptId: null }] }, 500),
  );
  assert.throws(() => readFlexiblePayments({ ...ledger, receipts: [received, received] }, 1000));
});
