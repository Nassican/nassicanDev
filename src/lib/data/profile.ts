export type CvFile = {
  /** ISO 639-1 code, used for hrefLang and the schema's inLanguage. */
  lang: string;
  label: string;
  href: string;
};

export type SocialLink = {
  label: string;
  href: string;
};

export const profile = {
  name: "Jesús David Benavides Chicaiza",
  title: "Ingeniero de Sistemas",
  email: "contacto@nassican.com",
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
      label: "CV en español",
      href: "/cv/cv-jesus-benavides-desarrollador-es.pdf",
    },
    {
      lang: "en",
      label: "CV in English",
      href: "/cv/cv-jesus-benavides-developer-en.pdf",
    },
  ] satisfies CvFile[],
};
