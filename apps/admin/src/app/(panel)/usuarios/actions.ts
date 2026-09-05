"use server";

import { revalidatePath } from "next/cache";
import { db } from "@nassican/db";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  activationProblem,
  getUsers,
  roleChangeProblem,
  roleLabels,
  type Role,
} from "@/lib/users";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Only an owner administers people.
 *
 * Checked in every action rather than once in the page: a server action is a
 * public endpoint, and a role check that only guards the rendering of a button
 * guards nothing at all.
 */
async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "owner") return null;
  return user;
}

const denied: ActionResult = {
  ok: false,
  message: "Solo un propietario puede administrar usuarios.",
};

export async function setRole(userId: string, role: Role): Promise<ActionResult> {
  const actor = await requireOwner();
  if (!actor) return denied;

  // Re-read rather than trust what the browser sent: the rules below are about
  // the state of the world, and the page may have been open for an hour.
  const { users } = await getUsers(actor.id);
  const target = users.find((u) => u.id === userId);
  if (!target) return { ok: false, message: "Ese usuario ya no existe." };

  const problem = roleChangeProblem(target, role, actor.id, users);
  if (problem) return { ok: false, message: problem };

  await db.user.update({ where: { id: userId }, data: { role } });
  await logAudit({
    userId: actor.id,
    action: "update",
    entityType: "user",
    entityId: userId,
    diff: { label: target.email, from: target.role, to: role },
  });

  revalidatePath("/usuarios");
  return {
    ok: true,
    message: `${target.email} ahora es ${roleLabels[role].toLowerCase()}.`,
  };
}

/**
 * Revoking access does two things, and the second is the one that matters
 * today: the flag stops future logins, and deleting the sessions ends the ones
 * already open.
 *
 * The flag alone would have been enough - `requireUser()` re-reads it on every
 * request - but leaving live rows behind would make the sessions list lie
 * about who is signed in.
 */
export async function setActive(
  userId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const actor = await requireOwner();
  if (!actor) return denied;

  const { users } = await getUsers(actor.id);
  const target = users.find((u) => u.id === userId);
  if (!target) return { ok: false, message: "Ese usuario ya no existe." };

  const problem = activationProblem(target, isActive, actor.id, users);
  if (problem) return { ok: false, message: problem };

  await db.user.update({ where: { id: userId }, data: { isActive } });

  let closed = 0;
  if (!isActive) {
    const result = await db.session.deleteMany({ where: { userId } });
    closed = result.count;
  }

  await logAudit({
    userId: actor.id,
    action: "update",
    entityType: "user",
    entityId: userId,
    diff: { label: target.email, isActive, sesionesCerradas: closed },
  });

  revalidatePath("/usuarios");
  return {
    ok: true,
    message: isActive
      ? `${target.email} vuelve a tener acceso.`
      : `Acceso revocado a ${target.email}${closed > 0 ? ` y ${closed} ${closed === 1 ? "sesión cerrada" : "sesiones cerradas"}` : ""}.`,
  };
}

/**
 * Ends one session.
 *
 * Your own is allowed on purpose - it is how you sign out a browser you no
 * longer have in front of you - but the panel says which one it is first, and
 * closing it means the next click lands on the login page.
 */
export async function revokeSession(sessionId: string): Promise<ActionResult> {
  const actor = await requireUser();

  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: { userId: true, user: { select: { email: true } } },
  });
  if (!session) return { ok: false, message: "Esa sesión ya no existe." };

  // Anyone may close their own sessions; only an owner closes someone else's.
  if (session.userId !== actor.id && actor.role !== "owner") return denied;

  await db.session.delete({ where: { id: sessionId } });
  await logAudit({
    userId: actor.id,
    action: "delete",
    entityType: "session",
    entityId: sessionId,
    diff: { label: session.user.email },
  });

  revalidatePath("/usuarios");
  return { ok: true, message: "Sesión cerrada." };
}

/** Everything except the browser asking, which is the usual thing you want. */
export async function revokeOtherSessions(userId: string): Promise<ActionResult> {
  const actor = await requireUser();
  if (userId !== actor.id && actor.role !== "owner") return denied;

  const { users } = await getUsers(actor.id);
  const target = users.find((u) => u.id === userId);
  if (!target) return { ok: false, message: "Ese usuario ya no existe." };

  const keep = target.sessions.filter((s) => s.isCurrent).map((s) => s.id);
  const result = await db.session.deleteMany({
    where: { userId, id: { notIn: keep } },
  });

  if (result.count === 0) {
    return { ok: true, message: "No había otras sesiones abiertas." };
  }

  await logAudit({
    userId: actor.id,
    action: "delete",
    entityType: "session",
    entityId: userId,
    diff: { label: target.email, cerradas: result.count },
  });

  revalidatePath("/usuarios");
  return {
    ok: true,
    message: `${result.count} ${result.count === 1 ? "sesión cerrada" : "sesiones cerradas"}.`,
  };
}
