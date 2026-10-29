"use client";

import {
  useLayoutEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";

type Anchor = { button: HTMLButtonElement; top: number };

export function usePricingEditorAnchor() {
  const anchor = useRef<Anchor | null>(null);
  function capture(event: MouseEvent<HTMLButtonElement>) {
    const button = event.currentTarget;
    anchor.current = { button, top: button.getBoundingClientRect().top };
  }
  return { anchor, capture };
}

/** Keep the clicked row in view, including when an editor above it closes. */
export default function PricingInlineEditor({
  anchor,
  label,
  children,
}: {
  anchor: RefObject<Anchor | null>;
  label: string;
  children: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const position = anchor.current;
    const isCurrent = () => anchor.current === position;
    function restore() {
      if (position?.button.isConnected && isCurrent()) {
        window.scrollBy(0, position.button.getBoundingClientRect().top - position.top);
      }
    }
    restore();
    container.current
      ?.querySelector<HTMLElement>(
        "input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
      )
      ?.focus({ preventScroll: true });
    return () => {
      requestAnimationFrame(() => {
        if (position?.button.isConnected && isCurrent()) {
          restore();
          position.button.focus({ preventScroll: true });
        }
      });
    };
  }, [anchor]);
  return (
    <div ref={container} role="region" aria-label={label} className="w-full min-w-0 basis-full">
      {children}
    </div>
  );
}
