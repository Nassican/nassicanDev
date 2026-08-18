import type { MetadataRoute } from "next";
import { profile } from "@/lib/data";
import { absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: absoluteUrl("/"),
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: absoluteUrl("/certificates"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    // The CV PDFs are real indexable documents; low priority so they never
    // outrank the homepage for the owner's name.
    ...profile.cv.map((c) => ({
      url: absoluteUrl(c.href),
      lastModified,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    })),
  ];
}
