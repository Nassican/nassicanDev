"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BsQuestion } from "react-icons/bs";

/** Native top-layer popover: click/touch/keyboard, Escape and outside-click dismissal. */
export default function PricingHelp({
  label,
  children,
  className = "",
}: {
  label: string;
  children: string;
  className?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const position = useCallback(() => {
    const button = trigger.current;
    const popup = content.current;
    if (!button || !popup) return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(300, innerWidth - 24);
    popup.style.width = `${width}px`;
    popup.style.left = `${Math.max(12, Math.min(rect.right - width, innerWidth - width - 12))}px`;
    const height = popup.getBoundingClientRect().height;
    popup.style.top = `${Math.max(12, rect.bottom + 8 + height < innerHeight - 12 ? rect.bottom + 8 : rect.top - height - 8)}px`;
  }, []);
  useEffect(() => {
    if (!open) return;
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open, position]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        popoverTarget={id}
        onClick={position}
        aria-label={`Ayuda: ${label}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full p-0 text-neutral-500 hover:text-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
      >
        <BsQuestion aria-hidden className="h-4 w-4" />
      </button>
      <div
        ref={content}
        id={id}
        popover="auto"
        role="tooltip"
        onToggle={(event) => {
          const visible = event.currentTarget.matches(":popover-open");
          setOpen(visible);
          if (visible) position();
        }}
        style={{
          position: "fixed",
          inset: "auto",
          margin: 0,
          maxHeight: "min(360px, calc(100dvh - 24px))",
        }}
        className="z-50 max-w-[calc(100vw-24px)] overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-left text-xs leading-relaxed text-neutral-200 shadow-xl"
      >
        <p className="mb-1 font-semibold text-neutral-100">{label}</p>
        <p>{children}</p>
      </div>
    </>
  );
}
