/** Shapes and rules for the Usuarios module, free of database imports. */

export type Role = "owner" | "editor" | "viewer";

export const roles: Role[] = ["owner", "editor", "viewer"];

export const roleLabels: Record<Role, string> = {
  owner: "Propietario",
  editor: "Editor",
  viewer: "Lectura",
};

export const roleNotes: Record<Role, string> = {
  owner: "Todo, incluida esta pantalla.",
  editor: "Contenido y perfil; no toca usuarios ni configuración.",
  viewer: "Solo mira: analítica, estadísticas y sistema.",
};

export type SessionRow = {
  id: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  /** True for the session making the request. */
  isCurrent: boolean;
};

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** Google is the only provider, so this is really "has signed in". */
  hasAccount: boolean;
  /**
   * False when the address is no longer in `ADMIN_ALLOWED_EMAILS`. The row can
   * still say active and the person still cannot get in - a state worth
   * showing rather than leaving to be discovered at a login screen.
   */
  isAllowed: boolean;
  sessions: SessionRow[];
};

export type UsersSummary = {
  users: UserRow[];
  /** From the environment; the panel cannot change it. */
  allowlist: string[];
  currentUserId: string;
};

/**
 * A readable name for a session, from its user agent.
 *
 * Best-effort and deliberately shallow: the point is telling two of your own
 * sessions apart - the laptop from the phone - not building a device database.
 * Anything it cannot place shows the raw string, which is more honest than
 * "Desconocido".
 */
export function describeUserAgent(ua: string | null): string {
  if (!ua?.trim()) return "Origen desconocido";

  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) && /Version\//.test(ua) ? "Safari"
    : /Firefox\//.test(ua) ? "Firefox"
    : null;

  // iOS before macOS, and Android before Linux: an iPhone's user agent says
  // "like Mac OS X" and Android's says "Linux", so the broader match has to
  // come second or every phone is reported as a desktop.
  const system =
    /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Android/.test(ua) ? "Android"
    : /Windows NT/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : null;

  if (browser && system) return `${browser} en ${system}`;
  if (browser) return browser;
  if (system) return system;
  return ua.slice(0, 60);
}

/**
 * Why a change to this user must be refused, or null.
 *
 * These are the rules that keep the panel reachable. Every one of them exists
 * because breaking it locks the last way in, and there is no second channel to
 * undo it from: no password reset, no support desk, only a direct edit of the
 * database.
 */
export function roleChangeProblem(
  target: UserRow,
  nextRole: Role,
  currentUserId: string,
  users: UserRow[],
): string | null {
  if (target.role === nextRole) return null;

  if (target.id === currentUserId && target.role === "owner") {
    return "No puedes quitarte a ti mismo el rol de propietario: te quedarías fuera de esta pantalla sin forma de volver.";
  }

  if (target.role === "owner" && nextRole !== "owner") {
    const owners = users.filter((u) => u.role === "owner" && u.isActive);
    if (owners.length <= 1) {
      return "Es el único propietario activo. Nombra otro antes de cambiarle el rol.";
    }
  }

  return null;
}

export function activationProblem(
  target: UserRow,
  nextActive: boolean,
  currentUserId: string,
  users: UserRow[],
): string | null {
  if (target.isActive === nextActive) return null;
  if (nextActive) return null;

  if (target.id === currentUserId) {
    return "No puedes desactivar tu propia cuenta: la sesión moriría en la siguiente petición y no habría por dónde reactivarla.";
  }

  if (target.role === "owner") {
    const owners = users.filter((u) => u.role === "owner" && u.isActive);
    if (owners.length <= 1) {
      return "Es el único propietario activo. Desactivarlo dejaría el panel sin nadie que pueda entrar.";
    }
  }

  return null;
}

/** A session is live while it has not expired; the row survives a little longer. */
export function isLive(session: SessionRow, now = new Date()): boolean {
  return new Date(session.expiresAt).getTime() > now.getTime();
}
