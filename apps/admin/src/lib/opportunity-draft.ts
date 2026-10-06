import type { Currency, OpportunityKind, OpportunityStage } from "@nassican/db";
import { fieldProblems, isFullDay } from "@/lib/draft-fields";

/**
 * Opportunities, the part that needs no database: stages, the rules for
 * saving, and the one judgement the module exists to make — which conversation
 * is waiting on you.
 *
 * The rule is the one Pendientes already follows (Masicampo and Baumeister): an
 * open thread stops nagging once it has a concrete next step on a concrete day.
 * So an open opportunity without a next step is itself a warning.
 */

export type OpportunityDraft = {
  id: string;
  title: string;
  kind: OpportunityKind;
  stage: OpportunityStage;
  organization: string;
  contactName: string;
  contact: string;
  url: string;
  nextStep: string;
  nextStepOn: string;
  amount: string;
  currency: Currency;
};

export const kinds: { value: OpportunityKind; label: string }[] = [
  { value: "job", label: "Empleo" },
  { value: "client", label: "Cliente" },
  { value: "recruiter", label: "Reclutador" },
  { value: "collaboration", label: "Colaboración" },
  { value: "other", label: "Otra" },
];

export const stages: { value: OpportunityStage; label: string; open: boolean }[] = [
  { value: "lead", label: "Por contactar", open: true },
  { value: "contacted", label: "Contactado", open: true },
  { value: "conversation", label: "En conversación", open: true },
  { value: "proposal", label: "Propuesta", open: true },
  { value: "won", label: "Ganada", open: false },
  { value: "lost", label: "Perdida", open: false },
];

export const kindLabel = (k: OpportunityKind) => kinds.find((x) => x.value === k)?.label ?? k;
export const stageLabel = (s: OpportunityStage) => stages.find((x) => x.value === s)?.label ?? s;
export const isOpen = (s: OpportunityStage) => stages.find((x) => x.value === s)?.open ?? false;

export function emptyOpportunity(): OpportunityDraft {
  return {
    id: "",
    title: "",
    kind: "job",
    stage: "lead",
    organization: "",
    contactName: "",
    contact: "",
    url: "",
    nextStep: "",
    nextStepOn: "",
    amount: "",
    currency: "COP",
  };
}

export function opportunityProblems(draft: OpportunityDraft): string[] {
  const problems: string[] = [];
  if (!draft.title.trim()) problems.push("Falta el título: el puesto, el proyecto o con quién.");
  problems.push(...fieldProblems([{ label: "El monto", value: draft.amount, kind: "amount" }]));
  // A day, not a month: «2026-10» is not a plan, and the follow-up warning
  // needs a day to fall due on — the rule Pendientes keeps too.
  if (draft.nextStepOn.trim() && !isFullDay(draft.nextStepOn.trim().slice(0, 10))) {
    problems.push("La fecha del próximo paso tiene que ser un día concreto.");
  }
  if (draft.nextStepOn.trim() && !draft.nextStep.trim()) problems.push("Hay fecha pero falta qué es el próximo paso.");
  if (draft.url.trim() && !/^https?:\/\//i.test(draft.url.trim())) {
    problems.push("El enlace tiene que empezar por http:// o https://.");
  }
  return problems;
}

export type FollowUp =
  | { kind: "overdue"; days: number }
  | { kind: "today" }
  | { kind: "soon"; days: number }
  | { kind: "later" }
  | { kind: "missing" }
  | null;

const dayNumber = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 86_400_000;

/**
 * Where an opportunity stands against its next step. Closed ones have none to
 * keep; an open one with no step is «missing», which the module shows as a
 * warning rather than as nothing.
 */
export function followUp(stage: OpportunityStage, nextStepOn: string | null, today: string, soonDays = 3): FollowUp {
  if (!isOpen(stage)) return null;
  if (!nextStepOn) return { kind: "missing" };
  const diff = dayNumber(nextStepOn.slice(0, 10)) - dayNumber(today);
  if (diff < 0) return { kind: "overdue", days: -diff };
  if (diff === 0) return { kind: "today" };
  if (diff <= soonDays) return { kind: "soon", days: diff };
  return { kind: "later" };
}
