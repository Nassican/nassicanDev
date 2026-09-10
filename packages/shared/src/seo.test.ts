import assert from "node:assert/strict";
import test from "node:test";
import { buildRobots, canonicalOrigin, defaultCrawlSettings, isIndexableDeployment, robotsExtraProblem, serializeJsonLd } from "./seo";

test("canonical origin normalizes existing apex environment settings and preserves previews", () => {
  assert.equal(canonicalOrigin("https://nassican.com/"), "https://www.nassican.com");
  assert.equal(canonicalOrigin("http://www.nassican.com"), "https://www.nassican.com");
  assert.equal(canonicalOrigin("https://preview.vercel.app/"), "https://preview.vercel.app");
  assert.equal(canonicalOrigin("http://localhost:3000"), "http://localhost:3000");
});

test("JSON-LD cannot close its script element and preserves editorial text", () => {
  const data = { description: '</script><script>alert("x")</script> & español' };
  const serialized = serializeJsonLd(data);
  assert.ok(!serialized.includes("<"));
  assert.deepEqual(JSON.parse(serialized), data);
});

test("AI search and training permissions are independent and preserve API exclusions", () => {
  const robots = buildRobots("https://www.nassican.com/", { ...defaultCrawlSettings, allowAiTraining: false }, true);
  const groups = robots.split("\n\n");
  assert.match(groups[0], /Disallow: \/api\//);
  assert.match(groups[1], /User-agent: OAI-SearchBot/);
  assert.match(groups[1], /Allow: \/\nDisallow: \/api\//);
  assert.match(groups[2], /User-agent: GPTBot/);
  assert.match(groups[2], /Disallow: \/$/);
  assert.ok(!groups[2].includes("Allow:"));
  assert.match(robots, /Sitemap: https:\/\/www.nassican.com\/sitemap.xml/);
  const inverse = buildRobots("https://www.nassican.com", { ...defaultCrawlSettings, allowAiSearch: false }, true).split("\n\n");
  assert.match(inverse[1], /Disallow: \/$/);
  assert.match(inverse[2], /Allow: \/\nDisallow: \/api\//);
});

test("development and previews never become indexable, even with permissive extra rules", () => {
  for (const env of [{}, { NODE_ENV: "development" }, { NODE_ENV: "production", VERCEL_ENV: "preview" }]) {
    assert.equal(isIndexableDeployment(env), false);
  }
  assert.equal(isIndexableDeployment({ NODE_ENV: "production" }), true);
  assert.equal(isIndexableDeployment({ NODE_ENV: "production", VERCEL_ENV: "production" }), true);
  assert.equal(buildRobots("https://www.nassican.com", defaultCrawlSettings, false, "Allow: /"), "User-agent: *\nDisallow: /\n");
});

test("extra robots rules cannot override managed groups or inherit the last AI group", () => {
  for (const extra of ["Allow: /", "User-agent: GPTBot\nAllow: /", "User-agent: *\nDisallow: /", "User-agent: oai-searchbot\nAllow: /"]) {
    assert.ok(robotsExtraProblem(extra));
  }
  assert.equal(robotsExtraProblem("# note\nUser-agent: BadBot\nDisallow: /"), null);
  assert.equal(robotsExtraProblem(""), null);
});
