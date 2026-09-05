import type { MetadataRoute } from "next";
import { getProfile } from "@/lib/data/profile";
import { getProjectsByDate } from "@/lib/data/projects";
import { getPublishedPosts } from "@/lib/data/posts";
import { absoluteUrl, localeUrl } from "@/lib/seo";
import { locales } from "@/lib/i18n/config";

type Entry = MetadataRoute.Sitemap[number];

/**
 * One entry per page per language, each carrying the `alternates.languages`
 * map so Google reads the two versions as translations instead of duplicates.
 */
function localizedEntries(
  path: string,
  options: Omit<Entry, "url" | "alternates">,
): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    locales.map((l) => [l, localeUrl(l, path)]),
  );

  return locales.map((locale) => ({
    ...options,
    url: localeUrl(locale, path),
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const profile = await getProfile();
  const publishedPosts = await getPublishedPosts();
  const projectsByDate = await getProjectsByDate();

  return [
    ...localizedEntries("/", {
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    }),
    ...localizedEntries("/projects", {
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    }),
    ...projectsByDate.flatMap((p) =>
      localizedEntries(`/projects/${p.slug}`, {
        lastModified: new Date(p.date),
        changeFrequency: "yearly",
        priority: 0.8,
      }),
    ),
    ...localizedEntries("/blog", {
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    }),
    ...publishedPosts.flatMap((p) =>
      localizedEntries(`/blog/${p.slug}`, {
        lastModified: new Date(p.updated ?? p.date),
        changeFrequency: "yearly",
        priority: 0.7,
      }),
    ),
    ...localizedEntries("/certificates", {
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    }),
    // The CV PDFs are real indexable documents; low priority so they never
    // outrank the homepage for the owner's name. They are language-specific
    // files, not translated routes, so they get no alternates.
    ...profile.cv.map((c) => ({
      url: absoluteUrl(c.href),
      lastModified,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    })),
  ];
}

