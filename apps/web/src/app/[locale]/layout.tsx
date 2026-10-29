import { isIndexableDeployment, serializeJsonLd } from "@nassican/shared";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "../globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Maintenance from "@/components/Maintenance";
import PreviewBanner from "@/components/PreviewBanner";
import { getCertificates } from "@/lib/data/certificates";
import { getEducation } from "@/lib/data/education";
import { getExperience } from "@/lib/data/experience";
import { getProfile } from "@/lib/data/profile";
import { getSkillGroups } from "@/lib/data/technologies";
import { getSeoSettings } from "@/lib/data/seo-settings";
import { getNavigation, getSiteSettings } from "@/lib/data/site-config";
import { isPreview } from "@/lib/data/preview";
import { getDictionary } from "@/lib/i18n";
import {
  htmlLang,
  isLocale,
  locales,
  localePath,
  openGraphLocale,
  type Locale,
} from "@/lib/i18n/config";
import { absoluteUrl, alternatesFor, localeUrl, siteJsonLd, siteName, siteUrl } from "@/lib/seo";
import { themeInitScript } from "@/lib/theme";

type LayoutParams = { params: Promise<{ locale: string }> };

/**
 * GA4 measurement id: identifies the data stream the browser sends events to,
 * not the property the admin reads. It is public by design - it ships in the
 * page source. Admin settings take precedence; the environment is a fallback.
 */
const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Only a well-formed measurement id is written into the page: it is spliced
 * into an inline script, and it can come from a field in the panel.
 */
const GA_ID = /^G-[A-Z0-9]{4,20}$/;

/** One static branch per language; there is no runtime locale detection. */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutParams): Promise<Metadata> {
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
  const description = seo?.defaultDescription[locale]?.trim() || t.meta.description;
  /**
   * There is no `keywords` here on purpose. Google has ignored
   * `<meta name="keywords">` since 2009, Bing treats it as a weak spam signal,
   * and keeping an editable field for it invited someone to spend an afternoon
   * filling in something that does nothing.
   *
   * The `keywords` that remain in `lib/seo.ts` are a different thing: a
   * schema.org property on Article and CreativeWork, which consumers do read.
   */

  const canIndex = isIndexableDeployment(process.env) && !(await getSiteSettings()).maintenanceMode;
  const images = [
    {
      url: seo?.defaultOgImageUrl
        ? absoluteUrl(seo.defaultOgImageUrl)
        : localeUrl(locale, "/social-image"),
      alt: title,
    },
  ];

  return {
    // Makes every relative URL below (canonical, OG image) resolve to an absolute one
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: seo?.titleTemplate?.trim() || `%s | ${profile.name}`,
    },
    description,
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
      url: localeUrl(locale),
      images,
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
      images,
    },
    robots: {
      // While the site is down for maintenance the only page that exists is
      // the notice, and a notice in the index outlives the maintenance.
      index: canIndex,
      follow: true,
      googleBot: {
        index: canIndex,
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

  const preview = await isPreview();

  const [profile, experience, education, certificates, settings, nav, seo, skillGroups] =
    await Promise.all([
      getProfile(),
      getExperience(),
      getEducation(),
      getCertificates(),
      getSiteSettings(),
      getNavigation(locale),
      getSeoSettings(),
      getSkillGroups(),
    ]);

  return (
    // `scroll-behavior: smooth` on <html> breaks the router's own scroll
    // handling: hash links from another route land at the top instead of on
    // the section. The attribute tells Next to scroll instantly during a
    // route transition and leave smooth scrolling for in-page anchors.
    <html lang={htmlLang[locale]} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before paint to avoid a flash of the wrong one */}
        <script
          dangerouslySetInnerHTML={{
            __html: themeInitScript(settings.defaultTheme),
          }}
        />
        {/* Site-wide structured data: the Person and the WebSite they publish */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(
              siteJsonLd(locale, {
                profile,
                description: seo?.defaultDescription[locale],
                experience,
                education,
                certificates,
                skills: skillGroups.flatMap((g) => g.items.map((item) => item.name)),
              }),
            ),
          }}
        />
      </head>
      <body className="antialiased">
        {settings.maintenanceMode ? (
          <Maintenance t={t} />
        ) : (
          <>
            <Navigation
              locale={locale}
              t={t}
              profile={profile}
              nav={nav}
              copyrightName={settings.copyrightName}
            />
            {children}
            <Footer
              locale={locale}
              t={t}
              nav={nav}
              brandLine={settings.brandLine}
              copyrightName={settings.copyrightName}
            />
            {preview ? <PreviewBanner t={t} back={localePath(locale, "/")} /> : null}
          </>
        )}
        {/*
          Analytics only ships from a production build. The variable is scoped
          to Vercel's Production environment, and the NODE_ENV check is the
          backstop that keeps a local `.env.local` from sending development
          sessions into the same property the dashboard reads.
        */}
        {/*
          Loaded after the page, not with it. `@next/third-parties` preloaded
          gtag.js in the <head> at high priority — 177 KB from another origin
          competing with the page on a phone — and blocking it alone took the
          mobile Lighthouse score of the home page from 66 to 95 (FCP 3.3 s →
          1.9 s, LCP 6.6 s → 2.6 s). `lazyOnload` waits for the load event and
          an idle moment, so the visit is still counted, a moment later. The
          cost is the visitor who leaves before the page finished loading, which
          GA4 already cannot see reliably.
        */}
        {(() => {
          const id = (seo?.ga4MeasurementId || gaMeasurementId || "").trim();
          if (!GA_ID.test(id) || !isIndexableDeployment(process.env)) return null;
          return (
            <>
              <Script id="ga-init" strategy="lazyOnload">
                {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(id)});`}
              </Script>
              <Script
                id="ga"
                strategy="lazyOnload"
                src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
              />
            </>
          );
        })()}
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
