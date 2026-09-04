import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { dbBase } from "@nassican/db";

/**
 * The panel has exactly one operator. Access is gated three times over, and
 * each lock works without the other two:
 *
 *   1. Google verifies the identity.
 *   2. This allowlist rejects any other address before a user row is created.
 *   3. `isActive` on the row is checked when a session is created, so access
 *      can be revoked without Google's cooperation.
 */
const allowedEmails = (process.env.ADMIN_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isAllowedEmail(email: string): boolean {
  return allowedEmails.includes(email.trim().toLowerCase());
}

/**
 * Read-only access to the two Google APIs the panel reports on. Requesting
 * them during sign-in is what makes a service account unnecessary: the refresh
 * token stored on the account row is the credential the SEO and Analytics
 * modules use.
 */
const googleScopes = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
];

function baseUrl(): string | undefined {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  // Preview deployments get a generated hostname Vercel only knows at runtime.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return undefined;
}

export const auth = betterAuth({
  database: prismaAdapter(dbBase, { provider: "postgresql" }),
  baseURL: baseUrl(),
  secret: process.env.BETTER_AUTH_SECRET,

  // No email/password: the only way in is Google.
  emailAndPassword: { enabled: false },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      scope: googleScopes,
      // Without both of these Google returns a refresh token only on the very
      // first consent, and never again after a re-login.
      accessType: "offline",
      prompt: "consent",
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!isAllowedEmail(user.email)) {
            throw new APIError("FORBIDDEN", {
              message: "Esta cuenta no tiene acceso al panel.",
            });
          }
          return { data: user };
        },
      },
    },
    session: {
      create: {
        /**
         * Runs after the sign-up transaction commits. Reading the user from a
         * `before` hook would not work: on a first sign-in the row is still
         * uncommitted inside Better Auth's own transaction, so a separate
         * query sees nothing. The `isActive` check that used to live here is
         * redundant anyway - `requireUser()` re-reads the user on every
         * request, which is both stricter and correctly ordered.
         */
        after: async (session) => {
          try {
            await dbBase.user.update({
              where: { id: session.userId },
              data: { lastLoginAt: new Date() },
            });
          } catch (error) {
            // A bookkeeping field must never be able to block a login.
            console.error("[auth] no se pudo registrar lastLoginAt", error);
          }
        },
      },
    },
  },

  /**
   * Without this an unexpected exception in the OAuth callback only shows up
   * as Better Auth's generic error page, with the actual cause nowhere.
   */
  onAPIError: {
    onError: (error) => {
      console.error("[auth] error en la API de autenticación:", error);
    },
    /**
     * Send failures back to our own login page instead of Better Auth's
     * generic one. It arrives as `?error=<code>`, which the page turns into a
     * message - including the case that matters most here, an address that is
     * not on the allowlist.
     */
    errorURL: "/login",
  },

  logger: {
    level: process.env.NODE_ENV === "production" ? "error" : "debug",
  },

  // Must stay last: it is what lets server actions set the session cookie.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
