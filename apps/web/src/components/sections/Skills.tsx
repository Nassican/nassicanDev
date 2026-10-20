import IconSprite from "@/components/ui/IconSprite";
import SkillsBoard, { type BoardGroup } from "@/components/sections/SkillsBoard";
import type { SkillGroupData } from "@/lib/data/technologies";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

/**
 * The skills section: the logos, drawn here on the server, and the board that
 * shows them, which is the only part that needs the browser.
 *
 * Split because a client component's props travel twice — once as HTML and
 * once more inside the page for hydration. This one used to receive every
 * logo's SVG markup and the whole dictionary as props, so the home page carried
 * each logo three times over and half a megabyte of HTML on a phone. Now the
 * sprite is server markup, and the board gets names, colours and two labels.
 */
export default function Skills({
  t,
  locale,
  groups,
}: {
  t: Dictionary;
  locale: Locale;
  /**
   * Read from the database by the page. The group labels come with it now: the
   * dictionary seeded them once and stopped being their source, the same move
   * Configuración made with the menu.
   */
  groups: SkillGroupData[];
}) {
  // The row's own label, with the dictionary as the fallback and not the source:
  // a group with no translation yet reads as its key rather than a blank heading.
  const groupTitles: Record<string, string> = t.skills.groups;
  const board: BoardGroup[] = groups.map((group) => ({
    key: group.key,
    title: group.labels[locale] ?? groupTitles[group.key] ?? group.key,
    items: group.items.map((item) => ({
      key: item.key,
      name: item.name,
      hex: item.hex,
      hasIcon: item.iconSvg !== null,
      mono: item.iconMono,
    })),
  }));

  return (
    <section id="skills" className="w-full scroll-mt-24 px-0 py-12 md:scroll-mt-28">
      {/* Defined once, referenced by every chip below. */}
      <IconSprite groups={groups} />
      <SkillsBoard title={t.skills.title} labels={{ marquee: t.skills.marquee, grid: t.skills.grid }} groups={board} />
    </section>
  );
}
