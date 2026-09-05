import { notFound } from "next/navigation";
import type { HomeSectionKey } from "@nassican/shared";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Skills from "@/components/sections/Skills";
import Experience from "@/components/sections/Experience";
import Education from "@/components/sections/Education";
import Projects from "@/components/sections/Projects";
import Contact from "@/components/sections/Contact";
import LatestPosts from "@/components/sections/LatestPosts";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import { isLocale, locales, type Locale } from "@/lib/i18n/config";
import { homeJsonLd } from "@/lib/seo";
import { getProjectsByDate } from "@/lib/data/projects";
import { getHomeSections, getSiteSettings } from "@/lib/data/site-config";

type PageParams = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function Home({ params }: PageParams) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  const [projects, sections, settings] = await Promise.all([
    getProjectsByDate(),
    getHomeSections(),
    getSiteSettings(),
  ]);

  /**
   * The components stay in code and only their order is data.
   *
   * A section is a React component with its own queries and layout, not
   * content; what the panel decides is where it goes and whether it appears at
   * all. Keeping the map exhaustive means adding a section to the union
   * without adding it here fails to compile rather than rendering nothing.
   */
  const render: Record<HomeSectionKey, () => React.ReactNode> = {
    hero: () => <Hero key="hero" locale={locale as Locale} t={t} />,
    about: () => <About key="about" t={t} />,
    skills: () => <Skills key="skills" t={t} />,
    experience: () => <Experience key="experience" locale={locale as Locale} t={t} />,
    education: () => <Education key="education" locale={locale as Locale} t={t} />,
    projects: () => <Projects key="projects" locale={locale as Locale} t={t} />,
    blog: () => (
      <LatestPosts
        key="blog"
        locale={locale as Locale}
        t={t as Dictionary}
        count={settings.latestPostsCount}
      />
    ),
    contact: () => <Contact key="contact" locale={locale as Locale} t={t} />,
  };

  return (
    <main className="mx-auto max-w-full">
      {/* ProfilePage + project list; the Person/WebSite graph lives in the layout */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homeJsonLd(locale, projects)),
        }}
      />
      {sections
        .filter((section) => section.isVisible)
        .map((section) => render[section.key]())}
    </main>
  );
}
