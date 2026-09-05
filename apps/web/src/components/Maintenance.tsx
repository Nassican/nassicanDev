import Image from "next/image";
import type { Dictionary } from "@/lib/i18n";

/**
 * What the whole site becomes while `maintenanceMode` is on.
 *
 * It replaces the page rather than covering it: leaving the real content in
 * the DOM under a notice would still be served to crawlers and to anyone
 * reading the source, which is the opposite of taking the site down.
 *
 * There is no way to return a 503 from here - a layout cannot set a status
 * code - so `robots.index` is switched off in the metadata instead. That is
 * what keeps the notice out of the index.
 */
export default function Maintenance({ t }: { t: Dictionary }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Image
        src="/brand/LogoNassican.png"
        alt="Nassican"
        width={64}
        height={64}
        className="h-16 w-16 rounded-full bg-white ring-1 ring-black/10 dark:ring-white/20"
      />
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t.maintenance.title}
        </h1>
        <p className="mx-auto max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          {t.maintenance.body}
        </p>
      </div>
    </main>
  );
}
