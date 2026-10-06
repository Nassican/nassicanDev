import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * The guarantee is the shape of `wallet-budgets.ts`, so the test reads it.
 *
 * The Wallet token has no scopes: the same token that edits a budget could
 * delete every record. What keeps the panel to budgets is that this file
 * cannot express anything else, and a comment saying so would survive only
 * until the first person in a hurry.
 */
const source = readFileSync(new URL("./wallet-budgets.ts", import.meta.url), "utf8");
// Comments removed, so the rules are checked against code and not prose. Line
// comments only where they start a line: «https://» has two slashes too.
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("one address, and it is the budgets endpoint", () => {
  const urls = code.match(/https:\/\/[^"'`\s]+/g) ?? [];
  assert.deepEqual(urls, ["https://rest.budgetbakers.com/wallet/v1/api/budgets"]);
  // Every fetch goes to that constant, never to a URL built from an argument.
  for (const call of code.match(/fetch\(([^,]+),/g) ?? []) {
    assert.match(call, /fetch\((BUDGETS|url|`\$\{BUDGETS\}[^`]*`),/);
  }
  assert.match(code, /const url = `\$\{BUDGETS\}\?/);
});

test("only GET, POST and PATCH — never DELETE", () => {
  const verbs = [...code.matchAll(/method:\s*"([A-Z]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(verbs)].sort(), ["GET", "PATCH", "POST"]);
  assert.doesNotMatch(code, /DELETE/);
  assert.doesNotMatch(code, /method:\s*[a-z]/, "a verb taken from a variable could be anything");
});

test("nothing generic is exported", () => {
  assert.doesNotMatch(code, /export\s+(async\s+)?function\s+patchBudget/);
  assert.doesNotMatch(code, /export\s+(const|async function|function)\s+\w+\s*=?\s*\(?[^)]*\b(path|method|endpoint|url)\b/i);
});

test("a limit change never rewrites past months", () => {
  assert.doesNotMatch(code, /resetLimit/);
});
