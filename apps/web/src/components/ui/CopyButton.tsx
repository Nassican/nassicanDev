"use client";

import { useRef, useState, type ReactNode } from "react";
import { BsCheck2 } from "react-icons/bs";

/**
 * Copies a string and says so for two seconds.
 *
 * The confirmation replaces the label and is announced (`aria-live`), because a
 * copy that worked looks exactly like a copy that did nothing. It says nothing
 * when the clipboard refuses — an insecure origin, a denied permission — since
 * «copied» would then be the one thing that is not true.
 */
export default function CopyButton({
  text,
  label,
  done,
  icon,
  className = "",
}: {
  text: string;
  label: string;
  done: string;
  icon?: ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" onClick={copy} className={className}>
      {copied ? <BsCheck2 className="h-3.5 w-3.5" aria-hidden /> : icon}
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  );
}
