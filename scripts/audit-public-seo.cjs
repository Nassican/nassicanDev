/** Read-only HTTP/HTML inventory. Does not authenticate, write DB records or request indexing. */
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const puppeteer = require(join(tmpdir(), "nassican-pricing-qa/node_modules/puppeteer-core"));
const origin = process.env.SEO_AUDIT_ORIGIN || "https://www.nassican.com";
const canonical = "https://www.nassican.com";
const output = join(tmpdir(), "nassican-seo-second-audit", new URL(origin).hostname);

async function request(path) {
  const response = await fetch(new URL(path, origin), { redirect: "manual", signal: AbortSignal.timeout(30000) });
  const body = await response.text();
  return { status: response.status, location: response.headers.get("location"), type: response.headers.get("content-type"), xRobots: response.headers.get("x-robots-tag"), body };
}
async function main() {
  mkdirSync(output, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const report = { origin, canonical, checkedAt: new Date().toISOString(), routes: [], resources: [], externalLinks: [], brokenInternalLinks: [], duplicateTitles: [], duplicateDescriptions: [] };
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    const sitemap = await request("/sitemap.xml");
    writeFileSync(join(output, "sitemap.xml"), sitemap.body);
    report.sitemap = { status: sitemap.status, urls: [...sitemap.body.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]) };
    report.sitemap.validXml = await page.evaluate((xml) => !new DOMParser().parseFromString(xml, "application/xml").querySelector("parsererror"), sitemap.body);
    const robots = await request("/robots.txt");
    report.robots = { status: robots.status, content: robots.body };
    const paths = [...new Set([...report.sitemap.urls.map((url) => new URL(url).pathname), "/", "/projects", "/blog", "/en/blog", "/profile", "/contact", "/__seo_audit_not_found__"])];
    const internal = new Map();
    const external = new Set();
    for (const path of paths) {
      const resource = await request(path);
      if (!resource.type?.includes("text/html")) { report.resources.push({ path, status: resource.status, type: resource.type }); continue; }
      writeFileSync(join(output, `${path.replaceAll("/", "_") || "home"}.html`), resource.body);
      const data = await page.evaluate(({ html, canonical, path }) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const meta = (name) => doc.querySelector(`meta[name="${name}"],meta[property="${name}"]`)?.content;
        const graphs = [], jsonLdErrors = [];
        for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
          try { const value = JSON.parse(script.textContent); graphs.push(...(value["@graph"] || [value])); }
          catch (error) { jsonLdErrors.push(error.message); }
        }
        const ids = graphs.map((n) => n["@id"]).filter(Boolean);
        const links = [...doc.querySelectorAll("a[href]")].map((a) => ({ href: a.getAttribute("href"), text: a.getAttribute("aria-label") || a.textContent.trim() }));
        const marquee = [...doc.querySelectorAll(".marquee-track")].map((track) => {
          const counts = {}; for (const chip of track.children) if (!chip.closest('[aria-hidden="true"], [inert]')) counts[chip.textContent.trim()] = (counts[chip.textContent.trim()] || 0) + 1;
          return counts;
        });
        const headings = [...doc.querySelectorAll("main h1,main h2,main h3,main h4,main h5,main h6")].map((h) => ({ level: Number(h.tagName[1]), text: h.textContent.trim() }));
        const main = doc.querySelector("main")?.cloneNode(true);
        main?.querySelectorAll('script,style,[aria-hidden="true"],[inert]').forEach((e) => e.remove());
        const mainText = main?.textContent.replace(/\s+/g, " ").trim() || "";
        return {
          path, title: doc.title, description: meta("description"), canonical: doc.querySelector('link[rel="canonical"]')?.href,
          robots: meta("robots"), googlebot: meta("googlebot"), ogTitle: meta("og:title"), ogDescription: meta("og:description"), ogUrl: meta("og:url"), ogImage: meta("og:image"), twitterCard: meta("twitter:card"), twitterTitle: meta("twitter:title"), twitterImage: meta("twitter:image"),
          h1: [...doc.querySelectorAll("h1")].map((h) => h.textContent.trim()), headings, mainText, words: mainText.split(/\s+/).length,
          graphs, jsonLdErrors, duplicateEntityIds: ids.filter((id, i) => ids.indexOf(id) !== i), links, marquee,
          images: [...doc.querySelectorAll("img")].map((img) => ({ src: img.getAttribute("src"), alt: img.getAttribute("alt"), width: img.getAttribute("width"), height: img.getAttribute("height"), fill: img.getAttribute("data-nimg") === "fill", sizes: img.getAttribute("sizes") })),
          language: doc.documentElement.lang, hreflang: [...doc.querySelectorAll('link[rel="alternate"][hreflang]')].map((e) => ({ lang: e.hreflang, href: e.href })),
          canonicalExpected: new URL(path, canonical).href,
        };
      }, { html: resource.body, canonical, path });
      report.routes.push({ ...data, status: resource.status, xRobots: resource.xRobots, bytes: Buffer.byteLength(resource.body) });
      for (const link of data.links) {
        try {
          const url = new URL(link.href, canonical + path);
          if (!["http:", "https:"].includes(url.protocol)) continue;
          if (url.origin === canonical) internal.set(url.pathname + url.search, url);
          else external.add(url.href);
        } catch { /* malformed href is retained in route evidence */ }
      }
      console.log(`${resource.status} ${path}: H1=${data.h1.length}, words=${data.words}, entities=${data.graphs.length}`);
    }
    for (const [path] of internal) {
      if (report.routes.some((r) => r.path === path) || report.resources.some((r) => r.path === path)) continue;
      const r = await request(path);
      report.resources.push({ path, status: r.status, location: r.location, type: r.type });
      if (r.status >= 400) report.brokenInternalLinks.push({ path, status: r.status });
    }
    for (const field of ["title", "description"]) {
      const groups = new Map();
      for (const r of report.routes.filter((r) => r.status === 200)) {
        const list = groups.get(r[field]) || []; list.push(r.path); groups.set(r[field], list);
      }
      report[field === "title" ? "duplicateTitles" : "duplicateDescriptions"] = [...groups].filter(([, paths]) => paths.length > 1).map(([value, paths]) => ({ value, paths }));
    }
    report.externalLinks = [...external];
    writeFileSync(join(output, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ output, sitemapUrls: report.sitemap.urls.length, duplicateTitles: report.duplicateTitles, duplicateDescriptions: report.duplicateDescriptions, brokenInternalLinks: report.brokenInternalLinks, externalLinks: external.size }));
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
