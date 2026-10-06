import type { CourseStatus } from "@nassican/db";
import type { Locale } from "@nassican/shared";
import { fieldProblems, parseNumber } from "@/lib/draft-fields";

/**
 * A course while it is being edited, and the rules for saving it — and for
 * turning a finished one into a certificate on the public site.
 *
 * Same shape as the two libraries on purpose: three lists that behave alike
 * are one thing to remember.
 */

export type CourseDraft = {
  id: string;
  title: string;
  provider: string;
  url: string;
  status: CourseStatus;
  progress: string;
  hours: string;
  hoursSpent: string;
  price: string;
  startedAt: string;
  targetDate: string;
  finishedAt: string;
  note: string;
};

export const statuses: { value: CourseStatus; label: string; hint: string }[] = [
  { value: "wishlist", label: "Lo quiero", hint: "Todavía no te has inscrito" },
  { value: "backlog", label: "Sin empezar", hint: "Inscrito y sin abrir" },
  { value: "in_progress", label: "En curso", hint: "Lo estás haciendo" },
  { value: "finished", label: "Terminado", hint: "Aprobado" },
  { value: "dropped", label: "Abandonado", hint: "Lo dejaste y no vas a volver" },
];

export const statusLabel = (s: CourseStatus): string => statuses.find((x) => x.value === s)?.label ?? s;

export function emptyCourse(): CourseDraft {
  return {
    id: "",
    title: "",
    provider: "",
    url: "",
    status: "backlog",
    progress: "",
    hours: "",
    hoursSpent: "",
    price: "",
    startedAt: "",
    targetDate: "",
    finishedAt: "",
    note: "",
  };
}

export function courseProblems(draft: CourseDraft): string[] {
  const problems: string[] = [];
  if (!draft.title.trim()) problems.push("Falta el título.");

  problems.push(
    ...fieldProblems([
      { label: "inicio", value: draft.startedAt, kind: "date" },
      { label: "objetivo", value: draft.targetDate, kind: "date" },
      { label: "fin", value: draft.finishedAt, kind: "date" },
      { label: "Las horas", value: draft.hours, kind: "amount" },
      { label: "Las horas dedicadas", value: draft.hoursSpent, kind: "amount" },
      { label: "El precio", value: draft.price, kind: "amount" },
    ]),
  );

  const progress = parseNumber(draft.progress);
  if (draft.progress.trim() && (progress === null || progress < 0 || progress > 100)) {
    problems.push("El progreso va de 0 a 100.");
  }
  if (draft.url.trim() && !/^https?:\/\//i.test(draft.url.trim())) {
    problems.push("El enlace tiene que empezar por http:// o https://.");
  }
  if (draft.finishedAt.trim() && (draft.status === "backlog" || draft.status === "wishlist")) {
    problems.push("Tiene fecha de fin pero no está empezado.");
  }
  return problems;
}

/**
 * Progress as stored. A finished course is 100 whatever the box said: nobody
 * types 100 on the day they pass, and a finished course at 85 % would read as
 * the platform's fault.
 */
export function storedProgress(draft: Pick<CourseDraft, "progress" | "status">): number {
  if (draft.status === "finished") return 100;
  const value = parseNumber(draft.progress);
  return value === null ? 0 : Math.round(Math.min(100, Math.max(0, value)));
}

/** What the public certificate needs, typed when a finished course is published. */
export type CertificateFromCourse = {
  url: string;
  dateLabel: string;
  title: Record<Locale, string>;
  category: Record<Locale, string>;
};

/**
 * The certificate is visible text, so the repository's first rule applies: it
 * goes out in both languages or not at all. The Spanish title starts as the
 * course's; the English one is never guessed.
 */
export function certificateProblems(draft: CertificateFromCourse, locales: readonly Locale[]): string[] {
  const problems: string[] = [];
  if (!/^https?:\/\//i.test(draft.url.trim())) problems.push("Falta el enlace del diploma (http:// o https://).");
  const missing = (field: Record<Locale, string>) => locales.filter((l) => !field[l]?.trim());
  const title = missing(draft.title);
  const category = missing(draft.category);
  if (title.length > 0) problems.push(`Falta el título en: ${title.join(", ")}.`);
  if (category.length > 0) problems.push(`Falta la categoría en: ${category.join(", ")}.`);
  return problems;
}

/** "2024-08-13" → "2024": certificates show the year, as the 37 from Platzi do. */
export function yearOf(date: string | null): string {
  return /^\d{4}/.exec(date ?? "")?.[0] ?? "";
}
