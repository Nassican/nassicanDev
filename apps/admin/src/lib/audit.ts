import "server-only";

import { headers } from "next/headers";
import { db, prismaJson } from "@nassican/db";

/**
 * The record of who changed what.
 *
 * Written from the actions rather than from a Prisma extension on purpose. An
 * extension would catch every row written and nothing else: it would log four
 * upserts for one save, would not know which of them was the point, and could
 * not name the user, because the database layer has no session. What is worth
 * keeping is the *decision* - published, deleted, settings saved - and only the
 * action knows that.
 *
 * Never throws. An audit trail that can fail a publish is worse than one with
 * a hole in it.
 */
export type AuditAction =
  | "create"
  | "update"
  | "publish"
  | "unpublish"
  | "delete"
  | "sync";

export async function logAudit(entry: {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  /** Only what changed, and only what is safe to keep. */
  diff?: Record<string, unknown>;
}): Promise<void> {
  // Read in its own try: `headers()` throws outside a request, and losing
  // the caller's address is a far smaller loss than losing the entry. This is
  // the difference between an audit trail with a blank column and one with a
  // hole where a deletion should be.
  let ipAddress: string | null = null;
  let userAgent: string | null = null;
  try {
    const headerList = await headers();
    // Behind Vercel the socket address is the proxy's, so the forwarded header
    // is the only one that names the operator's network.
    ipAddress = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    userAgent = headerList.get("user-agent")?.slice(0, 300) ?? null;
  } catch {
    // Called from a script or a background task; the entry still matters.
  }

  try {
    await db.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        diff: entry.diff ? prismaJson.record(entry.diff) : undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error("no se pudo registrar la auditoría:", error);
  }
}
