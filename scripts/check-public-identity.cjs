/** Read-only browser/HTML checks against a local production build. No account or DB writes. */
const assert = require("node:assert/strict");
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");
const dir = join(require("node:os").tmpdir(), "nassican-identity-audit");
const qa = join(require("node:os").tmpdir(), "nassican-pricing-qa");
const puppeteer = require(join(qa, "node_modules/puppeteer-core"));
const origin = "http://localhost:3207";
const canonicalOrigin = "https://www.nassican.com";
const name = "Jesús David Benavides Chicaiza";

async function main() {
  mkdirSync(dir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const results = [];
  try {
    // Disable execution before navigating: identity, headings, links and JSON-LD must be in HTML.
    await page.setJavaScriptEnabled(false);
    const sitemapResponse = await fetch(`${origin}/sitemap.xml`);
    assert.equal(sitemapResponse.status, 200);
    const sitemap = await sitemapResponse.text();
    const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => new URL(m[1]));
    for (const path of ["/profile", "/en/profile"]) {
      assert.ok(
        urls.some((url) => url.pathname === path),
        `Sitemap missing ${path}`,
      );
    }
    assert.ok(
      urls.every(
        (url) =>
          url.origin === canonicalOrigin && !/\/api\/|\/precios|\/es(?:\/|$)/.test(url.pathname),
      ),
    );
    for (const url of urls) {
      console.log(`Checking ${url.pathname}`);
      if (url.pathname.endsWith(".pdf")) {
        const document = await fetch(`${origin}${url.pathname}`);
        assert.equal(document.status, 200);
        assert.match(document.headers.get("content-type"), /application\/pdf/);
        results.push({ path: url.pathname, status: 200, document: true });
        continue;
      }
      const response = await page.goto(`${origin}${url.pathname}`, { waitUntil: "domcontentloaded" });
      assert.equal(response.status(), 200, url.href);
      const info = await page.evaluate(() => {
        const graphs = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(
          (s) => {
            const parsed = JSON.parse(s.textContent);
            return parsed["@graph"] ?? [parsed];
          },
        );
        return {
          title: document.title,
          h1: [...document.querySelectorAll("h1")].map((h) => h.textContent),
          description: document.querySelector('meta[name="description"]')?.content,
          canonical: document.querySelector('link[rel="canonical"]')?.href,
          robots: document.querySelector('meta[name="robots"]')?.content,
          ogTitle: document.querySelector('meta[property="og:title"]')?.content,
          twitterTitle: document.querySelector('meta[name="twitter:title"]')?.content,
          body: document.body.textContent,
          graphs,
          links: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
        };
      });
      assert.equal(new URL(info.canonical).pathname, url.pathname);
      assert.equal(info.h1.length, 1, `${url.pathname}: one H1`);
      assert.ok(info.title && info.description && info.ogTitle && info.twitterTitle);
      assert.ok(!/noindex/i.test(info.robots ?? ""), url.pathname);
      const person = info.graphs.filter((node) => node["@type"] === "Person");
      assert.equal(person.length, 1);
      assert.equal(person[0].name, name);
      assert.equal(person[0]["@id"], `${canonicalOrigin}/#person`);
      assert.deepEqual(person[0].alternateName, ["Nassican"]);
      assert.ok(!/\/brand\/|LogoNassican/i.test(person[0].image ?? ""));
      assert.ok(
        person[0].sameAs.every((link) => /^https:\/\/(github.com|www.linkedin.com)\//.test(link)),
      );
      if (["/", "/en", "/profile", "/en/profile"].includes(url.pathname)) {
        assert.ok(info.title.includes("Nassican"));
        assert.ok(info.description.includes("Nassican") && info.description.includes(name));
        assert.ok(info.body.includes(name) && info.body.includes("Nassican"));
        const profilePath = url.pathname.startsWith("/en") ? "/en/profile" : "/profile";
        assert.ok(info.links.includes(profilePath));
      }
      if (url.pathname.endsWith("/profile")) {
        assert.equal(info.h1[0], name);
        const profile = info.graphs.find((node) => node["@type"] === "ProfilePage");
        assert.equal(profile.mainEntity["@id"], person[0]["@id"]);
        assert.ok(info.links.some((href) => href.endsWith("#contact")));
      }
      results.push({
        path: url.pathname,
        status: response.status(),
        title: info.title,
        canonical: info.canonical,
        h1: info.h1.length,
        validJsonLd: true,
        ssr: true,
      });
    }
    const privateRobots = await fetch(`${origin}/robots.txt`).then((r) => r.text());
    assert.match(privateRobots, /Disallow: \//);
    const robots = await fetch(`${origin}/robots.txt`, {
      headers: { "x-forwarded-host": "www.nassican.com" },
    }).then((r) => r.text());
    assert.match(robots, /OAI-SearchBot/);
    assert.match(robots, /GPTBot/);
    // Existing production opt-in choices must remain identical for each crawler group.
    const previousRobots = readFileSync(join(dir, "https-www.nassican.com_robots.txt.txt"), "utf8");
    const policyLines = (text) =>
      text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => /^(User-agent|Allow|Disallow):/.test(s));
    assert.deepEqual(policyLines(robots), policyLines(previousRobots));
    await page.setJavaScriptEnabled(true);
    for (const path of ["/", "/profile", "/en/profile"]) {
      await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 1000 });
        for (const theme of ["light", "dark"]) {
          await page.evaluate(
            (theme) => document.documentElement.classList.toggle("dark", theme === "dark"),
            theme,
          );
          // Let existing theme colour transitions settle before visual inspection.
          await new Promise((resolve) => setTimeout(resolve, 350));
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
            false,
          );
          const stem = path === "/" ? "home" : path.replaceAll("/", "-").slice(1);
          await page.screenshot({
            path: join(dir, `${stem}-${width}-${theme}.png`),
            fullPage: path !== "/",
          });
        }
      }
    }
    await page.goto(`${origin}/profile`, { waitUntil: "domcontentloaded" });
    await page.keyboard.press("Tab");
    assert.ok(await page.evaluate(() => document.activeElement?.tagName === "A"));
    // Follow actual profile links and confirm the existing contact anchor works.
    await page.click('main a[href="/#contact"]');
    await page.waitForSelector("#contact");
    assert.ok(page.url().endsWith("/#contact"));
    const notFound = await fetch(`${origin}/__identity_route_that_does_not_exist__`);
    assert.equal(notFound.status, 404);
    assert.deepEqual(errors, []);
    writeFileSync(
      join(dir, "local-after.json"),
      JSON.stringify(
        {
          results,
          sitemapUrls: urls.length,
          crawlerPolicyPreserved: true,
          localRobotsBlocked: true,
          javascriptDisabledVerified: true,
          responsiveWidths: [1440, 390],
          themes: ["light", "dark"],
          pageErrors: errors,
        },
        null,
        2,
      ),
    );
    console.log(
      `Identity checks passed: ${urls.length} sitemap routes, SSR without JavaScript, canonical/meta/JSON-LD, profile links, preserved crawler policy, genuine 404, keyboard, both themes and widths.`,
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
