import type { Localized } from "@/lib/i18n/config";

export type CvFile = {
  /** ISO 639-1 code, used for hrefLang and the schema's inLanguage. */
  lang: string;
  label: Localized<string>;
  href: string;
};

export type SocialLink = {
  label: string;
  href: string;
};

export const profile = {
  name: "Jesús David Benavides Chicaiza",
  title: {
    es: "Ingeniero de Sistemas",
    en: "Systems Engineer",
  } satisfies Localized<string>,
  email: "contacto@nassican.com",
  location: {
    city: "Pasto",
    region: "Nariño",
    country: "CO",
  },
  socials: [
    { label: "GitHub", href: "https://github.com/Nassican" },
    {
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/jesusbenavidesmark/",
    },
  ] satisfies SocialLink[],
  /** Downloadable CV, one file per language. */
  cv: [
    {
      lang: "es",
      label: { es: "CV en español", en: "Resume in Spanish" },
      href: "/cv/cv-jesus-benavides-desarrollador-es.pdf",
    },
    {
      lang: "en",
      label: { es: "CV en inglés", en: "Resume in English" },
      href: "/cv/cv-jesus-benavides-developer-en.pdf",
    },
  ] satisfies CvFile[],
};
