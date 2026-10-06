import assert from "node:assert/strict";
import { test } from "node:test";
import { certificateProblems, courseProblems, emptyCourse, storedProgress, yearOf } from "./course-draft";

const locales = ["es", "en"] as const;

test("a course needs a title, and its numbers must make sense", () => {
  assert.deepEqual(courseProblems(emptyCourse()), ["Falta el título."]);
  const bad = { ...emptyCourse(), title: "Git", progress: "120", url: "platzi.com" };
  const problems = courseProblems(bad);
  assert.ok(problems.some((p) => p.includes("0 a 100")));
  assert.ok(problems.some((p) => p.includes("http")));
});

test("a finished course is at 100, whatever the box said", () => {
  assert.equal(storedProgress({ status: "finished", progress: "85" }), 100);
  assert.equal(storedProgress({ status: "in_progress", progress: "42,4" }), 42);
  assert.equal(storedProgress({ status: "backlog", progress: "" }), 0);
});

test("the certificate goes out in both languages or not at all", () => {
  const draft = {
    url: "https://platzi.com/p/x/curso/1/diploma/detalle/",
    dateLabel: "2026",
    title: { es: "Curso de Git", en: "" },
    category: { es: "Herramientas", en: "Tools" },
  };
  assert.deepEqual(certificateProblems(draft, locales), ["Falta el título en: en."]);
  assert.deepEqual(certificateProblems({ ...draft, title: { es: "Curso de Git", en: "Git course" } }, locales), []);
  assert.equal(certificateProblems({ ...draft, url: "" }, locales).length, 2);
});

test("the certificate shows the year of the end date", () => {
  assert.equal(yearOf("2026-10-05"), "2026");
  assert.equal(yearOf(null), "");
});
