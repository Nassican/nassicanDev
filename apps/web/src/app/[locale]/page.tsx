import { notFound } from "next/navigation";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Skills from "@/components/sections/Skills";
import Experience from "@/components/sections/Experience";
import Education from "@/components/sections/Education";
import Projects from "@/components/sections/Projects";
import Contact from "@/components/sections/Contact";
import LatestPosts from "@/components/sections/LatestPosts";
import { getDictionary } from "@/lib/i18n";
import { isLocale, locales } from "@/lib/i18n/config";
import { homeJsonLd } from "@/lib/seo";
import { getProjectsByDate } from "@/lib/data/projects";

type PageParams = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function Home({ params }: PageParams) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <main className="mx-auto max-w-full">
      {/* ProfilePage + project list; the Person/WebSite graph lives in the layout */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homeJsonLd(locale, await getProjectsByDate())),
        }}
      />
      <Hero locale={locale} t={t} />
      <About t={t} />
      <Skills t={t} />
      <Experience locale={locale} t={t} />
      <Education locale={locale} t={t} />
      <Projects locale={locale} t={t} />
      <LatestPosts locale={locale} t={t} />
      <Contact locale={locale} t={t} />
    </main>
  );
}
