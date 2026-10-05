"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { BsChevronDown, BsImage, BsPlus } from "react-icons/bs";
import { Pager, usePage } from "@/components/Pager";
import { fold } from "@/lib/list-filters";
import Toast from "@/components/Toast";
import Unsaved from "@/components/Unsaved";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";
import { useRouter } from "next/navigation";
import { locales, localeNames, type Locale } from "@nassican/shared";
import {
  emptyLocalized,
  missingIn,
  suggestDiplomaAlt,
  diplomasMissingAlt,
  type CertificateDraft,
  type EducationDraft,
  type ExperienceDraft,
  type LocalizedText,
  type ProfileDraft,
} from "@/lib/profile-draft";
import type { ActionResult, CertificatesResult } from "@/app/(panel)/perfil/actions";
import CoverPicker from "@/components/CoverPicker";
import DateField from "@/components/DateField";

const field =
  "w-full rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const label =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500";
const ghost =
  "rounded border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200";
const primary =
  "rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500 disabled:opacity-50";

/** A field with one input per language, side by side. */
function Translated({
  title,
  value,
  onChange,
  multiline,
}: {
  title: string;
  value: LocalizedText;
  onChange: (next: LocalizedText) => void;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={label}>{title}</span>
      <div className="grid gap-2 sm:grid-cols-2">
        {locales.map((locale) => {
          const common = {
            className: field,
            value: value[locale] ?? "",
            placeholder: localeNames[locale],
            onChange: (
              e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
            ) => onChange({ ...value, [locale]: e.target.value }),
          };
          return multiline ? (
            <textarea key={locale} {...common} rows={3} />
          ) : (
            <input key={locale} {...common} />
          );
        })}
      </div>
    </div>
  );
}

