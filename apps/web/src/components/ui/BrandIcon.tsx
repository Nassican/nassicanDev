import { iconSymbolId } from "@nassican/shared";
import SkillIcon from "@/components/ui/SkillIcon";

/**
 * A technology's logo: the real brand mark when there is one, the monochrome
 * fallback when there is not.
 *
 * **The tint is the thing to get right.** `SkillIcon` draws a single path from
 * `react-icons/si` and inherits `color`, which is what the skills section sets
 * from the stored hex — and that is why Vite came out entirely yellow when its
 * mark is a cyan-to-purple gradient over a yellow bolt. A real logo brings its
 * own colours, so it must not inherit: `color: initial` pins it while the chip
 * around it keeps being tinted.
 *
 * **It references a sprite rather than inlining.** Inlining once per chip made the
 * home page 53.7% inline SVG, 275 KB of it the same logos repeated, because the
 * marquee duplicates its list to loop. `<use>` points at a `<symbol>` defined once
 * by `IconSprite`, which also stops ten copies of one icon declaring the same
 * gradient id ten times.
 */
export default function BrandIcon({
  name,
  itemKey,
  hasIcon,
  className = "w-6 h-6",
}: {
  name: string;
  /** The technology's registry key, which is what the symbol id is built from. */
  itemKey: string;
  hasIcon: boolean;
  className?: string;
}) {
  if (!hasIcon) return <SkillIcon name={name} className={className} />;

  return (
    <svg
      aria-hidden
      focusable="false"
      className={className}
      style={{ color: "initial" }}
    >
      <use href={`#${iconSymbolId(itemKey)}`} />
    </svg>
  );
}
