/** Validate the audited production HTML plus real browser behavior on a local production build. */
const assert = require("node:assert/strict");
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const dir = join(tmpdir(), "nassican-seo-second-audit");
const puppeteer = require(join(tmpdir(), "nassican-pricing-qa/node_modules/puppeteer-core"));
const canonical = "https://www.nassican.com";
const origin = "http://localhost:3207";
const name = "Jesús David Benavides Chicaiza";
const report = JSON.parse(readFileSync(join(dir, "localhost/report.json")));
const production = JSON.parse(readFileSync(join(dir, "www.nassican.com/report.json")));
const schema = JSON.parse(readFileSync(join(dir, "schemaorg.jsonld")));
const normalize = (id) => id.replace(/^https?:\/\/schema.org\//, "").replace(/^schema:/, "");
const terms = new Map(schema["@graph"].map((node) => [normalize(node["@id"]), node]));
const array = (value) => Array.isArray(value) ? value : value == null ? [] : [value];
function subtype(type, expected, visited = new Set()) {
  if (type === expected) return true;
  if (visited.has(type)) return false;
  visited.add(type);
  return array(terms.get(type)?.["rdfs:subClassOf"]).some((parent) => subtype(normalize(parent["@id"]), expected, visited));
}
function absolute(value) { return typeof value === "string" && /^https?:\/\//.test(value); }
function validateNode(node, location) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach((value) => validateNode(value, location)); return; }
  const types = array(node["@type"]).map(normalize);
  for (const type of types) assert.ok(terms.has(type), `${location}: unknown type ${type}`);
  if (node["@id"]) assert.ok(absolute(node["@id"]), `${location}: relative entity ID`);
  for (const [property, value] of Object.entries(node)) {
    if (property.startsWith("@")) continue;
    const term = terms.get(property);
    assert.ok(term, `${location}: unknown Schema.org property ${property}`);
    const domains = array(term["schema:domainIncludes"]).map((v) => normalize(v["@id"]));
    if (types.length && domains.length) assert.ok(types.some((t) => domains.some((d) => subtype(t, d))), `${location}: ${property} outside type domain`);
    const ranges = array(term["schema:rangeIncludes"]).map((v) => normalize(v["@id"]));
    if (types.length && ranges.length && !ranges.some((r) => ["Text", "URL", "Date", "DateTime", "Number", "Integer", "Float", "Boolean", "Time", "DataType"].includes(r))) {
      for (const valueItem of array(value)) {
        // A URL is a legitimate reference to a Thing, e.g. BreadcrumbList.item.
        if (typeof valueItem === "string") assert.ok(absolute(valueItem), `${location}: ${property} needs an entity or URL`);
      }
    }
    validateNode(value, `${location}.${property}`);
  }
}
function verifyInventory() {
  assert.equal(report.sitemap.status, 200);
  assert.equal(report.sitemap.validXml, true);
  assert.equal(new Set(report.sitemap.urls).size, report.sitemap.urls.length);
  assert.ok(report.sitemap.urls.every((url) => new URL(url).origin === canonical && !/\/api\/|\/es(?:\/|$)|\/precios/.test(new URL(url).pathname)));
  const indexable = report.routes.filter((route) => route.status === 200 && !/noindex/.test(route.robots));
  for (const route of report.routes.filter((route) => route.status === 200)) {
    assert.equal(route.h1.length, 1, route.path);
    assert.equal(route.canonical, route.canonicalExpected, route.path);
    assert.ok(route.title && route.description && route.ogTitle && route.ogDescription && route.ogImage && route.twitterTitle && route.twitterImage, route.path);
    assert.equal(route.twitterCard, "summary_large_image");
    assert.equal(new URL(route.ogUrl).href, new URL(route.canonical).href);
    assert.deepEqual(route.jsonLdErrors, []);
    assert.deepEqual(route.duplicateEntityIds, []);
    const people = route.graphs.filter((node) => node["@type"] === "Person");
    assert.equal(people.length, 1, route.path);
    assert.equal(people[0].name, name);
    assert.equal(people[0]["@id"], `${canonical}/#person`);
    assert.deepEqual(people[0].sameAs, production.routes.find((r) => r.path === "/").graphs.find((n) => n["@type"] === "Person").sameAs);
    assert.ok(!/\/brand\/|LogoNassican/i.test(people[0].image || ""));
    for (const graph of route.graphs) validateNode(graph, route.path);
    assert.ok(route.images.every((img) => img.alt !== null && (img.fill || img.width && img.height)), `${route.path}: image alt/dimensions`);
    if (["/", "/en"].includes(route.path)) {
      assert.ok(route.mainText.includes(name) && (route.mainText.includes("Nassican es") || route.mainText.includes("Nassican is")));
      assert.ok(route.marquee.every((group) => Object.values(group).every((count) => count === 1)), "Accessible duplicate technologies");
    }
    if (route.path.endsWith("/profile")) assert.equal(route.graphs.find((n) => n["@type"] === "ProfilePage").mainEntity["@id"], people[0]["@id"]);
    if (["/projects", "/en/projects"].includes(route.path)) assert.deepEqual(route.headings.map((h) => h.level), [1, ...route.headings.slice(1).map(() => 2)]);
  }
  for (const field of ["title", "description"]) assert.equal(new Set(indexable.map((r) => r[field])).size, indexable.length, `Duplicate indexable ${field}`);
  for (const url of report.sitemap.urls) {
    const path = new URL(url).pathname;
    const resource = report.routes.find((r) => r.path === path) || report.resources.find((r) => r.path === path);
    assert.equal(resource?.status, 200, url);
    assert.ok(!/noindex/i.test(resource.robots || ""), url);
  }
  for (const path of ["/blog", "/en/blog"]) {
    const route = report.routes.find((r) => r.path === path);
    assert.equal(route.status, 200);
    assert.match(route.robots, /noindex, follow/);
    assert.match(route.googlebot, /noindex/);
    assert.ok(!report.sitemap.urls.includes(canonical + path));
  }
  assert.equal(report.routes.find((r) => r.path === "/__seo_audit_not_found__").status, 404);
  assert.deepEqual(report.brokenInternalLinks, []);
}
async function main() {
  verifyInventory();
  const localPolicy = await fetch(`${origin}/robots.txt`, { headers: { "x-forwarded-host": "www.nassican.com" } }).then((r) => r.text());
  assert.equal(localPolicy, production.robots.content, "Crawler policies changed");
  assert.match(await fetch(`${origin}/robots.txt`).then((r) => r.text()), /Disallow: \//);
  const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const page = await browser.newPage();
  const errors = [], consoleErrors = [], failedResources = [], variants = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 400) failedResources.push({ url: response.url(), status: response.status() }); });
  try {
    for (const width of [1440, 390]) for (const dark of [false, true]) {
      await page.setViewport({ width, height: 1000, isMobile: width === 390, hasTouch: width === 390 });
      for (const path of ["/", "/projects", "/profile", "/blog", "/projects/cursovisor", "/projects/strategix", "/certificates", "/en"]) {
        const response = await page.goto(origin + path, { waitUntil: "domcontentloaded" });
        assert.ok([200, 304].includes(response.status()), `${path}: unexpected browser navigation status`);
        await page.waitForSelector("main h1");
        await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), dark);
        await new Promise((resolve) => setTimeout(resolve, 200));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path}: overflow ${width}`);
        assert.equal(await page.evaluate(() => document.querySelectorAll("h1").length), 1);
        const original = report.routes.find((r) => r.path === path);
        assert.equal(await page.title(), original.title);
        assert.equal(await page.$eval('link[rel="canonical"]', (e) => e.href), original.canonical);
        if (path === "/") {
          const marquee = await page.evaluate(() => [...document.querySelectorAll(".marquee-track")].map((track) => {
            const first = track.firstElementChild, clone = [...track.children].find((e) => e.getAttribute("aria-hidden") === "true");
            return { first: first?.getBoundingClientRect().width, clone: clone?.getBoundingClientRect().width, label: clone?.querySelector("[data-marquee-label]")?.dataset.marqueeLabel, content: clone?.querySelector("[data-marquee-label]") ? getComputedStyle(clone.querySelector("[data-marquee-label]"), "::before").content : "none", copiesHaveText: [...track.children].filter((e) => e.getAttribute("aria-hidden") === "true").some((e) => e.textContent.trim()) };
          }));
          assert.ok(marquee.every((g) => g.label && g.content !== "none" && !g.copiesHaveText && Math.abs(g.first - g.clone) < 1), "Marquee appearance/text changed");
          const grid = await page.$('section#skills button[aria-pressed="false"]');
          await grid.click();
          await page.waitForFunction(() => !document.querySelector(".marquee-track"));
          await page.keyboard.press("Tab");
          assert.ok(await page.evaluate(() => !["BODY", "HTML"].includes(document.activeElement.tagName)), "Keyboard navigation lost");
          const carousel = await page.$('section#skills button[aria-pressed="false"]');
          await carousel.click();
          await page.waitForSelector(".marquee-track");
          if (width === 390) {
            const trigger = await page.$('button[aria-controls="mobile-navigation"]');
            await trigger.focus();
            await page.keyboard.press("Enter");
            await page.waitForFunction(() => document.querySelector("#mobile-navigation").contains(document.activeElement));
            await page.keyboard.down("Shift"); await page.keyboard.press("Tab"); await page.keyboard.up("Shift");
            assert.ok(await page.evaluate(() => document.querySelector("#mobile-navigation").contains(document.activeElement)), "Focus escaped mobile menu");
            await page.keyboard.press("Tab");
            assert.ok(await page.evaluate(() => document.querySelector("#mobile-navigation").contains(document.activeElement)), "Focus did not wrap");
            await page.keyboard.press("Escape");
            await page.waitForFunction(() => document.querySelector('button[aria-controls="mobile-navigation"]').getAttribute("aria-expanded") === "false");
            assert.ok(await trigger.evaluate((e) => document.activeElement === e), "Menu opener lost focus");
          }
        }
        await page.evaluate(() => { window.scrollTo(0, 0); });
        if (["/", "/projects", "/profile"].includes(path)) await page.screenshot({ path: join(dir, `${path === "/" ? "home" : path.slice(1)}-${width}-${dark ? "dark" : "light"}.png`) });
        variants.push({ path, width, dark, status: response.status() });
      }
      console.log(`Browser verified ${width}px, ${dark ? "dark" : "light"}.`);
    }
    assert.deepEqual(errors, []);
    const unexpected = failedResources.filter((r) => !r.url.includes("/_vercel/insights/script.js"));
    assert.deepEqual(unexpected, [], "Unexpected resource failures");
    writeFileSync(join(dir, "validated-local.json"), JSON.stringify({ htmlPages: report.routes.filter((r) => r.status === 200).length, sitemapUrls: report.sitemap.urls.length, variants, schemaVocabularyValidated: true, crawlerPolicyUnchanged: true, pageErrors: errors, consoleErrors, failedResources }, null, 2));
    console.log("HTML, schema terms/domains/entity references, sitemap, metadata, preserved crawler policies and browser checks passed.");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
