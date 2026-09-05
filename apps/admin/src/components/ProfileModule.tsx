"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { locales, localeNames, type Locale } from "@nassican/shared";
import {
  emptyLocalized,
  missingIn,
  type CertificateDraft,
  type EducationDraft,
  type ExperienceDraft,
  type LocalizedText,
  type ProfileDraft,
} from "@/lib/profile-draft";
import type { ActionResult } from "@/app/(panel)/perfil/actions";

const field =
  "w-full rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-700 focus:border-neutral-600 focus:outline-none";
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
        <button type="button" className={primary} disabled={pending} onClick={onSave}>
          {pending ? "Guardando…" : dirty ? "Guardar cambios" : "Guardar"}
        </button>
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
    saveCertificates: (d: CertificateDraft[]) => Promise<ActionResult>;
  };
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [experience, setExperience] = useState(initialExperience);
  const [education, setEducation] = useState(initialEducation);
  const [certificates, setCertificates] = useState(initialCertificates);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>) {
    setResult(null);
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) router.refresh();
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

      {result ? (
        <p
          role="status"
          className={`rounded border px-4 py-3 text-sm ${
            result.ok
              ? "border-green-900/60 bg-green-950/30 text-green-300"
              : "border-red-900/60 bg-red-950/30 text-red-300"
          }`}
        >
          {result.message}
        </p>
      ) : null}

      {/* ---------------- Perfil ---------------- */}
      <Section
        title="Datos personales"
        note="Nombre, contacto, redes y CV descargable"
        dirty={false}
        pending={pending}
        onSave={() => run(() => actions.saveProfile(profile))}
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
        dirty={false}
        pending={pending}
        onSave={() => run(() => actions.saveExperience(experience))}
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
              <input
                className={field}
                value={item.start}
                placeholder="Inicio: 2024-08"
                onChange={(e) => setExperience(patch(experience, i, { start: e.target.value }))}
              />
              <input
                className={field}
                value={item.end}
                placeholder="Fin (vacío = actual)"
                onChange={(e) => setExperience(patch(experience, i, { end: e.target.value }))}
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
        dirty={false}
        pending={pending}
        onSave={() => run(() => actions.saveEducation(education))}
      >
        {education.map((item, i) => (
          <article key={item.id ?? `nuevo-${i}`} className="flex flex-col gap-3 rounded border border-neutral-900 p-3">
            <div className="grid gap-2 sm:grid-cols-4">
              <input className={`${field} sm:col-span-2`} value={item.org} placeholder="Institución"
                onChange={(e) => setEducation(patch(education, i, { org: e.target.value }))} />
              <input className={field} value={item.start} placeholder="Inicio: 2020"
                onChange={(e) => setEducation(patch(education, i, { start: e.target.value }))} />
              <input className={field} value={item.end} placeholder="Fin: 2026-09-25"
                onChange={(e) => setEducation(patch(education, i, { end: e.target.value }))} />
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
        dirty={false}
        pending={pending}
        onSave={() => run(() => actions.saveCertificates(certificates))}
      >
        {certificates.map((item, i) => (
          <article key={item.id ?? `nuevo-${i}`} className="flex flex-col gap-3 rounded border border-neutral-900 p-3">
            <div className="grid gap-2 sm:grid-cols-4">
              <input className={field} value={item.provider} placeholder="Proveedor"
                onChange={(e) => setCertificates(patch(certificates, i, { provider: e.target.value }))} />
              <input className={field} value={item.dateLabel} placeholder="Año: 2024"
                onChange={(e) => setCertificates(patch(certificates, i, { dateLabel: e.target.value }))} />
              <input className={`${field} sm:col-span-2`} value={item.url} placeholder="URL del diploma"
                onChange={(e) => setCertificates(patch(certificates, i, { url: e.target.value }))} />
            </div>

            <Translated title="Título" value={item.title}
              onChange={(v) => setCertificates(patch(certificates, i, { title: v }))} />
            <Translated title="Categoría" value={item.category}
              onChange={(v) => setCertificates(patch(certificates, i, { category: v }))} />
            <Incomplete missing={missingIn(locales, item.title, item.category)} />

            <button
              type="button"
              className={`${ghost} w-fit border-red-900/60 text-red-400`}
              onClick={() => setCertificates(certificates.filter((_, j) => j !== i))}
            >
              Eliminar
            </button>
          </article>
        ))}
        <button
          type="button"
          className={`${ghost} w-fit`}
          onClick={() =>
            setCertificates([...certificates, {
              id: null, provider: "", dateLabel: "", url: "",
              title: emptyLocalized(locales), category: emptyLocalized(locales),
            }])
          }
        >
          Añadir certificado
        </button>
      </Section>
    </div>
  );
}
