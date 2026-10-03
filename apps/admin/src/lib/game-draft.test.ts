import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyGame,
  gameProblems,
  isPartialDate,
  parseNumber,
  type GameDraft,
} from "./game-draft";

const draft = (over: Partial<GameDraft> = {}): GameDraft => ({
  ...emptyGame(),
  title: "Hollow Knight",
  ...over,
});

test("un juego con solo título ya se puede guardar", () => {
  assert.deepEqual(gameProblems(draft()), []);
});

test("sin título no", () => {
  assert.deepEqual(gameProblems(draft({ title: "   " })), ["Falta el título."]);
});

/**
 * The same partial dates as the experience and education fields: you remember
 * buying something in 2022 without remembering the day.
 */
test("las fechas parciales valen, con la precisión que se recuerde", () => {
  for (const value of ["2024", "2024-08", "2024-08-13"]) {
    assert.ok(isPartialDate(value), `${value} debería valer`);
    assert.deepEqual(gameProblems(draft({ purchasedAt: value })), []);
  }
});

/**
 * Asserts that the message *names the three shapes*, not how it punctuates them:
 * pinning the exact wording broke this test the moment the hint and the error
 * were made to say the same thing, which was an improvement.
 */
test("una fecha inventada se rechaza nombrando el formato", () => {
  const [problem] = gameProblems(draft({ purchasedAt: "13/08/2024" }));
  for (const shape of ["2024", "2024-08", "2024-08-13"]) {
    assert.ok(problem.includes(shape), `el mensaje debería nombrar ${shape}`);
  }
});

test("una fecha vacía no es un problema", () => {
  assert.deepEqual(gameProblems(draft({ purchasedAt: "", finishedAt: "" })), []);
});

/**
 * The one combination that is a contradiction between two fields rather than a
 * typo in one, so it gets said instead of saved quietly.
 */
test("terminado con fecha pero marcado sin empezar se reporta", () => {
  const [problem] = gameProblems(draft({ finishedAt: "2025-01", status: "backlog" }));
  assert.match(problem, /sin empezar/);
});

test("ese mismo caso con el estado correcto no molesta", () => {
  assert.deepEqual(
    gameProblems(draft({ finishedAt: "2025-01", status: "finished" })),
    [],
  );
});

test("horas y precio negativos o absurdos se rechazan", () => {
  assert.equal(gameProblems(draft({ hours: "-3" })).length, 1);
  assert.equal(gameProblems(draft({ price: "no sé" })).length, 1);
});

test("una coma decimal vale, que es como se escribe aquí", () => {
  assert.deepEqual(gameProblems(draft({ hours: "12,5" })), []);
  assert.equal(parseNumber("12,5"), 12.5);
});

test("un precio con formato de moneda se entiende", () => {
  assert.equal(parseNumber("$ 34.225"), 34225);
  assert.equal(parseNumber("30000"), 30000);
});

/**
 * Empty is «not recorded» and zero is «free» or «opened and quit». Collapsing
 * them would make the backlog spend and the cost per hour quietly wrong.
 */
test("vacío es null, no cero", () => {
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber("   "), null);
  assert.equal(parseNumber("0"), 0);
});

test("todos los problemas se reportan juntos, no de a uno", () => {
  const problems = gameProblems(
    draft({ title: "", purchasedAt: "ayer", hours: "-1" }),
  );
  assert.equal(problems.length, 3);
});

/**
 * The bug this file caught: the dot groups thousands here, so `Number()` read
 * `34.225` as thirty-four and would have filed a 34.225 peso game as costing 34.
 * The module prints prices in es-CO, so copying one off the screen back into the
 * field was the likeliest way to hit it.
 */
test("el punto agrupa miles, que es como se escribe aquí", () => {
  assert.equal(parseNumber("34.225"), 34225);
  assert.equal(parseNumber("1.234.567"), 1234567);
  assert.equal(parseNumber("1.234,56"), 1234.56);
});

test("uno o dos decimales tras el punto siguen siendo decimales", () => {
  assert.equal(parseNumber("12.5"), 12.5);
  assert.equal(parseNumber("10.25"), 10.25);
});

test("la validación y el guardado leen el número igual", () => {
  // Same input through both paths: the form must object to exactly what the
  // database would have stored, never to a different reading of it.
  assert.deepEqual(gameProblems(draft({ price: "34.225" })), []);
  assert.equal(parseNumber("34.225"), 34225);
});
