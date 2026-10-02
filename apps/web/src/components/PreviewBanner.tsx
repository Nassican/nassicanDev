import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";

/**
 * Says, on the page itself, that this is not what visitors see.
 *
 * Without it a preview is indistinguishable from the live site, and the way you
 * find out is by wondering why an unpublished article is public. Fixed to the
 * bottom rather than pushing the layout: the whole point is to see the page as
 * it will be, and a banner that moves everything down defeats that.
 */
export default function PreviewBanner({
  t,
  back,
}: {
  t: Dictionary;
  back: string;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center p-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-amber-500/40 bg-amber-950/90 px-4 py-2 text-xs text-amber-100 shadow-lg backdrop-blur">
        <span className="font-semibold uppercase tracking-wide">
          {t.preview.label}
        </span>
        <span className="hidden sm:inline text-amber-200/80">{t.preview.note}</span>
        <Link
          href={`/api/preview/exit?back=${encodeURIComponent(back)}`}
          prefetch={false}
          className="rounded-full border border-amber-400/50 px-2.5 py-0.5 transition-colors hover:bg-amber-400/20"
        >
          {t.preview.exit}
        </Link>
      </div>
    </div>
  );
}
