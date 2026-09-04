import type { MetadataRoute } from "next";

/**
 * A management panel has no business being indexed. This is belt and braces
 * with the `robots` metadata in the layout: one covers the crawler, the other
 * covers pages that set their own metadata.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
