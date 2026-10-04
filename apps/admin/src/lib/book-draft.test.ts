import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookProblems,
  emptyBook,
  fillFromFacts,
  normaliseIsbn,
  progressRatio,
  type BookDraft,
} from "./book-draft";

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

test("el ISBN se normaliza a trece dígitos, se escriba como se escriba", () => {
  assert.equal(normaliseIsbn("978-0-307-47472-8"), "9780307474728");
  assert.equal(normaliseIsbn(" 978 0307474728 "), "9780307474728");
  // The «13» in the label is not the start of the number.
  assert.equal(normaliseIsbn("ISBN-13: 978-84-376-0494-7"), "9788437604947");
  assert.equal(normaliseIsbn("isbn 9780132350884"), "9780132350884");
});

test("un ISBN-10 se convierte al ISBN-13 de la misma edición", () => {
  // Clean Code: 0-13-235088-2 and 978-0-13-235088-4 are one book.
  assert.equal(normaliseIsbn("0-13-235088-2"), "9780132350884");
  assert.equal(normaliseIsbn("ISBN-10: 0132350882"), "9780132350884");
  // An X check digit is a ten, not a typo.
  assert.equal(normaliseIsbn("0-8044-2957-X"), "9780804429573");
});

test("un dígito mal tecleado no pasa, porque buscaría otro libro", () => {
  assert.equal(normaliseIsbn("9780307474729"), null);
  assert.equal(normaliseIsbn("0132350883"), null);
  assert.equal(normaliseIsbn("12345"), null);
  assert.equal(normaliseIsbn(""), null);
});

test("un ISBN que no cuadra impide guardar; uno vacío no", () => {
  assert.deepEqual(bookProblems(draft({ isbn: "9780307474729" })), ["El ISBN no cuadra: revisa los dígitos."]);
  assert.deepEqual(bookProblems(draft({ isbn: "" })), []);
});

test("completar solo rellena lo vacío y dice qué rellenó", () => {
  const facts = { title: "One Hundred Years of Solitude", author: "Gabriel García Márquez", pages: 417, source: "Open Library" };
  const { draft: filled, filled: which } = fillFromFacts(draft({ title: "Cien años de soledad", author: "" }), facts);
  // The title someone typed survives the catalogue's English one.
  assert.equal(filled.title, "Cien años de soledad");
  assert.equal(filled.author, "Gabriel García Márquez");
  assert.equal(filled.pages, "417");
  assert.deepEqual(which, ["autor", "páginas"]);
});

test("sin nada que rellenar, no cambia nada", () => {
  const before = draft({ author: "GGM", pages: "471" });
  const { draft: after, filled } = fillFromFacts(before, { title: "x", author: "y", pages: 1, source: "s" });
  assert.deepEqual(after, before);
  assert.deepEqual(filled, []);
});
