"use client";

function getSectionIds() {
  return Array.from(document.querySelectorAll("main section[id]"))
    .map((el) => (el as HTMLElement).id)
    .filter(Boolean);
}

function getActiveIndex(ids: string[]) {
  const sections = ids.map((id) => document.getElementById(id) as HTMLElement | null).filter(Boolean) as HTMLElement[];
  const mid = window.innerHeight / 2;
  return sections.findIndex((s) => {
    const rect = s.getBoundingClientRect();
    return rect.top <= mid && rect.bottom >= mid;
  });
}

export default function SectionNavigator() {
  const go = (dir: 1 | -1) => {
    const ids = getSectionIds();
    if (!ids.length) return;
    const idx = getActiveIndex(ids);
    const next = Math.min(Math.max(idx + dir, 0), ids.length - 1);
    const el = document.getElementById(ids[next]);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-60 flex flex-col gap-2">
      <button
        aria-label="Sección anterior"
        onClick={() => go(-1)}
        className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/80 text-zinc-900 backdrop-blur transition hover:bg-white dark:border-white/20 dark:bg-black/60 dark:text-zinc-100"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 15l6-6 6 6" />
        </svg>
      </button>
      <button
        aria-label="Siguiente sección"
        onClick={() => go(1)}
        className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/80 text-zinc-900 backdrop-blur transition hover:bg-white dark:border-white/20 dark:bg-black/60 dark:text-zinc-100"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}
