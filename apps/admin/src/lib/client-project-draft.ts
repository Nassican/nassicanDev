import type { ClientProjectStatus, Currency } from "@nassican/db";
import { fieldProblems } from "@/lib/draft-fields";

/**
 * Work for companies, the part that needs no database: three states, the rules
 * for saving, and the two readings the module exists for — what is moving, and
 * what has gone quiet.
 */

export type ClientProjectDraft = {
  id: string;
  title: string;
  company: string;
  status: ClientProjectStatus;
  contactName: string;
  contact: string;
  url: string;
  description: string;
  startedAt: string;
  dueDate: string;
  finishedAt: string;
  amount: string;
  currency: Currency;
};

export const statuses: { value: ClientProjectStatus; label: string }[] = [
  { value: "not_started", label: "No iniciado" },
  { value: "in_progress", label: "En marcha" },
  { value: "finished", label: "Finalizado" },
];

export const statusLabel = (s: ClientProjectStatus) => statuses.find((x) => x.value === s)?.label ?? s;

export function emptyClientProject(): ClientProjectDraft {
  return {
    id: "",
    title: "",
    company: "",
    status: "not_started",
    contactName: "",
    contact: "",
    url: "",
    description: "",
    startedAt: "",
    dueDate: "",
    finishedAt: "",
    amount: "",
    currency: "COP",
  };
}

export function clientProjectProblems(draft: ClientProjectDraft): string[] {
  const problems: string[] = [];
  if (!draft.title.trim()) problems.push("Falta el nombre del trabajo.");
  if (!draft.company.trim()) problems.push("Falta la empresa o el cliente.");
  problems.push(
    ...fieldProblems([
      { label: "inicio", value: draft.startedAt, kind: "date" },
      { label: "entrega", value: draft.dueDate, kind: "date" },
      { label: "fin", value: draft.finishedAt, kind: "date" },
      { label: "El monto", value: draft.amount, kind: "amount" },
    ]),
  );
  if (draft.url.trim() && !/^https?:\/\//i.test(draft.url.trim())) {
    problems.push("El enlace tiene que empezar por http:// o https://.");
  }
  if (draft.finishedAt.trim() && draft.status !== "finished") {
    problems.push("Tiene fecha de fin pero no está finalizado.");
  }
  return problems;
}

const dayNumber = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 86_400_000;

/** Whole days between two full days; null when either is missing or partial. */
export function daysBetween(from: string | null, to: string): number | null {
  if (!from || from.length < 10) return null;
  return Math.round(dayNumber(to) - dayNumber(from.slice(0, 10)));
}

/**
 * Past its delivery date and not finished. A month-only date is late only
 * once that month is over — the editorial calendar's rule.
 */
export function isLate(dueDate: string | null, status: ClientProjectStatus, today: string): boolean {
  if (!dueDate || status === "finished") return false;
  const due = dueDate.slice(0, 10);
  return due.length === 10 ? due < today : due < today.slice(0, due.length);
}

/**
 * A project in progress with no step logged for a week has gone quiet. It is
 * the one warning the module gives: «en marcha» that nobody has touched is
 * usually waiting on someone, and that someone is often you.
 */
export const QUIET_DAYS = 7;

export function isQuiet(status: ClientProjectStatus, lastActivity: string | null, today: string): boolean {
  if (status !== "in_progress") return false;
  const days = daysBetween(lastActivity, today);
  return days === null || days > QUIET_DAYS;
}

export function totalHours(entries: { hours: number | null }[]): number {
  return Math.round(entries.reduce((n, e) => n + (e.hours ?? 0), 0) * 10) / 10;
}
