import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { serializeJsonLd } from "@nassican/shared";
import { getProfile } from "@/lib/data/profile";
import { getSkillGroups } from "@/lib/data/technologies";
import { getProjectsByDate } from "@/lib/data/projects";
import { getDictionary } from "@/lib/i18n";
import { isLocale, localePath, locales } from "@/lib/i18n/config";
import {
  identityLead,
  identityDescription,
  identityTitle,
  publicProfileLinks,
} from "@/lib/identity";
import { profileJsonLd } from "@/lib/seo";
import { pageMetadata } from "@/lib/page-metadata";
import Experience from "@/components/sections/Experience";
import Education from "@/components/sections/Education";

type Props = { params: Promise<{ locale: string }> };
export const generateStaticParams = () => locales.map((locale) => ({ locale }));
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const profile = await getProfile();
  const meta = await pageMetadata({
    locale,
    path: "/profile",
    title: identityTitle(locale, profile),
    description: identityDescription(locale, profile),
    type: "profile",
    image: profile.avatar,
  });
  return {
    ...meta,
    title: {
      absolute: typeof meta.title === "string" ? meta.title : identityTitle(locale, profile),
    },
  };
}
export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [profile, groups, projects] = await Promise.all([
    getProfile(),
    getSkillGroups(),
    getProjectsByDate(),
  ]);
  const t = getDictionary(locale);
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(profileJsonLd(locale, profile)) }}
      />
      <section className="mx-auto max-w-5xl px-4 pb-10 pt-32">
        <Link href={localePath(locale)} className="text-sm underline underline-offset-4">
          {locale === "es" ? "Inicio" : "Home"}
        </Link>
        <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center">
          {profile.avatar && !/\/brand\/|LogoNassican/i.test(profile.avatar) ? (
            <Image
              src={profile.avatar}
              alt={profile.name}
              width={112}
              height={112}
              unoptimized={/^https?:/.test(profile.avatar)}
              className="h-28 w-28 rounded-full object-cover"
            />
          ) : null}
          <div>
            <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
              {locale === "es" ? "La persona detrás de Nassican" : "The person behind Nassican"}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{profile.name}</h1>
            {profile.title[locale] ? (
              <p className="mt-3 text-lg text-zinc-700 dark:text-zinc-300">
                {profile.title[locale]}
              </p>
            ) : null}
          </div>
        </div>
        <p className="mt-8 max-w-prose text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
          {identityLead(locale, profile.name)}{" "}
          {locale === "es"
            ? "Aquí puedes consultar mi experiencia, formación y proyectos publicados, y los perfiles donde comparto mi trabajo."
            : "Here you can explore my professional experience, education and published projects, along with the profiles where I share my work."}
        </p>
        <div className="mt-6 flex flex-wrap gap-5 text-sm">
          <Link className="underline underline-offset-4" href={localePath(locale, "/projects")}>
            {t.projects.title}
          </Link>
          <Link className="underline underline-offset-4" href={`${localePath(locale)}#contact`}>
            {t.nav.contact}
          </Link>
          {profile.cv.map((cv) => (
            <a
              key={cv.href}
              className="underline underline-offset-4"
              href={cv.href}
              hrefLang={cv.lang}
              download
            >
              {cv.label[locale] || cv.lang}
            </a>
          ))}
        </div>
      </section>
      {groups.length ? (
        <section className="mx-auto max-w-5xl px-4 py-10">
          <h2 className="text-2xl font-semibold">{t.skills.title}</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {groups.map((group) => (
              <div key={group.key}>
                <h3 className="font-semibold">{group.labels[locale] || group.key}</h3>
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                  {group.items.map((item) => (
                    <li key={item.key}>{item.name}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <Experience locale={locale} t={t} />
      <Education locale={locale} t={t} />
      {projects.length ? (
        <section className="mx-auto max-w-5xl px-4 py-10">
          <h2 className="text-2xl font-semibold">{t.projects.title}</h2>
          <ul className="mt-6 divide-y divide-black/10 dark:divide-white/10">
            {projects
              .filter((p) => !p.content[locale].seo.noindex)
              .slice(0, 6)
              .map((project) => (
                <li key={project.slug} className="py-4">
                  <h3 className="font-semibold">
                    <Link
                      className="underline underline-offset-4"
                      href={localePath(locale, `/projects/${project.slug}`)}
                    >
                      {project.title}
                    </Link>
                  </h3>
                  <p className="mt-2 max-w-prose text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {project.content[locale].summary || project.content[locale].tagline}
                  </p>
                </li>
              ))}
          </ul>
          <Link
            className="mt-5 inline-block text-sm underline underline-offset-4"
            href={localePath(locale, "/projects")}
          >
            {locale === "es" ? "Ver todos los proyectos" : "View all projects"}
          </Link>
        </section>
      ) : null}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-2xl font-semibold">
          {locale === "es" ? "Perfiles y contacto" : "Profiles and contact"}
        </h2>
        <ul className="mt-5 flex flex-wrap gap-5 text-sm">
          {publicProfileLinks(profile).map((link) => (
            <li key={link.href}>
              <a
                className="underline underline-offset-4"
                href={link.href}
                target="_blank"
                rel="noreferrer"
              >
                {link.label}
              </a>
            </li>
          ))}
          {profile.email ? (
            <li>
              <a className="underline underline-offset-4" href={`mailto:${profile.email}`}>
                {t.contact.email}
              </a>
            </li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
