/**
 * «Cambios sin guardar», next to the button that fixes it.
 *
 * Not a badge: the status chips in these headers describe the row as it is
 * stored, and this describes the tab. A dot plus a word reads as a different
 * kind of thing, which is the point.
 */
export default function Unsaved({ label = true }: { label?: boolean }) {
  return (
    <span
      className="flex items-center gap-1.5 text-xs text-amber-500"
      title={label ? undefined : "Hay cambios sin guardar"}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      {label ? "Cambios sin guardar" : <span className="sr-only">Sin guardar</span>}
    </span>
  );
}
