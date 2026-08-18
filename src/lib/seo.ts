import {
  profile,
  projects,
  certificates,
  education,
  experience,
  skills,
} from "./data";

/**
 * Canonical origin of the site. Override with NEXT_PUBLIC_SITE_URL when the
 * deployment lives on a preview domain so canonicals/OG URLs stay absolute.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nassican.com"
).replace(/\/$/, "");

export const siteName = "Nassican";

export const locale = "es_CO";

/** Absolute URL helper: every SEO surface needs fully-qualified URLs. */
export const absoluteUrl = (path = "/") =>
  `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;

export const defaultTitle =
  "Jesús David Benavides Chicaiza | Desarrollador Web Full Stack";

export const defaultDescription =
  "Portafolio de Jesús David Benavides Chicaiza (Nassican), desarrollador web full stack en Pasto, Colombia. Proyectos con Next.js, React, TypeScript, NestJS y PostgreSQL.";

export const keywords = [
  "Jesús David Benavides Chicaiza",
  "Nassican",
  "desarrollador web",
  "desarrollador full stack",
  "programador Colombia",
  "desarrollador Pasto",
  "Next.js",
  "React",
  "TypeScript",
  "NestJS",
  "PostgreSQL",
  "ingeniería de sistemas",
  "portafolio desarrollador",
];

/** Flat list of skill names, used for Person.knowsAbout. */
const skillNames = Object.values(skills).flat();

const personId = absoluteUrl("/#person");
const websiteId = absoluteUrl("/#website");

const person = {
  "@type": "Person",
  "@id": personId,
  name: profile.name,
  alternateName: ["Nassican", "Jesús Benavides"],
  url: siteUrl,
  email: `mailto:${profile.email}`,
  jobTitle: "Desarrollador Web Full Stack",
  description: defaultDescription,
  image: absoluteUrl("/brand/LogoNassican.png"),
  knowsAbout: skillNames,
  knowsLanguage: ["es", "en"],
  address: {
    "@type": "PostalAddress",
    addressLocality: "Pasto",
    addressRegion: "Nariño",
    addressCountry: "CO",
  },
  hasOccupation: experience.map((e) => ({
    "@type": "Occupation",
    name: e.title,
    description: e.desc,
    skills: e.stack,
    occupationLocation: {
      "@type": "City",
      name: "Pasto",
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
        name: e.title,
        credentialCategory: "degree",
        dateCreated: e.end,
        recognizedBy: { "@type": "EducationalOrganization", name: e.org },
      })),
    ...certificates.map((c) => ({
      "@type": "EducationalOccupationalCredential",
      name: c.title,
      url: c.url,
      credentialCategory: "certificate",
      recognizedBy: { "@type": "Organization", name: c.provider },
    })),
  ],
  sameAs: profile.socials.map((s) => s.href),
  // The CV PDFs are documents *about* this Person, one per language
  subjectOf: profile.cv.map((c) => ({
    "@type": "CreativeWork",
    name: `Currículum de ${profile.name}`,
    alternateName: c.label,
    url: absoluteUrl(c.href),
    encodingFormat: "application/pdf",
    inLanguage: c.lang,
    about: { "@id": personId },
  })),
};

const website = {
  "@type": "WebSite",
  "@id": websiteId,
  url: siteUrl,
  name: siteName,
  description: defaultDescription,
  inLanguage: "es",
  publisher: { "@id": personId },
};

/** Projects rendered as an ordered list of CreativeWork/SoftwareApplication. */
const projectList = {
  "@type": "ItemList",
  "@id": absoluteUrl("/#projects"),
  name: "Proyectos",
  itemListOrder: "https://schema.org/ItemListOrderDescending",
  numberOfItems: projects.length,
  itemListElement: projects.map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: {
      "@type": "SoftwareSourceCode",
      name: p.title,
      description: p.description,
      url: p.demo,
      programmingLanguage: p.stack,
      author: { "@id": personId },
      // Both are optional on ProjectItem, so only emit them when present
      ...(p.repo && p.repo !== "#" ? { codeRepository: p.repo } : {}),
      ...(p.image ? { image: absoluteUrl(p.image) } : {}),
    },
  })),
};

/** Site-wide entities. Emitted once from the root layout on every page. */
export const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [person, website],
};

/** Homepage-only graph: the ProfilePage itself plus the project list. */
export const homeJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    projectList,
    {
      "@type": "ProfilePage",
      "@id": absoluteUrl("/"),
      url: siteUrl,
      name: defaultTitle,
      description: defaultDescription,
      inLanguage: "es",
      isPartOf: { "@id": websiteId },
      about: { "@id": personId },
      mainEntity: { "@id": personId },
      hasPart: [{ "@id": absoluteUrl("/#projects") }],
    },
  ],
};

export const certificatesJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": absoluteUrl("/certificates"),
      url: absoluteUrl("/certificates"),
      name: "Certificados y cursos",
      description:
        "Certificados y cursos completados por Jesús David Benavides Chicaiza en desarrollo web, Git, frontend e idiomas.",
      inLanguage: "es",
      isPartOf: { "@id": websiteId },
      about: { "@id": personId },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: siteUrl },
        {
          "@type": "ListItem",
          position: 2,
          name: "Certificados",
          item: absoluteUrl("/certificates"),
        },
      ],
    },
    {
      "@type": "ItemList",
      name: "Certificados",
      numberOfItems: certificates.length,
      itemListElement: certificates.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "EducationalOccupationalCredential",
          name: c.title,
          url: c.url,
          credentialCategory: "certificate",
          dateCreated: c.date,
          recognizedBy: { "@type": "Organization", name: c.provider },
          about: c.category,
        },
      })),
    },
  ],
};

