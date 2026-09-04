"use client";

import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { signIn } from "@/lib/auth-client";

export default function SignInButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    const result = await signIn.social({ provider: "google", callbackURL: "/" });
    if (result?.error) {
      setError(result.error.message ?? "No se pudo iniciar sesión.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center justify-center gap-3 rounded-md border border-neutral-700 bg-neutral-900 px-5 py-3 text-sm font-medium transition-colors hover:border-neutral-500 hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FcGoogle aria-hidden className="size-5" />
        {pending ? "Conectando…" : "Entrar con Google"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
