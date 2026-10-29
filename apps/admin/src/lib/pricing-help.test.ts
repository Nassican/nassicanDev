import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pricingFieldHelp } from "./pricing-help";
import { financialLabels, niifLabels } from "./pricing-financial";

test("every financial and settings field has a concrete explanation", () => {
  for (const label of [...Object.values(financialLabels), ...Object.values(niifLabels)])
    assert.ok(pricingFieldHelp(label), `Missing help: ${label}`);
  const settings = readFileSync(
    join(process.cwd(), "apps/admin/src/components/PricingSettings.tsx"),
    "utf8",
  )
    .split("const labels:")[1]
    .split("export default")[0];
  for (const [, label] of settings.matchAll(/:\s*"([^"]+)"/g))
    assert.ok(pricingFieldHelp(label), `Missing help: ${label}`);
});

test("financial help does not confuse cost of sales with selling expenses or depreciation with administration", () => {
  assert.match(pricingFieldHelp(financialLabels.cost61)!, /No se vuelven|no se vuelven/);
  assert.match(pricingFieldHelp(financialLabels.depreciation)!, /EBITDA/);
  assert.match(pricingFieldHelp(niifLabels.expense52!)!, /Gastos comerciales/);
  assert.match(pricingFieldHelp("Descuento familiar (%)")!, /Puede bajar del piso/);
  assert.equal(pricingFieldHelp("Un campo no registrado"), undefined);
});
