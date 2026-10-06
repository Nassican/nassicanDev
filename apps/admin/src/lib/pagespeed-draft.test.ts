import assert from "node:assert/strict";
import { test } from "node:test";
import { explainError, formatMs, isRegression, metricTone, parseLighthouse, scoreTone } from "./pagespeed-draft";

/** The shape `runPagespeed` returns, trimmed to what is read. */
const response = {
  loadingExperience: { overall_category: "NONE" },
  lighthouseResult: {
    categories: {
      performance: { score: 0.87 },
      accessibility: { score: 1 },
      "best-practices": { score: 0.96 },
      seo: { score: 0.92 },
    },
    audits: {
      "largest-contentful-paint": { numericValue: 2741.38 },
      "first-contentful-paint": { numericValue: 1180.2 },
      "total-blocking-time": { numericValue: 152.5 },
      "cumulative-layout-shift": { numericValue: 0.00341 },
    },
  },
};

test("scores become 0–100 and metrics are rounded", () => {
  assert.deepEqual(parseLighthouse(response), {
    performance: 87,
    accessibility: 100,
    bestPractices: 96,
    seo: 92,
    lcpMs: 2741,
    fcpMs: 1180,
    tbtMs: 153,
    cls: 0.003,
    fieldCategory: null,
  });
});

test("a category that did not run is null, not zero", () => {
  const partial = { lighthouseResult: { categories: { performance: { score: 0 } }, audits: {} } };
  const parsed = parseLighthouse(partial);
  assert.equal(parsed.performance, 0);
  assert.equal(parsed.seo, null);
  assert.equal(parsed.lcpMs, null);
});

test("a response without Lighthouse is an error, not empty scores", () => {
  assert.throws(() => parseLighthouse({ error: { code: 500 } }), /lighthouseResult/);
});

test("field data is kept only when Google has some", () => {
  const fast = { ...response, loadingExperience: { overall_category: "FAST" } };
  assert.equal(parseLighthouse(fast).fieldCategory, "FAST");
});

test("the two errors met while building this read as instructions", () => {
  const disabled = explainError(
    403,
    "PageSpeed Insights API has not been used in project 38586880139 before or it is disabled.",
  );
  assert.match(disabled, /no está activada/);
  assert.match(disabled, /38586880139/);
  assert.match(explainError(429, "Quota exceeded"), /cuota anónima/);
});

test("Lighthouse's bands and the Web Vitals thresholds", () => {
  assert.equal(scoreTone(90), "good");
  assert.equal(scoreTone(89), "average");
  assert.equal(scoreTone(49), "poor");
  assert.equal(scoreTone(null), null);
  assert.equal(metricTone("lcpMs", 2500), "good");
  assert.equal(metricTone("lcpMs", 4001), "poor");
  assert.equal(metricTone("cls", 0.15), "average");
});

test("a wobble is not a regression; ten points or falling under 50 is", () => {
  assert.equal(isRegression(85, 92), false);
  assert.equal(isRegression(82, 92), true);
  assert.equal(isRegression(48, 55), true);
  assert.equal(isRegression(45, 47), false);
  assert.equal(isRegression(40, null), true);
  assert.equal(isRegression(null, 90), false);
});

test("durations read in the unit a person would say", () => {
  assert.equal(formatMs(850), "850 ms");
  assert.equal(formatMs(2741), "2,7 s");
  assert.equal(formatMs(null), "—");
});
