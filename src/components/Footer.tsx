import Image from "next/image";
import Link from "next/link";
import { BsEnvelope, BsGithub, BsLinkedin } from "react-icons/bs";
import { profile } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";
import { localePath, type Locale } from "@/lib/i18n/config";

export default function Footer({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const year = new Date().getFullYear();
  const home = localePath(locale, "/");
  const path = (p: string) => localePath(locale, p);
  const section = (id: string) => `${home}#${id}`;
  const socialIcons = { GitHub: BsGithub, LinkedIn: BsLinkedin };

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
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Nassican Group</span>
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
        </div>

        <div className="grid grid-cols-2 gap-8 sm:col-span-2 sm:grid-cols-3">
          <div>
            <div className="mb-3 text-sm font-semibold">{t.footer.content}</div>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
              <li><Link href={path("/projects")} className="hover:underline">{t.nav.projects}</Link></li>
              <li><Link href={path("/blog")} className="hover:underline">{t.nav.blog}</Link></li>
              <li><Link href={section("skills")} className="hover:underline">{t.nav.skills}</Link></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 text-sm font-semibold">{t.footer.background}</div>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
              <li><Link href={section("experience")} className="hover:underline">{t.nav.experience}</Link></li>
              <li><Link href={section("education")} className="hover:underline">{t.footer.education}</Link></li>
              <li><Link href={path("/certificates")} className="hover:underline">{t.footer.certificates}</Link></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 text-sm font-semibold">{t.footer.more}</div>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
              <li><Link href={section("about")} className="hover:underline">{t.nav.about}</Link></li>
              <li><Link href={section("contact")} className="hover:underline">{t.nav.contact}</Link></li>
              <li><a href={profile.cv[0].href} hrefLang="es" download className="hover:underline">{t.footer.cvEs}</a></li>
              <li><a href={profile.cv[1].href} hrefLang="en" download className="hover:underline">{t.footer.cvEn}</a></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-black/10 py-6 text-center text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
        © {year} Nassican. {t.footer.rights}
      </div>
    </footer>
  );
}
