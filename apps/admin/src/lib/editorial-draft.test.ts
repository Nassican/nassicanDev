import assert from "node:assert/strict";
import { test } from "node:test";
import {
  columnOf,
  ideaProblems,
  isLate,
  monthGrid,
  monthLabel,
  placeInMonth,
  shiftMonth,
  type BoardItem,
} from "./editorial-draft";

const item = (over: Partial<BoardItem> = {}): BoardItem => ({
  id: Math.random().toString(36),
  ideaId: "i",
  postId: null,
  title: "x",
  note: null,
  stage: "idea",
  postStatus: null,
  publishedAt: null,
  targetDate: null,
  when: null,
  ...over,
});

const now = new Date("2026-10-05T15:00:00Z");

test("una idea va por su etapa; un artículo, por su estado", () => {
  assert.equal(columnOf(item(), now), "idea");
  assert.equal(columnOf(item({ stage: "research" }), now), "research");
  assert.equal(columnOf(item({ postId: "p", postStatus: "draft", stage: "research" }), now), "writing");
  assert.equal(columnOf(item({ postId: "p", postStatus: "scheduled" }), now), "scheduled");
  assert.equal(columnOf(item({ postId: "p", postStatus: "published", publishedAt: "2026-10-01T10:00:00Z" }), now), "published");
  assert.equal(columnOf(item({ postId: "p", postStatus: "archived" }), now), null);
});

test("publicado con fecha futura es programado, diga lo que diga el estado", () => {
  assert.equal(columnOf(item({ postId: "p", postStatus: "published", publishedAt: "2026-10-20T10:00:00Z" }), now), "scheduled");
});

test("el mes empieza en lunes y se rellena con los vecinos", () => {
  const weeks = monthGrid("2026-10");
  assert.equal(weeks[0][0], "2026-09-28");
  assert.equal(weeks.at(-1)!.at(-1), "2026-11-01");
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(monthLabel("2026-10"), "octubre de 2026");
});

test("cada pieza cae en su día; lo que solo sabe el mes, aparte", () => {
  const { byDay, monthOnly } = placeInMonth(
    [
      item({ title: "día", when: "2026-10-15" }),
      item({ title: "hora", when: "2026-10-15T09:00" }),
      item({ title: "mes", when: "2026-10" }),
      item({ title: "otro mes", when: "2026-11-02" }),
      item({ title: "sin fecha" }),
    ],
    "2026-10",
  );
  assert.deepEqual(byDay.get("2026-10-15")?.map((i) => i.title), ["día", "hora"]);
  assert.deepEqual(monthOnly.map((i) => i.title), ["mes"]);
  assert.equal(byDay.size, 1);
});

test("atrasado a la precisión de su fecha, y nunca lo que ya salió", () => {
  assert.equal(isLate(item({ targetDate: "2026-10-01" }), "idea", "2026-10-05"), true);
  assert.equal(isLate(item({ targetDate: "2026-10" }), "writing", "2026-10-31"), false);
  assert.equal(isLate(item({ targetDate: "2026-09" }), "writing", "2026-10-01"), true);
  assert.equal(isLate(item({ targetDate: "2026-09-01" }), "published", "2026-10-05"), false);
});

test("una idea necesita título; la fecha es opcional pero válida", () => {
  assert.deepEqual(ideaProblems({ title: "Cómo migré a Neon", targetDate: "" }), []);
  assert.equal(ideaProblems({ title: " ", targetDate: "" }).length, 1);
  assert.equal(ideaProblems({ title: "x", targetDate: "noviembre" }).length, 1);
});
