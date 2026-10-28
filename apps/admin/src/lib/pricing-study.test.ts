import assert from "node:assert/strict";
import { test } from "node:test";
import { studiedRegionalFactor } from "./pricing-study";
test("income proxy is neutral nationally and bounded rather than treated as a software tariff", () => {
  assert.equal(studiedRegionalFactor(1281590, 1281590), 1);
  assert.equal(studiedRegionalFactor(100, 10000), 0.8);
  assert.equal(studiedRegionalFactor(10000, 100), 1.2);
  assert.equal(studiedRegionalFactor(1370170, 1281590), 1.033981);
  for (const invalid of [0, -1, NaN, Infinity])
    assert.throws(() => studiedRegionalFactor(invalid, 1281590));
});
