import assert from "node:assert/strict";
import { test } from "node:test";
import { bookProblems, emptyBook, progressRatio, type BookDraft } from "./book-draft";

const draft = (over: Partial<BookDraft> = {}): BookDraft => ({
  ...emptyBook(),
  title: "Cien años de soledad",
  ...over,
});

test("un libro con solo título ya se puede guardar", () => {
  assert.deepEqual(bookProblems(draft()), []);
});

test("sin título no", () => {
  assert.deepEqual(bookProblems(draft({ title: "  " })), ["Falta el título."]);
});

/**
 * The contradiction worth naming: it almost always means the total was typed
 * into the wrong box, and clamping it quietly would hide that.
 */
test("leer más páginas de las que tiene se reporta con las dos cifras", () => {
  const [problem] = bookProblems(draft({ pages: "300", pagesRead: "450" }));
  assert.match(problem, /450/);
  assert.match(problem, /300/);
});

test("leídas igual al total está bien", () => {
  assert.deepEqual(
    bookProblems(draft({ pages: "300", pagesRead: "300", status: "finished" })),
    [],
  );
});

test("solo el total, sin leídas, no es problema", () => {
  assert.deepEqual(bookProblems(draft({ pages: "471" })), []);
});

test("terminado con fecha pero marcado sin empezar se reporta", () => {
  const [problem] = bookProblems(draft({ finishedAt: "2025", status: "backlog" }));
  assert.match(problem, /sin empezar/);
});

/**
 * Pages on an audiobook are allowed — some people track the print length of what
 * they listened to — but half of that pair computes a progress bar nobody meant.
 */
test("un audiolibro con leídas pero sin total se reporta", () => {
  const problems = bookProblems(
    draft({ format: "audiobook", pagesRead: "80", pages: "" }),
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /audiolibro/);
});

test("un audiolibro con las dos cifras no molesta", () => {
  assert.deepEqual(
    bookProblems(draft({ format: "audiobook", pages: "400", pagesRead: "80" })),
    [],
  );
});

test("el precio con separador de miles se entiende", () => {
  // The same bug the games module shipped with: here the dot groups thousands.
  assert.deepEqual(bookProblems(draft({ price: "45.900" })), []);
});

test("las fechas parciales valen", () => {
  for (const value of ["2024", "2024-08", "2024-08-13"]) {
    assert.deepEqual(bookProblems(draft({ purchasedAt: value })), []);
  }
});

test("una fecha inventada se rechaza nombrando las tres formas", () => {
  const [problem] = bookProblems(draft({ purchasedAt: "ayer" }));
  for (const shape of ["2024", "2024-08", "2024-08-13"]) {
    assert.ok(problem.includes(shape));
  }
});

test("progressRatio solo divide cuando hay algo que dividir", () => {
  assert.equal(progressRatio(300, 150), 0.5);
  assert.equal(progressRatio(null, 150), null);
  assert.equal(progressRatio(300, null), null);
  assert.equal(progressRatio(0, 10), null);
  // Clamped: a row saved before the rule existed should not render past 100%.
  assert.equal(progressRatio(100, 500), 1);
});
