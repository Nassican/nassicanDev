import assert from "node:assert/strict";
import { test } from "node:test";
import {
  pricingExpiryDay,
  pricingReminders,
  readPricingTiers,
  type PricingReminderInput,
} from "./pricing-draft";
test("tier inputs retain es-CO thousands and reject gaps, overlap and a nonnumeric open end", () => {
  const first = {
    fromIncome: "0",
    toIncome: "100.000.000",
    percent: "0,01",
    minimum: "0",
    maximum: "1.000.000",
  };
  const last = { ...first, fromIncome: "100.000.000", toIncome: "", maximum: "15.000.000" };
  assert.equal(readPricingTiers([first, last])?.[1].fromIncome, 100000000);
  assert.equal(readPricingTiers([first, { ...last, fromIncome: "110.000.000" }]), null);
  assert.equal(readPricingTiers([first, { ...last, fromIncome: "90.000.000" }]), null);
  assert.equal(readPricingTiers([first, { ...last, toIncome: "sin idea" }]), null);
});
test("quote validity honors partial months and leap years", () => {
  assert.equal(pricingExpiryDay("2028-02"), "2028-02-29");
  assert.equal(pricingExpiryDay("2026"), "2026-12-31");
  assert.equal(pricingExpiryDay("2026-10-29"), "2026-10-29");
});
test("follow up only after seven days, and expiry only for open quotes in the next three", () => {
  const row: PricingReminderInput = {
    id: "q",
    title: "Sitio",
    client: "Cliente",
    status: "sent",
    sentOn: "2026-10-19",
    validUntil: "2026-10-30",
  };
  assert.equal(pricingReminders([row], "2026-10-27").followUps[0].days, 8);
  assert.equal(
    pricingReminders([{ ...row, sentOn: "2026-10-20" }], "2026-10-27").followUps.length,
    0,
  );
  assert.equal(pricingReminders([row], "2026-10-27").expiring[0].days, 3);
  assert.equal(pricingReminders([{ ...row, status: "accepted" }], "2026-10-27").expiring.length, 0);
  assert.equal(
    pricingReminders([{ ...row, validUntil: "2026-10" }], "2026-10-27").expiring.length,
    0,
  );
  assert.equal(
    pricingReminders([{ ...row, validUntil: "2026-10-26" }], "2026-10-27").expiring.length,
    0,
  );
});
