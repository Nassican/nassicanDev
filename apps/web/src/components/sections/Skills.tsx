"use client";
import { useState } from "react";
import SectionTitle from "@/components/ui/SectionTitle";
import BrandIcon from "@/components/ui/BrandIcon";
import IconSprite from "@/components/ui/IconSprite";
import Card from "@/components/ui/Card";
import type { Locale } from "@/lib/i18n/config";
import type { SkillGroupData, TechnologyBrand } from "@/lib/data/technologies";
import type { Dictionary } from "@/lib/i18n";

function hexToRgb(hex: string): string {
  const cleanHex = hex.replace("#", "");
  let expandedHex = cleanHex;
  if (cleanHex.length === 3) {
    expandedHex = cleanHex.split("").map(char => char + char).join("");
  }
  const num = parseInt(expandedHex, 16);
  if (isNaN(num)) return "128, 128, 128";
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

function parseColor(color: string, opacity?: number): string {
  if (color === "currentColor") return color;
  if (color.startsWith("#")) {
    const rgb = hexToRgb(color);
    return opacity !== undefined ? `rgba(${rgb}, ${opacity})` : `rgb(${rgb})`;
  }
  return color;
}

/**
 * The chip's tint around the logo — never the logo itself.
 *
 * One hex per technology used to colour the glyph as well, which is why Vite came
 * out entirely yellow: its mark is a cyan-to-purple gradient over a yellow bolt,
 * and `--brand-text` painted all of it one colour. Now `BrandIcon` refuses to
 * inherit when it has a real logo, so this decides the background, the border and
 * the glow, and nothing else.
 */
function getBrandStyles(hex: string): React.CSSProperties {
  return {
    "--brand-bg": parseColor(hex, 0.08),
    "--brand-text": parseColor(hex),
    "--brand-border": parseColor(hex, 0.3),
    "--brand-glow": parseColor(hex, 0.35),
  } as React.CSSProperties;
}

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
  const [viewMode, setViewMode] = useState<"marquee" | "grid">("marquee");
  // Generate perfect repeated list for seamless loop (even repeats & min length)
  function getRepeatedList(list: TechnologyBrand[]) {
    const minItems = 24;
    const repeats = Math.max(2, Math.ceil(minItems / Math.max(1, list.length)));
    const evenRepeats = repeats % 2 === 0 ? repeats : repeats + 1;
    const result: TechnologyBrand[] = [];
    for (let i = 0; i < evenRepeats; i++) {
      result.push(...list);
    }
    return result;
  }

  /**
   * The row's own label, with the dictionary as the fallback and not the source.
   * A group that exists in the table but has no translation yet reads as its key
   * rather than as a blank heading.
   */
  const groupTitles: Record<string, string> = t.skills.groups;
  const getGroupTitle = (group: SkillGroupData) =>
    group.labels[locale] ?? groupTitles[group.key] ?? group.key;
  return (
    <section id="skills" className="w-full scroll-mt-24 px-0 py-12 md:scroll-mt-28">
      {/* Defined once, referenced by every chip below. */}
      <IconSprite groups={groups} />
      {/* Header Section: Title and View Selector */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 mx-auto max-w-5xl">
        <SectionTitle className="mb-0">{t.skills.title}</SectionTitle>
        
        {/* Toggle Mode Button */}
        <div className="inline-flex rounded-full border border-black/10 p-1 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02] text-xs self-start sm:self-auto backdrop-blur-md">
          <button
            type="button"
            onClick={() => setViewMode("marquee")}
            aria-pressed={viewMode === "marquee"}
            className={`px-4 py-1.5 rounded-full transition-all duration-200 cursor-pointer font-medium ${
              viewMode === "marquee"
                ? "bg-foreground text-background shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {t.skills.marquee}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            aria-pressed={viewMode === "grid"}
            className={`px-4 py-1.5 rounded-full transition-all duration-200 cursor-pointer font-medium ${
              viewMode === "grid"
                ? "bg-foreground text-background shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {t.skills.grid}
          </button>
        </div>
      </div>
      {viewMode === "marquee" ? (
        /* Dynamic Marquee View */
        <div className="space-y-8">
          {groups.map((group, idx) => {
            const repeatedList = getRepeatedList(group.items);
            return (
              <div key={group.key} className="space-y-3">
                {/* Section title positioned static, no fading */}
                <div className="px-4 mx-auto max-w-5xl">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                    {getGroupTitle(group)}
                  </h3>
                </div>
                {/* Infinite scrolling row */}
                <div
                  className={`marquee ${
                    idx % 2 === 0 ? "marquee-animate-rtl" : "marquee-animate-ltr"
                  }`}
                >
                  <div className="marquee-track py-4">
                    {repeatedList.map((item, i) => {
                      return (
                        <span
                          key={`${item.key}-${i}`}
                          style={getBrandStyles(item.hex)}
                          className="group relative mx-3 inline-flex items-center gap-3 rounded-full border border-black/10 px-5 py-2.5 text-sm text-zinc-700 transition-all duration-300 hover:bg-[var(--brand-bg)] hover:text-[var(--brand-text)] hover:border-[var(--brand-border)] hover:shadow-[0_0_15px_var(--brand-glow)] dark:border-white/10 dark:text-zinc-200"
                        >
                          <BrandIcon
                            name={item.name}
                            itemKey={item.key}
                            hasIcon={item.iconSvg !== null}
                            mono={item.iconMono}
                            className="h-7 w-7 transition-transform duration-300 group-hover:scale-110"
                          />
                          <span>{item.name}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Static Categorized Grid View */
        <div className="grid gap-6 px-4 mx-auto max-w-5xl sm:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.key} className="flex flex-col gap-4 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                  {getGroupTitle(group)}
                </h3>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {group.items.map((item) => {
                  return (
                    <span
                      key={item.key}
                      style={getBrandStyles(item.hex)}
                      className="group relative inline-flex items-center gap-2.5 rounded-full border border-black/10 px-4 py-2 text-xs text-zinc-700 transition-all duration-300 hover:bg-[var(--brand-bg)] hover:text-[var(--brand-text)] hover:border-[var(--brand-border)] hover:shadow-[0_0_12px_var(--brand-glow)] dark:border-white/10 dark:text-zinc-200"
                    >
                      <BrandIcon
                        name={item.name}
                        itemKey={item.key}
                        hasIcon={item.iconSvg !== null}
                        mono={item.iconMono}
                        className="h-5 w-5 transition-transform duration-300 group-hover:scale-110"
                      />
                      <span>{item.name}</span>
                    </span>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
