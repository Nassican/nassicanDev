import assert from "node:assert/strict";
import { test } from "node:test";
import { livePricingInput } from "./pricing-live";
import { emptyPricingQuote, quoteInput } from "./pricing-draft";
import { defaultPricingParameters as parameters, calculatePricing } from "./pricing-engine";
import { emptyFinancial, readFinancial } from "./pricing-financial";

const client = {
  type: "person",
  country: "Colombia",
  department: "Nariño",
  municipality: "Pasto",
  stratum: 1,
};
const geography = {
  factors: [],
  incomes: [
    {
      ...client,
      stratum: null,
      income: 1370170,
      id: "base",
      justification: "Municipal base",
      date: "2025",
    },
  ],
};
const input = quoteInput(
  emptyPricingQuote(),
  { minimum: 0, incomePercent: 0.1 },
  { monthlyIncome: null, incomeOrigin: "missing" },
);
const resolve = (stratum: number, municipality = "Pasto") =>
  livePricingInput(
    input,
    { ...client, stratum, municipality },
    null,
    parameters,
    [],
    geography,
    "service",
  );

test("live capacity changes with the municipality and stratum before a server preview", () => {
  const low = resolve(1);
  const high = resolve(6);
  assert.equal(low.input.monthlyIncome, 690000);
  assert.equal(high.input.monthlyIncome, 4110000);
  assert.equal(low.estimate?.modeled, true);
  assert.equal(calculatePricing(low.input, parameters).capacity, 69000);
  assert.equal(calculatePricing(high.input, parameters).capacity, 411000);
  const elsewhere = livePricingInput(
    input,
    { ...client, municipality: "Medellín", department: "Antioquia" },
    null,
    parameters,
    [],
    geography,
    "service",
  );
  assert.equal(elsewhere.input.monthlyIncome, null);
});

test("recorded income including zero takes priority over a regional stratum model", () => {
  for (const monthlyIncome of [0, 5000000]) {
    const result = livePricingInput(
      { ...input, monthlyIncome, incomeOrigin: "declared" },
      client,
      null,
      parameters,
      [],
      geography,
      "service",
    );
    assert.equal(result.input.monthlyIncome, monthlyIncome);
    assert.equal(result.estimate, null);
  }
});

test("financial income takes priority; a company never inherits a person's stratum model", () => {
  const financial = readFinancial({
    ...emptyFinancial("client"),
    annual: true,
    revenue41: "120.000.000",
  });
  const person = livePricingInput(input, client, financial, parameters, [], geography, "service");
  assert.equal(person.input.monthlyIncome, 10000000);
  assert.equal(person.estimate, null);
  const company = livePricingInput(
    input,
    { ...client, type: "company" },
    null,
    parameters,
    [],
    geography,
    "service",
  );
  assert.equal(company.input.monthlyIncome, null);
  assert.equal(company.estimate, null);
});
