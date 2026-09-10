import assert from "node:assert/strict";
import test from "node:test";
import { absoluteUrl, alternatesFor, pageMetadata, postJsonLd, siteJsonLd, type SiteData } from "./seo";
import type { Post } from "./data/posts/types";
import { buildDiscoveryEntries } from "./discovery";

test("discovery includes custom pages, omits missing/noindex translations, and never invents modification dates", () => {
  const updatedAt = new Date("2026-09-02T15:00:00Z");
  const entries = buildDiscoveryEntries([
    { route: "/services", kind: "custom", translations: [{ locale: "es", title: "Servicios", seoDescription: "Servicios web", noindex: false, updatedAt }] },
    { route: "/certificates", kind: "system", translations: [{ locale: "es", title: "Certificados", seoDescription: null, noindex: true, updatedAt }] },
  ], [
    { slug: "article", date: "2026-09-01", updated: "2026-09-03", content: { es: { seo: { noindex: true } }, en: { seo: { noindex: false } } } },
  ], []);
  assert.deepEqual(entries.filter((e) => e.path === "/services").map((e) => e.locale), ["es"]);
  assert.equal(entries.find((e) => e.path === "/services")?.updated, updatedAt.toISOString());
  assert.ok(!entries.some((e) => e.path === "/certificates" && e.locale === "es"));
  assert.deepEqual(entries.filter((e) => e.path === "/blog/article").map((e) => e.locale), ["en"]);
  assert.equal(entries.find((e) => e.path === "/blog/article")?.updated, "2026-09-03");
  assert.equal(entries.find((e) => e.path === "/")?.updated, undefined);
});

test("external media URLs are preserved, local ones resolve against the canonical origin", () => {
  assert.equal(absoluteUrl("https://cdn.example.com/cover.png"), "https://cdn.example.com/cover.png");
  assert.ok(absoluteUrl("/media/cover.png").endsWith("/media/cover.png"));
});

test("noindex and deployment restrictions also apply to Googlebot", () => {
  for (const input of [{ override: { noindex: true } }, { indexable: false }]) {
    const meta = pageMetadata({ locale: "es", path: "/blog/test", title: "Test", description: "Description", ...input });
    assert.equal(typeof meta.robots, "object");
    assert.equal((meta.robots as { index: boolean }).index, false);
    assert.equal((meta.robots as { googleBot: { index: boolean } }).googleBot.index, false);
  }
});

test("editorial SEO overrides and selected images reach Open Graph and Twitter", () => {
  const meta = pageMetadata({ locale: "en", path: "/blog/test", title: "Visible", description: "Excerpt", image: "https://cdn.example.com/cover.png", override: { title: "Search title", description: "Search description", noindex: false } });
  assert.equal(meta.title, "Search title");
  assert.equal(meta.description, "Search description");
  assert.deepEqual(meta.openGraph?.images, [{ url: "https://cdn.example.com/cover.png", alt: "Search title" }]);
  assert.deepEqual(meta.twitter?.images, meta.openGraph?.images);
});

test("hreflang excludes noindex or missing translations without losing self canonical", () => {
  const meta = alternatesFor("en", "/about", ["en"]);
  assert.deepEqual(meta.languages, { en: absoluteUrl("/en/about") });
  assert.equal(meta.canonical, absoluteUrl("/en/about"));
  assert.ok(alternatesFor("es", "/about").languages?.["x-default"]);
});

test("Person uses editable headline and only current employers", () => {
  const data: SiteData = {
    profile: { name: "Author", title: { es: "Desarrollador", en: "Developer" }, email: "author@example.com", location: { city: "Bogotá", region: "Bogotá", country: "CO" }, socials: [], cv: [] },
    experience: [
      { org: "Previous", start: "2020", end: "2021", period: { es: "2020–2021", en: "2020–2021" }, title: { es: "Dev", en: "Dev" }, desc: { es: "", en: "" }, stack: [] },
      { org: "Current", start: "2022", period: { es: "2022–hoy", en: "2022–present" }, title: { es: "Dev", en: "Dev" }, desc: { es: "", en: "" }, stack: [] },
    ], education: [], certificates: [],
  };
  const person = siteJsonLd("en", data)["@graph"][0];
  assert.ok("worksFor" in person);
  assert.equal(person.jobTitle, "Developer");
  assert.deepEqual(person.worksFor, [{ "@type": "Organization", name: "Current" }]);
});

test("article structured data includes its cover and actual update date", () => {
  const translation = { title: "Article", description: "Excerpt", body: [], seo: { noindex: false } };
  const post: Post = { slug: "test", date: "2026-09-01", updated: "2026-09-08", image: "https://cdn.example.com/post.png", tags: [], content: { es: translation, en: translation } };
  const article = postJsonLd("es", post)["@graph"][0];
  assert.ok("dateModified" in article);
  assert.equal(article.dateModified, "2026-09-08");
  assert.equal(article.image, post.image);
});
