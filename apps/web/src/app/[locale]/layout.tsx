import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/next";
import "../globals.css";
import Navigation from "@/components/Navigation";
import SectionNavigator from "@/components/SectionNavigator";
import Footer from "@/components/Footer";
import { getCertificates } from "@/lib/data/certificates";
import { getEducation } from "@/lib/data/education";
import { getExperience } from "@/lib/data/experience";
import { getProfile } from "@/lib/data/profile";
import { getSeoSettings } from "@/lib/data/seo-settings";
import { getDictionary } from "@/lib/i18n";
import {
  htmlLang,
  isLocale,
  locales,
  openGraphLocale,
  type Locale,
} from "@/lib/i18n/config";
import { alternatesFor, siteJsonLd, siteName, siteUrl } from "@/lib/seo";
import { themeInitScript } from "@/lib/theme";

type LayoutParams = { params: Promise<{ locale: string }> };

/**
 * GA4 measurement id: identifies the data stream the browser sends events to,
 * not the property the admin reads. It is public by design - it ships in the
 * page source - so it belongs in a `NEXT_PUBLIC_` variable rather than a
 * secret. Moves to `seo_settings.ga4_measurement_id` when this app starts
 * reading its configuration from the database.
 */
const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/** One static branch per language; there is no runtime locale detection. */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutParams): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  const [profile, seo] = await Promise.all([getProfile(), getSeoSettings()]);

  /**
   * The dictionary is the fallback, not the source: what the panel writes wins,
   * and an empty field there means "keep what the site already said" rather
   * than blanking the tag.
   */
  const title = seo?.defaultTitle[locale]?.trim() || t.meta.title;
  const description =
    seo?.defaultDescription[locale]?.trim() || t.meta.description;
  const keywords = seo?.keywords[locale]?.length
    ? seo.keywords[locale]
    : t.meta.keywords;

  return {
    // Makes every relative URL below (canonical, OG image) resolve to an absolute one
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: seo?.titleTemplate?.trim() || `%s | ${profile.name}`,
    },
    description,
    keywords,
    ...(seo?.googleSiteVerification
      ? { verification: { google: seo.googleSiteVerification } }
      : {}),
    authors: [{ name: profile.name, url: siteUrl }],
    creator: profile.name,
    publisher: profile.name,
    applicationName: siteName,
    category: "technology",
    alternates: alternatesFor(locale, "/"),
    openGraph: {
      type: "profile",
      url: siteUrl,
      siteName,
      locale: openGraphLocale[locale],
      title,
      description,
      firstName: "Jesús David",
      lastName: "Benavides Chicaiza",
      username: "Nassican",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: "@Nassican",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  colorScheme: "light dark",
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode }> & LayoutParams) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = getDictionary(locale);

  const [profile, experience, education, certificates] = await Promise.all([
    getProfile(),
    getExperience(),
    getEducation(),
    getCertificates(),
  ]);

  return (
    // `scroll-behavior: smooth` on <html> breaks the router's own scroll
    // handling: hash links from another route land at the top instead of on
    // the section. The attribute tells Next to scroll instantly during a
    // route transition and leave smooth scrolling for in-page anchors.
    <html
      lang={htmlLang[locale]}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored theme before paint to avoid a flash of the wrong one */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Site-wide structured data: the Person and the WebSite they publish */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              siteJsonLd(locale, {
                profile,
                experience,
                education,
                certificates,
              }),
            ),
          }}
        />
      </head>
      <body className="antialiased">
        <Navigation locale={locale} t={t} profile={profile} />
        {children}
        <Footer locale={locale} t={t} />
        <SectionNavigator
          previousLabel={t.nav.previousSection}
          nextLabel={t.nav.nextSection}
        />
        {/*
          Analytics only ships from a production build. The variable is scoped
          to Vercel's Production environment, and the NODE_ENV check is the
          backstop that keeps a local `.env.local` from sending development
          sessions into the same property the dashboard reads.
        */}
        {gaMeasurementId && process.env.NODE_ENV === "production" ? (
          <GoogleAnalytics gaId={gaMeasurementId} />
        ) : null}
        {/*
          Vercel Web Analytics measures something GA4 does not: it counts every
          visit without cookies, so it needs no consent banner and is not lost
          to ad blockers, which distort GA4 badly on a developer audience. It
          no-ops outside a Vercel deployment, so it needs no guard.
        */}
        <Analytics />
      </body>
    </html>
  );
}
