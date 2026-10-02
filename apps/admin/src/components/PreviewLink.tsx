import { BsBoxArrowUpRight } from "react-icons/bs";
import { isPreviewConfigured } from "@/lib/preview";
import type { PreviewKind } from "@nassican/shared/preview";
import type { Locale } from "@nassican/shared";

/**
 * Opens the document on the public site, rendered by the site's own renderer.
 *
 * The href carries no token: it points at `/api/preview` on the panel, which
 * mints one and redirects. That hop exists because the token lasts five
 * minutes and an editing session does not — a link minted when this page
 * rendered would be dead by the time it was clicked, for reasons the operator
 * could not possibly guess.
 *
 * It shows **what is saved**, not what is currently typed: the preview reads
 * the row. The unsaved marker beside the save button is what says so while you
 * are editing; the tooltip repeats it here.
 */
export default function PreviewLink({
  kind,
  id,
  locale = "es",
  className = "",
}: {
  kind: PreviewKind;
  id: string;
  locale?: Locale;
  className?: string;
}) {
  if (!isPreviewConfigured()) return null;

  const params = new URLSearchParams({ kind, id, locale });

  return (
    <a
      href={`/api/preview?${params}`}
      target="_blank"
      rel="noreferrer"
      title="Abre lo último guardado en nassican.com. Guarda primero si acabas de editar."
      className={`inline-flex items-center gap-1.5 rounded border border-neutral-800 px-2.5 py-1.5 text-sm text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200 ${className}`}
    >
      Vista previa
      <BsBoxArrowUpRight className="h-3 w-3" aria-hidden />
    </a>
  );
}
