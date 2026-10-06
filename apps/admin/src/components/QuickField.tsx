"use client";

import { useState } from "react";

export type QuickSave = (raw: string) => Promise<{ ok: boolean; message: string }>;

/**
 * One field of a list row, editable in place.
 *
 * Saves when focus leaves it or on Enter, and only if the text changed — so
 * tabbing through a row costs nothing until something is typed. Escape puts the
 * saved value back. A failed save keeps what was typed and says why in the
 * field's own title, so the number is not lost while it is fixed.
 *
 * Mount it with `key={value}`: when the server answers with the new row, the
 * field starts again from it instead of syncing state in an effect.
 */
export default function QuickField({
  value,
  label,
  placeholder,
  suffix,
  width = "w-20",
  inputMode = "decimal",
  onSave,
}: {
  value: string;
  label: string;
  placeholder?: string;
  suffix?: string;
  width?: string;
  inputMode?: "decimal" | "numeric" | "text";
  onSave: QuickSave;
}) {
  const [text, setText] = useState(value);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function commit() {
    if (text.trim() === value.trim()) return;
    setState("saving");
    const outcome = await onSave(text);
    if (outcome.ok) {
      setState("saved");
      setError(null);
    } else {
      setState("error");
      setError(outcome.message);
    }
  }

  const border =
    state === "error"
      ? "border-red-700"
      : state === "saved"
        ? "border-green-800"
        : "border-neutral-800 focus:border-neutral-500";

  return (
    <label className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-neutral-500">{label}</span>
      <span className="flex items-center gap-1">
        <input
          className={`${width} rounded border bg-neutral-950 px-2 py-1 text-xs tabular-nums text-neutral-100 placeholder:text-neutral-600 focus:outline-none ${border} ${
            state === "saving" ? "opacity-60" : ""
          }`}
          value={text}
          inputMode={inputMode}
          placeholder={placeholder ?? "—"}
          aria-label={label}
          aria-invalid={state === "error" || undefined}
          title={error ?? undefined}
          onChange={(e) => {
            setText(e.target.value);
            if (state !== "saving") setState("idle");
          }}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            }
            if (e.key === "Escape") {
              setText(value);
              setState("idle");
              setError(null);
            }
          }}
        />
        {suffix ? <span className="text-[10px] text-neutral-500">{suffix}</span> : null}
      </span>
      {state === "error" && error ? (
        <span role="alert" className="max-w-40 text-[10px] leading-tight text-red-400">
          {error}
        </span>
      ) : null}
    </label>
  );
}

/**
 * Asked once, right after something is marked finished without an end date.
 *
 * The journal only says «Terminaste» when the end date backs it up, so a
 * status changed without one reads as routine. This puts the date one tap
 * away at the moment it is known, instead of stamping today blindly — catching
 * up an old library is the other reason to mark something finished.
 */
export function FinishPrompt({
  pending,
  onToday,
  onOtherDay,
  onDismiss,
}: {
  pending: boolean;
  onToday: () => void;
  onOtherDay: () => void;
  onDismiss: () => void;
}) {
  const small =
    "rounded border border-neutral-800 px-2 py-0.5 text-[11px] text-neutral-300 transition-colors hover:border-neutral-600 disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-green-900/60 bg-green-950/30 px-3 py-1.5" role="group" aria-label="Fecha de fin">
      <span className="text-xs text-green-300">¿Lo terminaste hoy?</span>
      <button type="button" className={small} disabled={pending} onClick={onToday}>
        Sí, hoy
      </button>
      <button type="button" className={small} disabled={pending} onClick={onOtherDay}>
        Otro día…
      </button>
      <button type="button" className={`${small} text-neutral-500`} onClick={onDismiss}>
        No lo sé
      </button>
    </div>
  );
}
