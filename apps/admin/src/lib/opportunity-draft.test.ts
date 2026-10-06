import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyOpportunity, followUp, opportunityProblems } from "./opportunity-draft";

const today = "2026-10-05";

test("an open opportunity with no next step is a warning, not silence", () => {
  assert.deepEqual(followUp("conversation", null, today), { kind: "missing" });
  assert.equal(followUp("won", null, today), null);
  assert.equal(followUp("lost", "2026-09-01", today), null);
});

test("the next step falls due on its day", () => {
  assert.deepEqual(followUp("contacted", "2026-10-02", today), { kind: "overdue", days: 3 });
  assert.deepEqual(followUp("contacted", "2026-10-05T15:00", today), { kind: "today" });
  assert.deepEqual(followUp("contacted", "2026-10-07", today), { kind: "soon", days: 2 });
  assert.deepEqual(followUp("contacted", "2026-10-20", today), { kind: "later" });
});

test("a next step needs a real day and something to do", () => {
  const draft = { ...emptyOpportunity(), title: "Backend en Acme", nextStepOn: "2026-10" };
  const problems = opportunityProblems(draft);
  assert.ok(problems.some((p) => p.includes("día concreto")));
  assert.ok(problems.some((p) => p.includes("falta qué")));
  assert.deepEqual(opportunityProblems({ ...draft, nextStepOn: "2026-10-09", nextStep: "Enviar portafolio" }), []);
});

test("money is read the es-CO way", () => {
  const draft = { ...emptyOpportunity(), title: "Freelance", amount: "4.500.000" };
  assert.deepEqual(opportunityProblems(draft), []);
});
