"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { FocusNow } from "@/lib/focus-draft";

/**
 * The browser half of the focus clock: a ticking `now`, and a way for the page
 * and the header chip to agree on the running block without asking the
 * database twice.
 */

const EVENT = "nassican:focus";

/** Tells every listener — the header chip, mostly — what the clock now is. */
export function announceFocus(now: FocusNow): void {
  window.dispatchEvent(new CustomEvent<FocusNow>(EVENT, { detail: now }));
}

/**
 * The current block state: the server's answer to start with, then whatever
 * the last action announced. `initial` is null for the chip, which loads its
 * own once.
 */
export function useFocusState(initial: FocusNow | null, load?: () => Promise<FocusNow>): FocusNow | null {
  const [state, setState] = useState<FocusNow | null>(initial);

  useEffect(() => {
    let live = true;
    if (load) {
      void load()
        .then((now) => {
          if (live) setState(now);
        })
        .catch(() => {
          // A chip that could not load is a chip that shows nothing: the
          // module itself still works.
        });
    }
    const onFocus = (e: Event) => setState((e as CustomEvent<FocusNow>).detail);
    window.addEventListener(EVENT, onFocus);
    return () => {
      live = false;
      window.removeEventListener(EVENT, onFocus);
    };
  }, [load]);

  return state;
}

/*
 * One ticking second for the whole tab. A store rather than `useState` plus an
 * interval in each component: the server snapshot is 0, so the first render
 * matches the HTML and the countdown appears on hydration instead of
 * mismatching it.
 */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  timer ??= setInterval(() => listeners.forEach((l) => l()), 1000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const second = () => Math.floor(Date.now() / 1000) * 1000;

/** `Date.now()` to the second, re-rendering once a second. 0 on the server. */
export function useClock(): number {
  return useSyncExternalStore(subscribe, second, () => 0);
}

/** Notification permission, or "unsupported" — never read during the server render. */
export function useNotificationPermission(): [NotificationPermission | "unsupported", () => void] {
  const read = () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const initial = useSyncExternalStore(
    () => () => {},
    read,
    () => "unsupported" as const,
  );
  const [asked, setAsked] = useState<NotificationPermission | null>(null);

  const ask = () => {
    if (typeof Notification === "undefined") return;
    void Notification.requestPermission().then(setAsked);
  };

  return [asked ?? initial, ask];
}
