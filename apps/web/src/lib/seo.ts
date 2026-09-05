import type { Metadata } from "next";
import { skills } from "./data";
import type {
  Certificate,
  EducationItem,
  ExperienceItem,
  Post,
  Profile,
  ProjectItem,
} from "./data";

/**
 * Everything the Person graph needs. Bundled rather than passed as four
 * arguments, and passed in rather than imported, so this module stays pure and
 * synchronous now that the content lives in the database.
 */
export type SiteData = {
  profile: Profile;
  experience: ExperienceItem[];
  education: EducationItem[];
  certificates: Certificate[];
};
import { getDictionary } from "./i18n";
import {
  defaultLocale,
  locales,
  localePath,
  openGraphLocale,
  type Locale,
} from "./i18n/config";

/**
 * Canonical origin of the site. Override with NEXT_PUBLIC_SITE_URL when the
 * deployment lives on a preview domain so canonicals/OG URLs stay absolute.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nassican.com"
).replace(/\/$/, "");

export const siteName = "Nassican";

/** Absolute URL helper: every SEO surface needs fully-qualified URLs. */
export const absoluteUrl = (path = "/") =>
  `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;

/** Absolute URL of `path` in a given language. */
export const localeUrl = (locale: Locale, path = "/") =>
  absoluteUrl(localePath(locale, path));

/**
 * `alternates` for a canonical (unprefixed) path: the canonical URL of the
 * current language plus one hreflang entry per language and an x-default.
 * Without these, the two versions compete as duplicate content.
 */
export function alternatesFor(
  locale: Locale,
  path = "/",
): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = localeUrl(l, path);
  languages["x-default"] = localeUrl(defaultLocale, path);

  return {
    canonical: localeUrl(locale, path),
    languages,
  };
}

type PageMetaInput = {
  locale: Locale;
  /** Canonical, unprefixed path, e.g. "/blog/my-post". */
  path: string;
  title: string;
  description: string;
  /** OpenGraph type; defaults to "website". */
  type?: "website" | "article" | "profile";
  publishedTime?: string;
  modifiedTime?: string;
  tags?: string[];
};

/**
 * Builds the metadata every page repeats: canonical, hreflang, OpenGraph and
 * Twitter card. Page files only pass what actually differs.
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  type = "website",
  publishedTime,
  modifiedTime,
  tags,
}: PageMetaInput): Metadata {
  const url = localeUrl(locale, path);

  return {
    title,
    description,
    alternates: alternatesFor(locale, path),
    openGraph: {
      type: type === "profile" ? "profile" : type,
      url,
      siteName,
      locale: openGraphLocale[locale],
      title,
      description,
      ...(type === "article"
        ? { publishedTime, modifiedTime, authors: [siteUrl], tags }
        : null),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: "@Nassican",
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Structured data                                                            */
/* -------------------------------------------------------------------------- */

/** Flat list of skill names, used for Person.knowsAbout. */
const skillNames = Object.values(skills).flat();

/**
 * Entity ids are language-independent on purpose: the same person and the
 * same website publish both language versions, so the graphs reference one
 * `@id` instead of creating a duplicate entity per locale.
 */
const personId = absoluteUrl("/#person");
const websiteId = absoluteUrl("/#website");
const blogId = absoluteUrl("/#blog");

function person(
  locale: Locale,
  { profile, experience, education, certificates }: SiteData,
) {
  const t = getDictionary(locale);

  return {
    "@type": "Person",
    "@id": personId,
    name: profile.name,
    alternateName: ["Nassican", "Jesús Benavides"],
    url: siteUrl,
    email: `mailto:${profile.email}`,
    jobTitle: t.meta.jobTitle,
    description: t.meta.description,
    image: absoluteUrl("/brand/LogoNassican.png"),
    knowsAbout: skillNames,
    knowsLanguage: [...locales],
    address: {
      "@type": "PostalAddress",
      addressLocality: profile.location.city,
      addressRegion: profile.location.region,
      addressCountry: profile.location.country,
    },
    hasOccupation: experience.map((e) => ({
      "@type": "Occupation",
      name: e.title[locale],
      description: e.desc[locale],
      skills: e.stack,
      occupationLocation: {
        "@type": "City",
        name: profile.location.city,
      },
    })),
    worksFor: experience.map((e) => ({
      "@type": "Organization",
      name: e.org,
    })),
    alumniOf: education.map((e) => ({
      "@type": "EducationalOrganization",
      name: e.org,
    })),
    hasCredential: [
      // Completed degrees first, then the shorter course certificates
      ...education
        .filter((e) => e.status === "completed")
        .map((e) => ({
          "@type": "EducationalOccupationalCredential",
          name: e.title[locale],
          credentialCategory: "degree",
          dateCreated: e.end,
          recognizedBy: { "@type": "EducationalOrganization", name: e.org },
        })),
      ...certificates.map((c) => ({
        "@type": "EducationalOccupationalCredential",
        name: c.title[locale],
        url: c.url,
        credentialCategory: "certificate",
        recognizedBy: { "@type": "Organization", name: c.provider },
      })),
    ],
    sameAs: profile.socials.map((s) => s.href),
    // The CV PDFs are documents *about* this Person, one per language
    subjectOf: profile.cv.map((c) => ({
      "@type": "CreativeWork",
      name: `${locale === "es" ? "Currículum de" : "Resume of"} ${profile.name}`,
      alternateName: c.label[locale],
      url: absoluteUrl(c.href),
      encodingFormat: "application/pdf",
      inLanguage: c.lang,
      about: { "@id": personId },
    })),
  };
}

function website(locale: Locale) {
  const t = getDictionary(locale);

  return {
    "@type": "WebSite",
    "@id": websiteId,
    url: siteUrl,
    name: siteName,
    description: t.meta.description,
    inLanguage: [...locales],
    publisher: { "@id": personId },
  };
}

function breadcrumb(locale: Locale, trail: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: getDictionary(locale).breadcrumb.home,
        item: localeUrl(locale, "/"),
      },
      ...trail.map((step, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: step.name,
        item: localeUrl(locale, step.path),
      })),
    ],
  };
}

/** One project as SoftwareSourceCode, reused by the list and the detail page. */
function projectNode(locale: Locale, p: ProjectItem) {
  const c = p.content[locale];

  return {
    "@type": "SoftwareSourceCode",
    "@id": localeUrl(locale, `/projects/${p.slug}`),
    name: p.title,
    headline: c.tagline,
    // Falls back to the tagline while the case study is still unwritten.
    description: c.summary ?? c.tagline,
    url: localeUrl(locale, `/projects/${p.slug}`),
    sameAs: p.demo,
    inLanguage: locale,
    datePublished: p.date,
    programmingLanguage: p.stack,
    keywords: p.stack.join(", "),
    author: { "@id": personId },
    ...(p.repo && p.repo !== "#" ? { codeRepository: p.repo } : {}),
    ...(p.image ? { image: absoluteUrl(p.image) } : {}),
  };
}

function projectList(locale: Locale, projects: ProjectItem[]) {
  return {
    "@type": "ItemList",
    "@id": localeUrl(locale, "/projects") + "#list",
    name: getDictionary(locale).projects.title,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: projects.length,
    itemListElement: projects.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: projectNode(locale, p),
    })),
  };
}

/** Site-wide entities. Emitted once from the root layout on every page. */
export function siteJsonLd(locale: Locale, data: SiteData) {
  return {
    "@context": "https://schema.org",
    "@graph": [person(locale, data), website(locale)],
  };
}

/** Homepage-only graph: the ProfilePage itself plus the project list. */
export function homeJsonLd(locale: Locale, projects: ProjectItem[]) {
  const t = getDictionary(locale);

  return {
    "@context": "https://schema.org",
    "@graph": [
      projectList(locale, projects),
      {
        "@type": "ProfilePage",
        "@id": localeUrl(locale, "/"),
        url: localeUrl(locale, "/"),
        name: t.meta.title,
        description: t.meta.description,
        inLanguage: locale,
        isPartOf: { "@id": websiteId },
        about: { "@id": personId },
        mainEntity: { "@id": personId },
      },
    ],
  };
}

export function certificatesJsonLd(
  locale: Locale,
  certificates: Certificate[],
) {
  const t = getDictionary(locale);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": localeUrl(locale, "/certificates"),
        url: localeUrl(locale, "/certificates"),
        name: t.certificates.title,
        description: t.certificates.metaDescription,
        inLanguage: locale,
        isPartOf: { "@id": websiteId },
        about: { "@id": personId },
      },
      breadcrumb(locale, [
        { name: t.certificates.title, path: "/certificates" },
      ]),
      {
        "@type": "ItemList",
        name: t.certificates.title,
        numberOfItems: certificates.length,
        itemListElement: certificates.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "EducationalOccupationalCredential",
            name: c.title[locale],
            url: c.url,
            credentialCategory: "certificate",
            dateCreated: c.date,
            recognizedBy: { "@type": "Organization", name: c.provider },
            about: c.category[locale],
          },
        })),
      },
    ],
  };
}

export function projectsJsonLd(locale: Locale, projects: ProjectItem[]) {
  const t = getDictionary(locale);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": localeUrl(locale, "/projects"),
        url: localeUrl(locale, "/projects"),
        name: t.projects.listTitle,
        description: t.projects.metaDescription,
        inLanguage: locale,
        isPartOf: { "@id": websiteId },
        about: { "@id": personId },
      },
      breadcrumb(locale, [{ name: t.projects.listTitle, path: "/projects" }]),
      projectList(locale, projects),
    ],
  };
}

export function projectJsonLd(locale: Locale, p: ProjectItem) {
  const t = getDictionary(locale);

  return {
    "@context": "https://schema.org",
    "@graph": [
      projectNode(locale, p),
      breadcrumb(locale, [
        { name: t.projects.listTitle, path: "/projects" },
        { name: p.title, path: `/projects/${p.slug}` },
      ]),
    ],
  };
}

export function blogJsonLd(
  locale: Locale,
  publishedPosts: Post[],
  profile: Profile,
) {
  const t = getDictionary(locale);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": blogId,
        url: localeUrl(locale, "/blog"),
        name: `${t.blog.title} | ${profile.name}`,
        description: t.blog.metaDescription,
        inLanguage: locale,
        isPartOf: { "@id": websiteId },
        author: { "@id": personId },
        publisher: { "@id": personId },
        blogPost: publishedPosts.map((p) => ({
          "@type": "BlogPosting",
          "@id": localeUrl(locale, `/blog/${p.slug}`),
          headline: p.content[locale].title,
          description: p.content[locale].description,
          url: localeUrl(locale, `/blog/${p.slug}`),
          datePublished: p.date,
          dateModified: p.updated ?? p.date,
          inLanguage: locale,
          author: { "@id": personId },
        })),
      },
      breadcrumb(locale, [{ name: t.blog.title, path: "/blog" }]),
    ],
  };
}

export function postJsonLd(locale: Locale, post: Post) {
  const t = getDictionary(locale);
  const c = post.content[locale];
  const url = localeUrl(locale, `/blog/${post.slug}`);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": url,
        mainEntityOfPage: url,
        url,
        headline: c.title,
        description: c.description,
        inLanguage: locale,
        datePublished: post.date,
        dateModified: post.updated ?? post.date,
        keywords: post.tags.join(", "),
        author: { "@id": personId },
        publisher: { "@id": personId },
        isPartOf: { "@id": blogId },
      },
      breadcrumb(locale, [
        { name: t.blog.title, path: "/blog" },
        { name: c.title, path: `/blog/${post.slug}` },
      ]),
    ],
  };
}
