import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SignInButton from "@/components/SignInButton";
import { currentSession } from "@/lib/session";

export const metadata: Metadata = { title: "Entrar" };

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

/**
 * Better Auth appends its own error code to the URL. Only the access case gets
 * a specific message; everything else keeps the raw code visible, because a
 * vague "algo salió mal" is exactly what made the first failure hard to trace.
 */
function errorMessage(code: string | undefined): string | null {
  if (!code) return null;
  const normalized = code.toLowerCase();

  if (normalized.includes("forbidden") || normalized.includes("access_denied")) {
    return "Esa cuenta no tiene acceso al panel.";
  }
  return `No se pudo completar el inicio de sesión (${code}).`;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (await currentSession()) redirect("/");

  const { error } = await searchParams;
  const message = errorMessage(error);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6 py-20">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-neutral-500">
          app.nassican.com
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">App Nassican</h1>
        <p className="text-sm text-neutral-400">
          Plataforma de gestión de nassican.com. Acceso restringido a una
          cuenta.
        </p>
      </header>

      <SignInButton />

      {message ? (
        <p
          role="alert"
          className="rounded-md border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300"
        >
          {message}
        </p>
      ) : null}

      <p className="text-xs text-neutral-600">
        Al entrar se solicita permiso de solo lectura sobre Google Analytics y
        Search Console, que es lo que alimenta los módulos de analítica y SEO.
      </p>
    </main>
  );
}
