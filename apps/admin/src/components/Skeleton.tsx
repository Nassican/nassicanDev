/**
 * The shapes a module shows while its data is in flight.
 *
 * Every panel page is a server component that awaits Postgres, and Neon lives
 * in another country: even at its best a page is a few hundred milliseconds
 * away. Without a boundary the browser simply keeps the previous page on
 * screen and the panel reads as frozen. These do not make anything faster -
 * they make the wait visible and put it where the data will land.
 *
 * Deliberately dumb: no animation beyond a pulse, and no attempt to guess row
 * counts. A skeleton that promises a shape the data does not have is worse
 * than a plain one.
 */

const block = "rounded bg-neutral-900";

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`h-3 ${block} ${className}`} />;
}

export function SkeletonHeader({ action = true }: { action?: boolean }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-2">
        <div className={`h-5 w-44 ${block}`} />
        <div className={`h-3 w-72 ${block}`} />
      </div>
      {action ? <div className={`h-8 w-28 ${block}`} /> : null}
    </header>
  );
}

export function SkeletonTiles({ count = 4 }: { count?: number }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-neutral-900 bg-neutral-900 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 bg-neutral-950 p-3">
          <div className={`h-2.5 w-16 ${block}`} />
          <div className={`h-6 w-20 ${block}`} />
          <div className={`h-2 w-24 ${block}`} />
        </div>
      ))}
    </dl>
  );
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-3 p-3">
          <div className={`h-3 w-3 shrink-0 ${block}`} />
          <div className={`h-3 flex-1 ${block}`} style={{ maxWidth: `${70 - i * 6}%` }} />
          <div className={`h-5 w-16 shrink-0 ${block}`} />
        </li>
      ))}
    </ul>
  );
}

export function SkeletonPanel({ lines = 4 }: { lines?: number }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-neutral-900 p-5">
      <div className="flex flex-col gap-2">
        <div className={`h-3.5 w-40 ${block}`} />
        <div className={`h-2.5 w-64 ${block}`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className={`h-2 w-24 ${block}`} />
            <div className={`h-8 w-full ${block}`} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className={`aspect-4/3 w-full ${block}`} />
          <div className={`h-2.5 w-3/4 ${block}`} />
        </div>
      ))}
    </div>
  );
}

/**
 * The wrapper every `loading.tsx` uses. `aria-busy` plus a live region is what
 * makes this a loading state rather than a page of grey boxes to a screen
 * reader.
 */
export function SkeletonScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true">
      <span className="sr-only" role="status">
        Cargando…
      </span>
      {children}
    </div>
  );
}
