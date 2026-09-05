import Image from "next/image";
import Link from "next/link";
import { BsEnvelope, BsGithub, BsLinkedin } from "react-icons/bs";
import type { NavLink, NavTree } from "@nassican/shared";
import { getProfile } from "@/lib/data/profile";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { isExternalLink, navHref } from "@/lib/nav";

export default async function Footer({
  locale,
  t,
  nav,
  brandLine,
  copyrightName,
}: {
  locale: Locale;
  t: Dictionary;
  nav: NavTree;
  brandLine: string;
  copyrightName: string;
}) {
  const profile = await getProfile();
  const year = new Date().getFullYear();
  const socialIcons = { GitHub: BsGithub, LinkedIn: BsLinkedin };

  // The footer never renders on top of the homepage's own sections, so a
  // section link always needs the homepage in front of the hash.
  const href = (link: NavLink) => navHref(link, locale, false);

  return (
    <footer className="mt-24 border-t border-black/10 bg-zinc-50 text-zinc-900 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-12 sm:grid-cols-3">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Image
              src="/brand/LogoNassican.png"
              width={32}
              height={32}
              alt="Nassican"
              className="h-8 w-8 rounded-full bg-white ring-1 ring-black/10 dark:ring-white/20"
            />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide">{profile.name}</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{brandLine}</span>
            </div>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t.footer.tagline}</p>
          <div className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
            {profile.socials.map((social) => {
              const Icon = socialIcons[social.label as keyof typeof socialIcons];
              if (!Icon) return null;
              return (
                <a
                  key={social.label}
                  aria-label={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 transition-colors hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </a>
              );
            })}
            <a
              aria-label={t.contact.email}
              href={`mailto:${profile.email}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 transition-colors hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            >
              <BsEnvelope className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
          {/* The CVs sit with the name and the socials rather than in a menu
              column: they are documents about the person, and `download` plus
              `hrefLang` is not something the link editor can express. */}
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            <li><a href={profile.cv[0].href} hrefLang="es" download aria-label={`${t.contact.download} ${profile.cv[0].label[locale]}`} className="hover:underline">{t.footer.cvEs}</a></li>
            <li><a href={profile.cv[1].href} hrefLang="en" download aria-label={`${t.contact.download} ${profile.cv[1].label[locale]}`} className="hover:underline">{t.footer.cvEn}</a></li>
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:col-span-2 sm:grid-cols-3">
          {nav.footer.map((column) => (
            <div key={column.id}>
              <div className="mb-3 text-sm font-semibold">{column.label}</div>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                {column.items.map((link) => (
                  <li key={link.id}>
                    {isExternalLink(link) ? (
                      <a
                        href={link.target}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={link.ariaLabel ?? undefined}
                        className="hover:underline"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={href(link)}
                        aria-label={link.ariaLabel ?? undefined}
                        className="hover:underline"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-black/10 py-6 text-center text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
        © {year} {copyrightName}. {t.footer.rights}
      </div>
    </footer>
  );
}
