import type { Profile } from "./data/profile";
import type { Locale } from "./i18n/config";

export function identityLead(locale: Locale, name: string) {
  return locale === "es"
    ? `Nassican es la marca personal y el portafolio profesional de ${name}.`
    : `Nassican is the personal brand and professional portfolio of ${name}.`;
}
export function identityDescription(locale: Locale, profile: Profile, editorial = "") {
  const lead = identityLead(locale, profile.name);
  const text = editorial.trim();
  if (
    text.toLocaleLowerCase().includes("nassican") &&
    text.toLocaleLowerCase().includes(profile.name.toLocaleLowerCase())
  )
    return text;
  const detail =
    text ||
    (locale === "es"
      ? "Explora sus proyectos de software, tecnologías y trayectoria profesional."
      : "Explore software projects, technologies and professional background.");
  return `${lead} ${detail}`;
}
export function identityTitle(locale: Locale, profile: Profile) {
  return `Nassican | ${profile.name}${profile.title[locale] ? ` · ${profile.title[locale]}` : ""}`;
}
export const includeNassican = (title: string) =>
  /\bnassican\b/i.test(title) ? title : `Nassican | ${title}`;
export function publicProfileLinks(profile: Profile) {
  return profile.socials.filter((link) => {
    try {
      const url = new URL(link.href);
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !["localhost", "127.0.0.1"].includes(url.hostname) &&
        !url.hostname.endsWith(".example.com") &&
        url.hostname !== "example.com"
      );
    } catch {
      return false;
    }
  });
}
