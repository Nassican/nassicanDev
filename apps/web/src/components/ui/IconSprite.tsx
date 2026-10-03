import { buildIconSprite } from "@nassican/shared";
import type { SkillGroupData } from "@/lib/data/technologies";

/**
 * Every brand logo on the page, defined once.
 *
 * Rendered before the chips that reference it. A `<use>` pointing at a symbol
 * that has not been parsed yet still resolves — the browser retries once the
 * document finishes — but putting it first means it never has to.
 *
 * Deduplicated by key: a technology can belong to two groups (Git and Docker are
 * in both «Herramientas» and their own), and declaring its symbol twice would
 * reintroduce the duplicate ids the sprite exists to remove.
 */
export default function IconSprite({ groups }: { groups: SkillGroupData[] }) {
  const seen = new Map<string, string>();
  for (const group of groups) {
    for (const item of group.items) {
      if (item.iconSvg && !seen.has(item.key)) seen.set(item.key, item.iconSvg);
    }
  }

  const sprite = buildIconSprite([...seen].map(([key, svg]) => ({ key, svg })));
  if (!sprite) return null;

  return <span aria-hidden dangerouslySetInnerHTML={{ __html: sprite }} />;
}
