import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import Navigation from "@/components/Navigation";
import SectionNavigator from "@/components/SectionNavigator";
import Footer from "@/components/Footer";
import { profile } from "@/lib/data";
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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

type LayoutParams = { params: Promise<{ locale: string }> };

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

  return {
    // Makes every relative URL below (canonical, OG image) resolve to an absolute one
    metadataBase: new URL(siteUrl),
    title: {
      default: t.meta.title,
      template: `%s | ${profile.name}`,
    },
    description: t.meta.description,
    keywords: t.meta.keywords,
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
      title: t.meta.title,
      description: t.meta.description,
      firstName: "Jesús David",
      lastName: "Benavides Chicaiza",
      username: "Nassican",
    },
    twitter: {
      card: "summary_large_image",
      title: t.meta.title,
      description: t.meta.description,
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
            __html: JSON.stringify(siteJsonLd(locale)),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Navigation locale={locale} t={t} />
        {children}
        <Footer locale={locale} t={t} />
        <SectionNavigator
          previousLabel={t.nav.previousSection}
          nextLabel={t.nav.nextSection}
        />
      </body>
    </html>
  );
}
