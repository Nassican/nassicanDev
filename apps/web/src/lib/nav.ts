import type { NavLink } from "@nassican/shared";
import { localePath, type Locale } from "@/lib/i18n/config";

/**
 * Turns a stored link into an href.
 *
 * Pure and free of database imports on purpose: the header is a client
 * component and the footer is a server one, and both need the same answer.
 *
 * A section link depends on where the visitor already is. The sections only
 * exist on the homepage, so from any other route a bare `#about` would resolve
 * against the current path and go nowhere.
 */
export function navHref(link: NavLink, locale: Locale, isHome: boolean): string {
  switch (link.kind) {
    case "external":
      return link.target;
    case "section":
      return isHome
        ? `#${link.target}`
        : `${localePath(locale, "/")}#${link.target}`;
    default:
      return localePath(locale, link.target);
  }
}

/** External links leave the site, so they get the target/rel pair. */
export const isExternalLink = (link: NavLink) => link.kind === "external";

/**
 * Whether a link points at the page being rendered.
 *
 * Section links are only ever active on the homepage, and which one is active
 * there is decided by the scroll observer rather than by the path.
 */
export function isCurrentLink(
  link: NavLink,
  canonicalPath: string,
  activeSection: string,
  isHome: boolean,
): boolean {
  if (link.kind === "external") return false;
  if (link.kind === "section") return isHome && activeSection === link.target;
  return (
    canonicalPath === link.target ||
    canonicalPath.startsWith(`${link.target}/`)
  );
}
