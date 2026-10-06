import "server-only";

import { db, type OpportunityStage } from "@nassican/db";
import { calendarDate } from "@nassican/shared";
import { blankToNull, parseNumber } from "@/lib/draft-fields";
import { followUp, isOpen, type FollowUp, type OpportunityDraft } from "@/lib/opportunity-draft";
import { getTimezone } from "@/lib/site-config";

export type OpportunityRow = {
  id: string;
  title: string;
  kind: OpportunityDraft["kind"];
  stage: OpportunityStage;
  organization: string | null;
  contactName: string | null;
  contact: string | null;
  url: string | null;
  nextStep: string | null;
  nextStepOn: string | null;
  amount: number | null;
  currency: OpportunityDraft["currency"] | null;
  closedAt: string | null;
  updatedAt: string;
  followUp: FollowUp;
  entries: { id: string; at: string; text: string }[];
};

export type OpportunitiesView = { today: string; rows: OpportunityRow[] };

export async function getOpportunities(): Promise<OpportunitiesView> {
  const [rows, timezone] = await Promise.all([
    db.opportunity.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: { entries: { orderBy: [{ at: "desc" }, { createdAt: "desc" }] } },
    }),
    getTimezone(),
  ]);
  const today = calendarDate(timezone);
  return {
    today,
    rows: rows.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      stage: r.stage,
      organization: r.organization,
      contactName: r.contactName,
      contact: r.contact,
      url: r.url,
      nextStep: r.nextStep,
      nextStepOn: r.nextStepOn,
      amount: r.amount === null ? null : Number(r.amount),
      currency: r.currency,
      closedAt: r.closedAt?.toISOString() ?? null,
      updatedAt: r.updatedAt.toISOString(),
      followUp: followUp(r.stage, r.nextStepOn, today),
      entries: r.entries.map((e) => ({ id: e.id, at: e.at, text: e.text })),
    })),
  };
}

function toRow(draft: OpportunityDraft) {
  const amount = parseNumber(draft.amount);
  return {
    title: draft.title.trim(),
    kind: draft.kind,
    stage: draft.stage,
    organization: blankToNull(draft.organization),
    contactName: blankToNull(draft.contactName),
    contact: blankToNull(draft.contact),
    url: blankToNull(draft.url),
    nextStep: blankToNull(draft.nextStep),
    nextStepOn: blankToNull(draft.nextStepOn),
    amount,
    currency: amount === null ? null : draft.currency,
  };
}

/** Closing stamps the date; reopening clears it, so «cerrada hace» never lies. */
const closing = (stage: OpportunityStage) => (isOpen(stage) ? { closedAt: null } : { closedAt: new Date() });

export async function saveOpportunity(draft: OpportunityDraft): Promise<{ id: string; created: boolean }> {
  if (draft.id) {
    const before = await db.opportunity.findUniqueOrThrow({ where: { id: draft.id }, select: { stage: true } });
    await db.opportunity.update({
      where: { id: draft.id },
      data: { ...toRow(draft), ...(before.stage !== draft.stage ? closing(draft.stage) : {}) },
    });
    return { id: draft.id, created: false };
  }
  const row = await db.opportunity.create({ data: { ...toRow(draft), ...closing(draft.stage) }, select: { id: true } });
  return { id: row.id, created: true };
}

export async function setStage(id: string, stage: OpportunityStage): Promise<string> {
  return (await db.opportunity.update({ where: { id }, data: { stage, ...closing(stage) }, select: { title: true } })).title;
}

/**
 * A line of the conversation. Writing one usually means the next step was just
 * taken, so it can carry the new one in the same save — the two are one moment.
 */
export async function addEntry(
  id: string,
  entry: { at: string; text: string },
  next?: { nextStep: string; nextStepOn: string },
): Promise<string> {
  const [, opportunity] = await db.$transaction([
    db.opportunityEntry.create({ data: { opportunityId: id, at: entry.at, text: entry.text.trim() } }),
    db.opportunity.update({
      where: { id },
      data: next ? { nextStep: blankToNull(next.nextStep), nextStepOn: blankToNull(next.nextStepOn) } : { updatedAt: new Date() },
      select: { title: true },
    }),
  ]);
  return opportunity.title;
}

export async function deleteEntry(entryId: string): Promise<void> {
  await db.opportunityEntry.delete({ where: { id: entryId } });
}

/** For «Hoy»: next steps due today or already late. */
export async function dueFollowUps(today: string): Promise<{ id: string; title: string; nextStep: string | null; overdue: boolean }[]> {
  const rows = await db.opportunity.findMany({
    where: { stage: { in: ["lead", "contacted", "conversation", "proposal"] }, nextStepOn: { not: null, lte: `${today}T99` } },
    select: { id: true, title: true, nextStep: true, nextStepOn: true },
    orderBy: { nextStepOn: "asc" },
  });
  return rows.map((r) => ({ id: r.id, title: r.title, nextStep: r.nextStep, overdue: r.nextStepOn!.slice(0, 10) < today }));
}
