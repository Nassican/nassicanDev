import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, isAllowedEmail } from "@/lib/auth";
import { dbBase } from "@nassican/db";

/**
 * The real gate. The panel layout calls this before rendering anything, so a
 * request without a valid session never reaches a page component.
 *
 * It re-reads the user on every request rather than trusting the session
 * payload: `isActive` has to take effect immediately, not whenever the session
 * happens to expire.
 */
export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const user = await dbBase.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
    },
  });

  if (!user || !user.isActive || !isAllowedEmail(user.email)) redirect("/login?error=forbidden");

  return user;
}

/** The session if there is one, without redirecting. For the login page. */
export async function currentSession() {
  return auth.api.getSession({ headers: await headers() });
}
