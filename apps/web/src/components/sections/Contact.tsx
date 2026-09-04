import { statSync } from "node:fs";
import path from "node:path";
import type { ComponentType } from "react";
import {
  BsArrowUpRight,
  BsDownload,
  BsEnvelope,
  BsFiletypePdf,
  BsGithub,
  BsLinkedin,
} from "react-icons/bs";
import SectionTitle from "@/components/ui/SectionTitle";
import { profile } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";
import { localeNames, type Locale } from "@/lib/i18n/config";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

/** Bootstrap Icons, the same family the nav and Education already use. */
const socialIcons: Record<string, IconType> = {
  GitHub: BsGithub,
  LinkedIn: BsLinkedin,
};

/**
 * Reads the real size of a file in /public at build time, so the listed weight
 * never drifts from the PDF that is actually served.
 */
function fileSize(href: string) {
  try {
    const bytes = statSync(path.join(process.cwd(), "public", href)).size;
    return `${Math.round(bytes / 1024)} KB`;
  } catch {
    return null;
  }
}

const cvFiles = profile.cv.map((c) => ({ ...c, size: fileSize(c.href) }));

export default function Contact({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const channels = [
    {
      icon: BsEnvelope,
      label: t.contact.email,
      value: profile.email,
      href: `mailto:${profile.email}`,
      external: false,
    },
    ...profile.socials.map((s) => ({
      icon: socialIcons[s.label] ?? BsArrowUpRight,
      label: s.label,
      value: s.href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""),
      href: s.href,
      external: true,
    })),
  ];

  return (
    <section
      id="contact"
      className="mx-auto max-w-5xl scroll-mt-24 px-4 py-16 md:scroll-mt-28"
    >
      <SectionTitle className="mb-4">{t.contact.title}</SectionTitle>
      <p className="mb-8 max-w-[55ch] text-zinc-700 dark:text-zinc-300">
        {t.contact.intro}
      </p>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/50 backdrop-blur-sm dark:border-white/10 dark:bg-black/40 md:col-span-3">
          <ul className="flex flex-1 flex-col divide-y divide-black/5 dark:divide-white/10">
            {channels.map(({ icon: Icon, label, value, href, external }) => (
              <li key={label} className="flex-1">
                <a
                  href={href}
                  aria-label={label}
                  {...(external
                    ? { target: "_blank", rel: "noreferrer" }
                    : null)}
                  className="group flex h-full items-center gap-4 px-5 py-4 transition hover:bg-zinc-900/5 dark:hover:bg-white/5"
                >
                  <Icon
                    className="h-5 w-5 shrink-0 text-zinc-500 transition group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block truncate text-sm text-zinc-600 dark:text-zinc-400">
                      {value}
                    </span>
                  </span>
                  <BsArrowUpRight
                    className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-zinc-900 dark:group-hover:text-zinc-100"
                    aria-hidden
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col rounded-2xl border border-black/10 bg-white/50 p-5 backdrop-blur-sm dark:border-white/10 dark:bg-black/40 md:col-span-2">
          <h3 className="text-sm font-medium">{t.contact.resumeTitle}</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t.contact.resumeSubtitle}
          </p>
          <ul className="mt-4 flex flex-1 flex-col gap-2">
            {cvFiles.map((c) => (
              <li key={c.lang}>
                <a
                  href={c.href}
                  hrefLang={c.lang}
                  type="application/pdf"
                  download
                  aria-label={`${t.contact.download} ${c.label[locale]}`}
                  className="group flex items-center gap-3 rounded-xl border border-black/10 px-3 py-3 transition hover:border-zinc-700 hover:bg-zinc-900/5 dark:border-white/10 dark:hover:border-zinc-200 dark:hover:bg-white/5"
                >
                  <BsFiletypePdf
                    className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {localeNames[c.lang as Locale] ?? c.lang}
                    </span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                      PDF{c.size ? ` · ${c.size}` : ""}
                    </span>
                  </span>
                  <BsDownload
                    className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-y-0.5 group-hover:text-zinc-900 dark:group-hover:text-zinc-100"
                    aria-hidden
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
