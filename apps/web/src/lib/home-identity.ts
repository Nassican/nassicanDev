import "server-only";
import { cache } from "react";
import type { Locale } from "./i18n/config";
import { getProfile } from "./data/profile";
import { getSeoSettings } from "./data/seo-settings";
import { identityDescription, identityTitle, includeNassican } from "./identity";
import { pageMetadata } from "./page-metadata";

/** Metadata and visible/schema identity share the same request-cached sources. */
export const getHomeIdentity = cache(async (locale: Locale) => {
  const [profile, seo] = await Promise.all([getProfile(), getSeoSettings()]);
  const metadata = await pageMetadata({
    locale,
    path: "/",
    title: includeNassican(seo?.defaultTitle[locale] || identityTitle(locale, profile)),
    description: identityDescription(locale, profile, seo?.defaultDescription[locale]),
    type: "profile",
  });
  const title = includeNassican(
    typeof metadata.title === "string" ? metadata.title : identityTitle(locale, profile),
  );
  return {
    profile,
    title,
    description: metadata.description ?? identityDescription(locale, profile),
    metadata: {
      ...metadata,
      title: { absolute: title },
      openGraph: { ...metadata.openGraph, title },
      twitter: { ...metadata.twitter, title },
    },
  };
});