function Section({
  title, note, dirty, pending, onSave, children,
}: {
  title: string;
  note?: string;
  dirty: boolean;
  pending: boolean;
  onSave: () => void;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-neutral-900 p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {note ? <p className="mt-0.5 text-xs text-neutral-600">{note}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {dirty ? <Unsaved label={false} /> : null}
          <button type="button" className={primary} disabled={pending} onClick={onSave}>
            {pending ? "Guardando…" : dirty ? "Guardar cambios" : "Guardar"}
          </button>
        </div>
      </header>
      {children}
    </section>
  );
}

function Incomplete({ missing }: { missing: Locale[] }) {
  if (missing.length === 0) return null;
  return (
    <p className="text-[11px] text-amber-500">
      Falta traducción en: {missing.join(", ")}
    </p>
  );
}

export default function ProfileModule({
  profile: initialProfile,
  experience: initialExperience,
  education: initialEducation,
  certificates: initialCertificates,
  technologies,
  actions,
}: {
  profile: ProfileDraft;
  experience: ExperienceDraft[];
  education: EducationDraft[];
  certificates: CertificateDraft[];
  technologies: { key: string; name: string; hex: string }[];
  actions: {
    saveProfile: (d: ProfileDraft) => Promise<ActionResult>;
    saveExperience: (d: ExperienceDraft[]) => Promise<ActionResult>;
    saveEducation: (d: EducationDraft[]) => Promise<ActionResult>;
    saveCertificates: (d: CertificateDraft[]) => Promise<CertificatesResult>;
  };
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [experience, setExperience] = useState(initialExperience);
  const [education, setEducation] = useState(initialEducation);
  const [certificates, setCertificates] = useState(initialCertificates);
  const latest = useRef(certificates);
  useEffect(() => {
    latest.current = certificates;
  }, [certificates]);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const [savedProfile, setSavedProfile] = useState(initialProfile);
  const [savedExperience, setSavedExperience] = useState(initialExperience);
  const [savedEducation, setSavedEducation] = useState(initialEducation);
  const [savedCertificates, setSavedCertificates] = useState(initialCertificates);

  const dirt = {
    profile: isDirty(savedProfile, profile),
    experience: isDirty(savedExperience, experience),
    education: isDirty(savedEducation, education),
    certificates: isDirty(savedCertificates, certificates),
  };

  useUnsavedChanges(Object.values(dirt).some(Boolean));

  /**
   * `commit` moves this section's baseline, and only runs when the action
   * reported success: a save that failed left the row as it was, so the edits
   * are still unsaved and still have to look that way.
   */
  function run<R extends ActionResult>(action: () => Promise<R>, commit?: (outcome: R) => void) {
    setResult(null);
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) {
        commit?.(outcome);
        router.refresh();
      }
    });
  }

  const patch = <T,>(list: T[], index: number, next: Partial<T>): T[] =>
    list.map((item, i) => (i === index ? { ...item, ...next } : item));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Perfil</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Datos personales, experiencia, formación y certificados. Cada sección
          se guarda por separado.
        </p>
      </header>

            {/* ---------------- Perfil ---------------- */}
      <Section
        title="Datos personales"
        note="Nombre, contacto, redes y CV descargable"
        dirty={dirt.profile}
        pending={pending}
        onSave={() =>
          run(
            () => actions.saveProfile(profile),
            () => setSavedProfile(profile),
          )
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className={label}>Nombre completo</span>
            <input
              className={field}
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={label}>Correo</span>
            <input
              className={field}
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {(["city", "region", "country"] as const).map((k) => (
            <div key={k} className="flex flex-col gap-1">
              <span className={label}>
                {k === "city" ? "Ciudad" : k === "region" ? "Región" : "País (ISO)"}
              </span>
              <input
                className={field}
                value={profile.location[k]}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    location: { ...profile.location, [k]: e.target.value },
                  })
                }
              />
            </div>
          ))}
        </div>

        <Translated
          title="Titular profesional"
          value={profile.headline}
          onChange={(headline) => setProfile({ ...profile, headline })}
        />
        <Incomplete missing={missingIn(locales, profile.headline)} />

        <div className="flex flex-col gap-2">
          <span className={label}>Redes</span>
          {profile.socials.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={`${field} max-w-40`}
                value={s.label}
                placeholder="GitHub"
                onChange={(e) =>
                  setProfile({ ...profile, socials: patch(profile.socials, i, { label: e.target.value }) })
                }
              />
              <input
                className={field}
                value={s.href}
                placeholder="https://…"
                onChange={(e) =>
                  setProfile({ ...profile, socials: patch(profile.socials, i, { href: e.target.value }) })
                }
              />
              <button
                type="button"
                className={ghost}
                onClick={() =>
                  setProfile({ ...profile, socials: profile.socials.filter((_, j) => j !== i) })
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className={`${ghost} w-fit`}
            onClick={() =>
              setProfile({ ...profile, socials: [...profile.socials, { label: "", href: "" }] })
            }
          >
            Añadir red
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <span className={label}>CV descargable</span>
          {profile.cvs.map((cv, i) => (
            <div key={i} className="flex flex-col gap-2 rounded border border-neutral-900 p-3">
              <div className="flex gap-2">
                <input
                  className={`${field} max-w-24`}
                  value={cv.lang}
                  placeholder="es"
                  onChange={(e) =>
                    setProfile({ ...profile, cvs: patch(profile.cvs, i, { lang: e.target.value }) })
                  }
                />
                <input
                  className={field}
                  value={cv.href}
                  placeholder="/cv/archivo.pdf"
                  onChange={(e) =>
                    setProfile({ ...profile, cvs: patch(profile.cvs, i, { href: e.target.value }) })
                  }
                />
                <button
                  type="button"
                  className={ghost}
                  onClick={() =>
                    setProfile({ ...profile, cvs: profile.cvs.filter((_, j) => j !== i) })
                  }
                >
                  ×
                </button>
              </div>
              <Translated
                title="Etiqueta del enlace"
                value={cv.label}
                onChange={(l) => setProfile({ ...profile, cvs: patch(profile.cvs, i, { label: l }) })}
              />
            </div>
          ))}
          <button
            type="button"
            className={`${ghost} w-fit`}
            onClick={() =>
              setProfile({
                ...profile,
                cvs: [...profile.cvs, { lang: "", href: "", label: emptyLocalized(locales) }],
              })
            }
          >
            Añadir CV
          </button>
          <p className="text-[11px] text-neutral-600">
            La ruta apunta a un archivo bajo <code>apps/web/public/</code>
          </p>
        </div>
      </Section>

      {/* ---------------- Experiencia ---------------- */}
      <Section
        title="Experiencia"
        note="Historial laboral. El grado universitario va en Formación."
        dirty={dirt.experience}
        pending={pending}
        onSave={() =>
          run(
            () => actions.saveExperience(experience),
            () => setSavedExperience(experience),
          )
        }
      >
        {experience.map((item, i) => (
          <article key={item.id ?? `nuevo-${i}`} className="flex flex-col gap-3 rounded border border-neutral-900 p-3">
            <div className="grid gap-2 sm:grid-cols-4">
              <input
                className={`${field} sm:col-span-2`}
                value={item.org}
                placeholder="Organización"
                onChange={(e) => setExperience(patch(experience, i, { org: e.target.value }))}
              />
              <DateField
                label="de inicio"
                placeholder="Inicio: 2024-08"
                value={item.start}
                onChange={(v) => setExperience(patch(experience, i, { start: v }))}
              />
              <DateField
                label="de fin"
                placeholder="Fin (vacío = actual)"
                value={item.end}
                onChange={(v) => setExperience(patch(experience, i, { end: v }))}
              />
            </div>

            <Translated title="Cargo" value={item.title}
              onChange={(v) => setExperience(patch(experience, i, { title: v }))} />
            <Translated title="Periodo mostrado" value={item.period}
              onChange={(v) => setExperience(patch(experience, i, { period: v }))} />
            <Translated title="Descripción" multiline value={item.description}
              onChange={(v) => setExperience(patch(experience, i, { description: v }))} />
            <Incomplete missing={missingIn(locales, item.title, item.period, item.description)} />

            <div className="flex flex-col gap-1.5">
              <span className={label}>Stack ({item.stack.length})</span>
              <div className="flex flex-wrap gap-1">
                {technologies.map((tech) => {
                  const on = item.stack.includes(tech.key);
                  return (
                    <button
                      key={tech.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setExperience(patch(experience, i, {
                          stack: on
                            ? item.stack.filter((k) => k !== tech.key)
                            : [...item.stack, tech.key],
                        }))
                      }
                      className={`rounded border px-1.5 py-0.5 text-[11px] transition-colors ${
                        on
                          ? "border-neutral-500 bg-neutral-800 text-neutral-100"
                          : "border-neutral-900 text-neutral-600 hover:border-neutral-700"
                      }`}
                    >
                      <span aria-hidden className="mr-1 inline-block size-1.5 rounded-full align-middle" style={{ backgroundColor: tech.hex }} />
                      {tech.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              className={`${ghost} w-fit border-red-900/60 text-red-400`}
              onClick={() => setExperience(experience.filter((_, j) => j !== i))}
            >
              Eliminar
            </button>
          </article>
        ))}
        <button
          type="button"
          className={`${ghost} w-fit`}
          onClick={() =>
            setExperience([...experience, {
              id: null, org: "", start: "", end: "", stack: [],
              title: emptyLocalized(locales), period: emptyLocalized(locales),
              description: emptyLocalized(locales),
            }])
          }
        >
          Añadir experiencia
        </button>
      </Section>

      {/* ---------------- Formación ---------------- */}
      <Section
        title="Formación"
        note="El estado se declara, no se deduce de la fecha: el sitio es estático."
        dirty={dirt.education}
        pending={pending}
        onSave={() =>
          run(
            () => actions.saveEducation(education),
            () => setSavedEducation(education),
          )
        }
      >
        {education.map((item, i) => (
          <article key={item.id ?? `nuevo-${i}`} className="flex flex-col gap-3 rounded border border-neutral-900 p-3">
            <div className="grid gap-2 sm:grid-cols-4">
              <input className={`${field} sm:col-span-2`} value={item.org} placeholder="Institución"
                onChange={(e) => setEducation(patch(education, i, { org: e.target.value }))} />
              <DateField label="de inicio" placeholder="Inicio: 2020" value={item.start}
                onChange={(v) => setEducation(patch(education, i, { start: v }))} />
              <DateField label="de fin" placeholder="Fin: 2026-09-25" value={item.end}
                onChange={(v) => setEducation(patch(education, i, { end: v }))} />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={item.status === "completed"}
                  onChange={(e) =>
                    setEducation(patch(education, i, {
                      status: e.target.checked ? "completed" : "in-progress",
                    }))
                  }
                />
                Terminado
              </label>
              <input className={field} value={item.link} placeholder="Enlace (opcional)"
                onChange={(e) => setEducation(patch(education, i, { link: e.target.value }))} />
            </div>

            <Translated title="Titulación" value={item.degree}
              onChange={(v) => setEducation(patch(education, i, { degree: v }))} />
            <Translated title="Periodo mostrado" value={item.period}
              onChange={(v) => setEducation(patch(education, i, { period: v }))} />
            <Translated title="Descripción" multiline value={item.description}
              onChange={(v) => setEducation(patch(education, i, { description: v }))} />
            <Incomplete missing={missingIn(locales, item.degree, item.period)} />

            <button
              type="button"
              className={`${ghost} w-fit border-red-900/60 text-red-400`}
              onClick={() => setEducation(education.filter((_, j) => j !== i))}
            >
              Eliminar
            </button>
          </article>
        ))}
        <button
          type="button"
          className={`${ghost} w-fit`}
          onClick={() =>
            setEducation([...education, {
              id: null, org: "", start: "", end: "", status: "in-progress", link: "",
              degree: emptyLocalized(locales), period: emptyLocalized(locales),
              description: emptyLocalized(locales),
            }])
          }
        >
          Añadir formación
        </button>
      </Section>

      {/* ---------------- Certificados ---------------- */}
      <Section
        title="Certificados"
        note="La categoría alimenta los filtros de /certificates"
        dirty={dirt.certificates}
        pending={pending}
        onSave={() => {
          const sent = certificates;
          run(
            () => actions.saveCertificates(sent),
            (outcome) => {
              // New rows only get their id on the server. Adopting the saved list
              // gives them one, so the next save updates them instead of deleting
              // and recreating them — unless something was typed while saving,
              // which has to stay on screen and stay unsaved.
              if (outcome.certificates && !isDirty(sent, latest.current)) {
                setCertificates(outcome.certificates);
                setSavedCertificates(outcome.certificates);
              } else {
                setSavedCertificates(sent);
              }
            },
          );
        }}
      >
        <CertificateList items={certificates} onChange={setCertificates} />
      </Section>

      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}

const CERTIFICATES_PER_PAGE = 12;

/** What a row still needs before the site can show it whole, in a few words. */
function certificateProblems(item: CertificateDraft): string[] {
  const problems: string[] = [];
  if (!item.provider.trim() || !item.url.trim()) problems.push("proveedor o URL");
  const translations = missingIn(locales, item.title, item.category);
  if (translations.length > 0) problems.push(`traducción (${translations.join(", ")})`);
  if (diplomasMissingAlt([item], locales).length > 0) problems.push("texto alternativo");
  return problems;
}

/**
 * Certificates as rows, one open at a time.
 *
 * Thirty-seven full forms stacked meant scrolling past thirty-six of them to
 * reach the one that needed fixing. A row says enough to find it — the
 * diploma, the title, where and when, and what is missing — and opens in place.
 * Search, the filter and the pages only decide what is shown: the section
 * still saves the whole list, hidden rows included.
 */
function CertificateList({
  items,
  onChange,
}: {
  items: CertificateDraft[];
  onChange: Dispatch<SetStateAction<CertificateDraft[]>>;
}) {
  const [query, setQuery] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  // A new row has no id until it is saved; its place in the list stands in.
  const keyOf = (item: CertificateDraft, index: number) => item.id ?? `nuevo-${index}`;

  const incomplete = items.filter((item) => certificateProblems(item).length > 0).length;
  const needle = fold(query);
  const shown = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !onlyIncomplete || certificateProblems(item).length > 0)
    .filter(
      ({ item }) =>
        !needle ||
        fold([item.title.es, item.title.en, item.provider, item.category.es, item.dateLabel].join(" ")).includes(
          needle,
        ),
    );
  const { rows, page, pages, setPage, from, total } = usePage(shown, CERTIFICATES_PER_PAGE);

  // Reads the list as it is when called: an upload finishes after the click
  // that started it, and the form stays editable meanwhile.
  const update = (index: number, next: (item: CertificateDraft) => Partial<CertificateDraft>) =>
    onChange((current) => current.map((item, i) => (i === index ? { ...item, ...next(item) } : item)));

  function add() {
    setQuery("");
    setOnlyIncomplete(false);
    setOpen(`nuevo-${items.length}`);
    setPage(Math.floor(items.length / CERTIFICATES_PER_PAGE));
    onChange((current) => [
      ...current,
      {
        id: null,
        provider: "",
        dateLabel: "",
        url: "",
        title: emptyLocalized(locales),
        category: emptyLocalized(locales),
        fileMediaId: null,
        imageUrl: null,
        alt: emptyLocalized(locales),
      },
    ]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          className={`${field} min-w-0 flex-1 sm:max-w-xs`}
          placeholder="Buscar por título, proveedor o categoría"
          aria-label="Buscar certificados"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        {incomplete > 0 || onlyIncomplete ? (
          <button
            type="button"
            aria-pressed={onlyIncomplete}
            onClick={() => {
              setOnlyIncomplete(!onlyIncomplete);
              setPage(0);
            }}
            className={`${ghost} ${onlyIncomplete ? "border-amber-700 text-amber-400" : ""}`}
          >
            Incompletos · {incomplete}
          </button>
        ) : null}
        <button type="button" className={`${ghost} inline-flex items-center gap-1 sm:ml-auto`} onClick={add}>
          <BsPlus className="h-4 w-4" aria-hidden />
          Añadir certificado
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-neutral-900 px-3 py-6 text-center text-sm text-neutral-500">
          {items.length === 0
            ? "Todavía no hay certificados."
            : `Ningún certificado coincide. Hay ${items.length} en total.`}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
          {rows.map(({ item, index }) => {
            const key = keyOf(item, index);
            const expanded = open === key;
            const problems = certificateProblems(item);
            const panel = `certificado-${key}`;
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panel}
                  onClick={() => setOpen(expanded ? null : key)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-neutral-900/50 ${
                    expanded ? "bg-neutral-900/50" : ""
                  }`}
                >
                  <span className="relative flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-neutral-800 bg-neutral-950">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt="" fill sizes="48px" unoptimized className="object-cover" />
                    ) : (
                      <BsImage className="h-3.5 w-3.5 text-neutral-600" aria-hidden />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm text-neutral-100">
                      {item.title.es.trim() || item.title.en.trim() || "Certificado sin título"}
                    </span>
                    <span className="truncate text-[11px] text-neutral-500">
                      {[item.provider.trim(), item.dateLabel.trim(), item.category.es.trim()]
                        .filter(Boolean)
                        .join(" · ") || "Sin datos todavía"}
                    </span>
                  </span>
                  {problems.length > 0 ? (
                    <span className="shrink-0 text-[11px] text-amber-500">
                      <span className="hidden sm:inline">Falta {problems[0]}</span>
                      <span className="sm:hidden">Incompleto</span>
                    </span>
                  ) : null}
                  <BsChevronDown
                    className={`h-3 w-3 shrink-0 text-neutral-500 transition-transform ${expanded ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>

                {expanded ? (
                  <div id={panel} className="flex flex-col gap-3 border-t border-neutral-900 px-3 py-3">
                    <CoverPicker
                      url={item.imageUrl}
                      emptyLabel="sin diploma"
                      onChange={(media) =>
                        update(index, (now) =>
                          media
                            ? {
                                fileMediaId: media.id,
                                imageUrl: media.url,
                                // A new picture starts with a suggested description
                                // rather than an empty one. It is a draft to edit.
                                alt:
                                  missingIn(locales, now.alt).length === locales.length
                                    ? suggestDiplomaAlt(now)
                                    : now.alt,
                              }
                            : { fileMediaId: null, imageUrl: null },
                        )
                      }
                    />

                    <div className="grid gap-2 sm:grid-cols-4">
                      <input
                        className={field}
                        value={item.provider}
                        placeholder="Proveedor"
                        aria-label="Proveedor"
                        onChange={(e) => update(index, () => ({ provider: e.target.value }))}
                      />
                      <input
                        className={field}
                        value={item.dateLabel}
                        placeholder="Año: 2024"
                        aria-label="Año"
                        onChange={(e) => update(index, () => ({ dateLabel: e.target.value }))}
                      />
                      <input
                        className={`${field} sm:col-span-2`}
                        value={item.url}
                        placeholder="URL del diploma"
                        aria-label="URL del diploma"
                        onChange={(e) => update(index, () => ({ url: e.target.value }))}
                      />
                    </div>

                    <Translated title="Título" value={item.title} onChange={(v) => update(index, () => ({ title: v }))} />
                    <Translated
                      title="Categoría"
                      value={item.category}
                      onChange={(v) => update(index, () => ({ category: v }))}
                    />
                    <Incomplete missing={missingIn(locales, item.title, item.category)} />

                    {item.fileMediaId ? (
                      <>
                        <Translated
                          title="Texto alternativo del diploma"
                          multiline
                          value={item.alt}
                          onChange={(v) => update(index, () => ({ alt: v }))}
                        />
                        <Incomplete missing={missingIn(locales, item.alt)} />
                      </>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        className={`${ghost} border-red-900/60 text-red-400`}
                        onClick={() => {
                          setOpen(null);
                          onChange((current) => current.filter((_, i) => i !== index));
                        }}
                      >
                        Eliminar
                      </button>
                      <button type="button" className={ghost} onClick={() => setOpen(null)}>
                        Cerrar
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Pager
        page={page}
        pages={pages}
        from={from}
        shown={rows.length}
        total={total}
        label="certificados"
        onPage={(next) => {
          setPage(next);
          setOpen(null);
        }}
      />
    </div>
  );
}
