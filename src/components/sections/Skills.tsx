"use client";
import { useState } from "react";
import SectionTitle from "@/components/ui/SectionTitle";
import SkillIcon from "@/components/ui/SkillIcon";
import Card from "@/components/ui/Card";
import { skills, skillsRegistry } from "@/lib/skillsData";

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

function getBrandStyles(itemName: string): React.CSSProperties {
  const config = skillsRegistry[itemName];
  if (!config) {
    return {
      "--brand-bg": "rgba(128, 128, 128, 0.08)",
      "--brand-text": "currentColor",
      "--brand-border": "rgba(128, 128, 128, 0.2)",
      "--brand-glow": "rgba(128, 128, 128, 0.15)",
    } as React.CSSProperties;
  }

  const bgHex = config.bg || config.hex;
  const textHex = config.text || config.hex;
  const borderHex = config.border || config.hex;
  const glowHex = config.glow || config.hex;
  const glowOpacity = config.glowOpacity ?? 0.35;

  return {
    "--brand-bg": parseColor(bgHex, 0.08),
    "--brand-text": parseColor(textHex),
    "--brand-border": parseColor(borderHex, 0.3),
    "--brand-glow": parseColor(glowHex, glowOpacity),
  } as React.CSSProperties;
}
export default function Skills() {
  const [viewMode, setViewMode] = useState<"marquee" | "grid">("marquee");
  // Generate perfect repeated list for seamless loop (even repeats & min length)
  function getRepeatedList(list: string[]) {
    const minItems = 24;
    const repeats = Math.max(2, Math.ceil(minItems / list.length));
    const evenRepeats = repeats % 2 === 0 ? repeats : repeats + 1;
    const result: string[] = [];
    for (let i = 0; i < evenRepeats; i++) {
      result.push(...list);
    }
    return result;
  }
  const getGroupTitle = (group: string) => {
    switch (group) {
      case "frontend":
        return "Desarrollo Frontend";
      case "backend":
        return "Desarrollo Backend";
      case "databases":
        return "Bases de Datos";
      case "tools":
        return "Herramientas y DevOps";
      default:
        return group;
    }
  };
  return (
    <section id="skills" className="w-full scroll-mt-24 px-0 py-12 md:scroll-mt-28">
      {/* Header Section: Title and View Selector */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 mx-auto max-w-5xl">
        <SectionTitle className="mb-0">Tecnologías</SectionTitle>
        
        {/* Toggle Mode Button */}
        <div className="inline-flex rounded-full border border-black/10 p-1 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02] text-xs self-start sm:self-auto backdrop-blur-md">
          <button
            onClick={() => setViewMode("marquee")}
            className={`px-4 py-1.5 rounded-full transition-all duration-200 cursor-pointer font-medium ${
              viewMode === "marquee"
                ? "bg-foreground text-background shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            
            Carrusel
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`px-4 py-1.5 rounded-full transition-all duration-200 cursor-pointer font-medium ${
              viewMode === "grid"
                ? "bg-foreground text-background shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            Cuadrícula
          </button>
        </div>
      </div>
      {viewMode === "marquee" ? (
        /* Dynamic Marquee View */
        <div className="space-y-8">
          {Object.entries(skills).map(([group, list], idx) => {
            const repeatedList = getRepeatedList(list);
            return (
              <div key={group} className="space-y-3">
                {/* Section title positioned static, no fading */}
                <div className="px-4 mx-auto max-w-5xl">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
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
                          key={`${item}-${i}`}
                          style={getBrandStyles(item)}
                          className="group relative mx-3 inline-flex items-center gap-3 rounded-full border border-black/10 px-5 py-2.5 text-sm text-zinc-700 transition-all duration-300 hover:bg-[var(--brand-bg)] hover:text-[var(--brand-text)] hover:border-[var(--brand-border)] hover:shadow-[0_0_15px_var(--brand-glow)] dark:border-white/10 dark:text-zinc-200"
                        >
                          <SkillIcon
                            name={item}
                            className="h-7 w-7 transition-transform duration-300 group-hover:scale-110"
                          />
                          <span>{item}</span>
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
          {Object.entries(skills).map(([group, list]) => (
            <Card key={group} className="flex flex-col gap-4 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                  {getGroupTitle(group)}
                </h3>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {list.map((item) => {
                  return (
                    <span
                      key={item}
                      style={getBrandStyles(item)}
                      className="group relative inline-flex items-center gap-2.5 rounded-full border border-black/10 px-4 py-2 text-xs text-zinc-700 transition-all duration-300 hover:bg-[var(--brand-bg)] hover:text-[var(--brand-text)] hover:border-[var(--brand-border)] hover:shadow-[0_0_12px_var(--brand-glow)] dark:border-white/10 dark:text-zinc-200"
                    >
                      <SkillIcon
                        name={item}
                        className="h-5 w-5 transition-transform duration-300 group-hover:scale-110"
                      />
                      <span>{item}</span>
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