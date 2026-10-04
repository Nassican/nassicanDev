import { isIndexableDeployment } from "@nassican/shared";
import { getPublishedPosts } from "@/lib/data/posts";
import { getProfile } from "@/lib/data/profile";
import { getSiteSettings } from "@/lib/data/site-config";
import { getDictionary } from "@/lib/i18n";
import { isLocale, locales, type Locale } from "@/lib/i18n/config";
import { localeUrl } from "@/lib/seo";

/**
 * The feed, one per language.
 *
 * It is the cheapest reach this site has and it did not exist: a blog without a
 * feed is invisible to readers and aggregators, which for a technical audience
 * is most of the traffic that is not search.
 *
 * **RSS 2.0 and not Atom**, which is the older and uglier of the two formats and
 * the one every reader handles without a thought. The interesting choice here is
 * not the format.
 */
// Must be a literal: Next reads segment config statically, so it cannot import
// CACHE_SECONDS. Kept equal to it by hand.
export const revalidate = 3600;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** XML has five characters that cannot appear raw, and titles contain three. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "es") as Locale;

  const settings = await getSiteSettings();

  /*
   * A preview deployment and a site under maintenance both answer with an empty
   * feed rather than a 404. A reader that gets a 404 may drop the subscription;
   * one that gets an empty channel simply finds nothing new, which is the truth
   * in both cases.
   */
  const quiet = !isIndexableDeployment(process.env) || settings.maintenanceMode;

  const [posts, profile] = await Promise.all([
    quiet ? Promise.resolve([]) : getPublishedPosts(),
    getProfile(),
  ]);

  const t = getDictionary(locale);
  const blog = localeUrl(locale, "/blog");
  const self = localeUrl(locale, "/rss.xml");

  const items = posts
    .map((post) => {
      const content = post.content[locale];
      const url = localeUrl(locale, `/blog/${post.slug}`);

      return [
        "    <item>",
        `      <title>${escapeXml(content.title)}</title>`,
        `      <link>${url}</link>`,
        // The slug, not the URL: a reader keys its "already seen" list on this,
        // so it has to survive the day a path changes.
        `      <guid isPermaLink="false">${escapeXml(post.slug)}</guid>`,
        `      <pubDate>${new Date(post.date).toUTCString()}</pubDate>`,
        `      <description>${escapeXml(content.description)}</description>`,
        ...post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`),
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(t.blog.title)} · ${escapeXml(profile.name)}</title>`,
    `    <link>${blog}</link>`,
    `    <description>${escapeXml(t.blog.listDescription)}</description>`,
    `    <language>${locale}</language>`,
    // Points at itself, which is how a reader notices the address moved.
    `    <atom:link href="${self}" rel="self" type="application/rss+xml"/>`,
    ...(posts.length > 0
      ? [`    <lastBuildDate>${new Date(posts[0].date).toUTCString()}</lastBuildDate>`]
      : []),
    items,
    "  </channel>",
    "</rss>",
  ]
    .filter(Boolean)
    .join("\n");

  return new Response(body, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      // Same window as the pages it describes, so a published article reaches
      // the feed by the same tag invalidation and not on its own schedule.
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=7200",
    },
  });
}
