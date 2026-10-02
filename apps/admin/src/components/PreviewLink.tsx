import { BsBoxArrowUpRight } from "react-icons/bs";
import { previewUrl } from "@/lib/preview";
import type { PreviewKind } from "@nassican/shared/preview";
import type { Locale } from "@nassican/shared";

/**
 * Opens the document on the public site, rendered by the site's own renderer.
 *
 * It shows **what is saved**, not what is currently typed — the preview reads
 * the row, so an unsaved edit is not in it. Said in the tooltip rather than
 * discovered by wondering why a change did not appear.
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
  const href = previewUrl(kind, id, locale);
  if (!href) return null;

  return (
    <a
      href={href}
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
