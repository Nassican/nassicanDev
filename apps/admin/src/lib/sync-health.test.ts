import assert from "node:assert/strict";
import { test } from "node:test";
import { sinceLabel, syncProblems } from "./sync-health";

const NOW = new Date("2026-10-03T12:00:00Z");

const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

type Run = Parameters<typeof syncProblems>[0][number];

const run = (over: Partial<Run> & Pick<Run, "source">): Run => ({
  status: "ok",
  startedAt: hoursAgo(6),
  finishedAt: hoursAgo(6),
  error: null,
  ...over,
});

/** Every scheduled source fresh and ok, so a test can break one thing at a time. */
const healthy = (): Run[] => [
  run({ source: "link_check" }),
  run({ source: "ga4" }),
  run({ source: "search_console" }),
  run({ source: "vercel" }),
];

test("todo al día no reporta nada", () => {
  assert.deepEqual(syncProblems(healthy(), NOW), []);
});

/**
 * The failure mode a naive version misses: a sync that fails writes a row saying
 * so, but a cron that never fired writes nothing at all.
 */
test("una fuente sin ninguna ejecución sale como detenida", () => {
  const runs = healthy().filter((r) => r.source !== "ga4");
  const problems = syncProblems(runs, NOW);

  assert.deepEqual(problems, [{ kind: "stale", source: "ga4", at: null }]);
});

test("más de 48 h sin correr es detenida", () => {
  const runs = healthy().map((r) =>
    r.source === "vercel" ? { ...r, startedAt: hoursAgo(50), finishedAt: hoursAgo(50) } : r,
  );
  const [problem] = syncProblems(runs, NOW);

  assert.equal(problem.kind, "stale");
  assert.equal(problem.source, "vercel");
});

/**
 * The window tolerates one missed invocation on purpose: Hobby fires anywhere
 * inside the hour, delivery is best effort, and warning on a single skip is how
 * an operator learns to ignore the warning.
 */
test("26 h todavía no es detenida: cabe una invocación perdida", () => {
  const runs = healthy().map((r) =>
    r.source === "vercel" ? { ...r, startedAt: hoursAgo(26), finishedAt: hoursAgo(26) } : r,
  );
  assert.deepEqual(syncProblems(runs, NOW), []);
});

test("la última ejecución fallida se reporta con su error", () => {
  const runs = healthy().map((r) =>
    r.source === "ga4"
      ? { ...r, status: "failed" as const, error: "Google respondió 403" }
      : r,
  );
  const [problem] = syncProblems(runs, NOW);

  assert.equal(problem.kind, "failed");
  assert.equal(problem.source, "ga4");
  assert.equal(problem.kind === "failed" && problem.error, "Google respondió 403");
});

/**
 * Only the latest run counts. Reporting a failure that a later success already
 * fixed is how a report stops being read.
 */
test("un fallo viejo ya seguido de un éxito no se reporta", () => {
  const runs: Run[] = [
    ...healthy(),
    run({ source: "ga4", status: "failed", error: "cayó anteayer", startedAt: hoursAgo(40) }),
  ];
  assert.deepEqual(syncProblems(runs, NOW), []);
});

test("un éxito posterior a un fallo gana aunque llegue en la misma lista", () => {
  // Newest first, which is the order the query returns.
  const runs: Run[] = [
    run({ source: "ga4", startedAt: hoursAgo(1), finishedAt: hoursAgo(1) }),
    run({ source: "ga4", status: "failed", error: "hace rato", startedAt: hoursAgo(5) }),
    run({ source: "link_check" }),
    run({ source: "search_console" }),
    run({ source: "vercel" }),
  ];
  assert.deepEqual(syncProblems(runs, NOW), []);
});

/**
 * A row stuck on `running` is a function terminated mid-flight. Sistema shows it
 * as in progress forever, so nothing else in the panel would ever mention it.
 */
test("una ejecución que quedó en marcha se reporta como a medias", () => {
  const runs = healthy().map((r) =>
    r.source === "link_check"
      ? { ...r, status: "running" as const, finishedAt: null, startedAt: hoursAgo(2) }
      : r,
  );
  const [problem] = syncProblems(runs, NOW);

  assert.equal(problem.kind, "abandoned");
  assert.equal(problem.source, "link_check");
});

test("una ejecución en marcha hace un minuto es normal, no un fallo", () => {
  const minuteAgo = new Date(NOW.getTime() - 60_000);
  const runs = healthy().map((r) =>
    r.source === "link_check"
      ? { ...r, status: "running" as const, finishedAt: null, startedAt: minuteAgo }
      : r,
  );
  assert.deepEqual(syncProblems(runs, NOW), []);
});

/** Wallet is synced by hand, so silence from it is not news. */
test("las fuentes manuales no se vigilan", () => {
  const runs: Run[] = [
    ...healthy(),
    run({ source: "wallet", status: "failed", error: "da igual", startedAt: hoursAgo(300) }),
  ];
  assert.deepEqual(syncProblems(runs, NOW), []);
});

test("sin ninguna ejecución, las cuatro vigiladas salen detenidas", () => {
  const problems = syncProblems([], NOW);

  assert.equal(problems.length, 4);
  assert.ok(problems.every((p) => p.kind === "stale"));
});

test("sinceLabel dice la verdad más gruesa que sigue siendo cierta", () => {
  assert.equal(sinceLabel(null, NOW), "nunca");
  assert.equal(sinceLabel(hoursAgo(0.5), NOW), "hace menos de una hora");
  assert.equal(sinceLabel(hoursAgo(1), NOW), "hace 1 hora");
  assert.equal(sinceLabel(hoursAgo(5), NOW), "hace 5 horas");
  assert.equal(sinceLabel(hoursAgo(24), NOW), "hace 1 día");
  assert.equal(sinceLabel(hoursAgo(75), NOW), "hace 3 días");
});
