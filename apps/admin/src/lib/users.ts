import "server-only";

import { headers } from "next/headers";
import { db } from "@nassican/db";
import { auth, isAllowedEmail } from "@/lib/auth";
import type { Role, UserRow, UsersSummary } from "@/lib/user-draft";

export * from "@/lib/user-draft";

/**
 * The people who can reach the panel, and where they are signed in from.
 *
 * `ADMIN_ALLOWED_EMAILS` is read here too, so the module can show the state
 * that is otherwise invisible: a row that says active whose address was taken
 * off the allowlist. Both are true and the person still cannot get in.
 */
export async function getUsers(currentUserId: string): Promise<UsersSummary> {
  const now = new Date();

  const rows = await db.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    include: {
      // Expired rows linger until Better Auth cleans them; showing them as
      // active sessions would overstate who is signed in right now.
      sessions: {
        where: { expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
      },
      accounts: { select: { id: true } },
    },
  });

  // Which browser is asking, so the list can say "esta sesión" instead of
  // leaving the operator to guess which row is theirs before revoking one.
  //
  // In its own try: it is a label, and a label must not be able to take down
  // the page that revokes access. Outside a request - a script, a background
  // task - `headers()` throws, and the right answer there is "none of these
  // is the current one", not an error.
  let currentSessionId: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    currentSessionId = session?.session.id ?? null;
  } catch {
    currentSessionId = null;
  }

  const users: UserRow[] = rows.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role as Role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    hasAccount: user.accounts.length > 0,
    isAllowed: isAllowedEmail(user.email),
    sessions: user.sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      isCurrent: s.id === currentSessionId,
    })),
  }));

  const allowlist = (process.env.ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return { users, allowlist, currentUserId };
}
