import assert from "node:assert/strict";
import { test } from "node:test";
import { pricingNumberEdit, pricingNumberPaste } from "./pricing-number";
import { parseNumber } from "./draft-fields";

test("live grouping preserves decimal editing, blanks, zero and negative equity", () => {
  for (const [raw, expected] of [
    ["9386000", "9.386.000"],
    ["9.386.0000", "93.860.000"],
    ["1234,", "1.234,"],
    ["1234,50", "1.234,50"],
    ["0", "0"],
    ["", ""],
    ["-", "-"],
    ["-250000,00", "-250.000,00"],
  ])
    assert.equal(pricingNumberEdit(raw).value, expected);
});

test("caret tracks the edited digits instead of jumping to the end", () => {
  assert.deepEqual(pricingNumberEdit("19.386.000", 2), { value: "19.386.000", caret: 2 });
  assert.deepEqual(pricingNumberEdit("1234", 4), { value: "1.234", caret: 5 });
  assert.deepEqual(pricingNumberEdit("1.234,50", 7), { value: "1.234,50", caret: 7 });
});

test("pasted amounts keep their monetary value for both supported decimal separators", () => {
  for (const raw of ["9.386.000", "$ 1.234,50", "1234.50", "12.5", "0", "-25,5"])
    assert.equal(parseNumber(pricingNumberPaste(raw)!), parseNumber(raw));
  assert.equal(pricingNumberPaste("sin dato"), null);
});
