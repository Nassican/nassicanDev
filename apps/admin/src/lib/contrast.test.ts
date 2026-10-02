import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

/**
 * The panel's two themes, measured against the rule instead of against taste.
 *
 * This exists because the dark theme shipped with its faintest text at 2.29 on a
 * card and nobody noticed for months: nothing fails, nothing warns, and the
 * screen looks deliberate. The only thing that catches it is arithmetic, so the
 * arithmetic runs in CI.
 *
 * It reads the real `globals.css`. A value nudged by eye in that file fails here
 * with the ratio it would have shipped.
 */

const CSS = readFileSync(
  join(import.meta.dirname, "..", "app", "globals.css"),
  "utf8",
);

const channels = (hex: string): number[] => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
};

const luminance = (hex: string): number => {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** The declarations inside one selector's block in `globals.css`. */
function block(selector: string): Record<string, string> {
  const start = CSS.indexOf(`${selector} {`);
  assert.ok(start >= 0, `no existe el bloque ${selector} en globals.css`);
  const body = CSS.slice(start, CSS.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]),
  );
}

/**
 * Dark mode only overrides the three steps it had to, so the rest are Tailwind's
 * own, read from the built stylesheet. If Tailwind changes its neutral ramp,
 * these go stale — which is exactly when this test should be re-run by hand.
 */
const TAILWIND_DARK: Record<string, string> = {
  "--color-neutral-950": "#0a0a0a",
  "--color-neutral-900": "#171717",
  "--color-neutral-800": "#262626",
  "--color-neutral-700": "#404040",
  "--color-neutral-600": "#525252",
  "--color-neutral-500": "#737373",
  "--color-neutral-400": "#a1a1a1",
  "--color-neutral-300": "#d4d4d4",
  "--color-neutral-200": "#e5e5e5",
  "--color-neutral-100": "#f5f5f5",
};

const dark = { ...TAILWIND_DARK, ...block(":root.dark") };
const light = block(":root:not(.dark)");

/**
 * The surfaces text actually lands on, per theme. `#262626` is left out of the
 * dark list on purpose: that chip only ever carries `text-neutral-100`, which is
 * checked below so the omission cannot quietly stop being true.
 */
const surfaces = {
  oscuro: [dark["--color-neutral-950"], dark["--color-neutral-900"]],
  claro: [
    light["--color-neutral-950"],
    light["--background"],
    light["--color-neutral-900"],
  ],
};

/** Steps used as text in the panel, faintest first. */
const TEXT_STEPS = [600, 500, 400, 300, 200, 100];

for (const [theme, backgrounds] of Object.entries(surfaces)) {
  const ramp = theme === "oscuro" ? dark : light;

  for (const step of TEXT_STEPS) {
    test(`${theme}: text-neutral-${step} cumple AA sobre cada superficie`, () => {
      const colour = ramp[`--color-neutral-${step}`];
      assert.ok(colour, `falta --color-neutral-${step} en el tema ${theme}`);

      for (const bg of backgrounds) {
        const ratio = contrast(colour, bg);
        assert.ok(
          ratio >= 4.5,
          `${colour} sobre ${bg} da ${ratio.toFixed(2)}, por debajo de 4.5`,
        );
      }
    });
  }

  /**
   * The buttons are outline buttons, so the border is what identifies them as
   * pressable. 1.4.11 asks 3:1 of it, and both themes used to be under 2.
   */
  test(`${theme}: el borde de los botones cumple 3:1`, () => {
    const colour = ramp["--color-neutral-700"];
    for (const bg of backgrounds) {
      const ratio = contrast(colour, bg);
      assert.ok(
        ratio >= 3,
        `borde ${colour} sobre ${bg} da ${ratio.toFixed(2)}, por debajo de 3`,
      );
    }
  });

  /**
   * N is depth, so the order has to hold: a remap that lifts one step past its
   * neighbour inverts the hierarchy without failing any contrast check.
   */
  test(`${theme}: la escala sigue ordenada de tenue a fuerte`, () => {
    const lums = TEXT_STEPS.map((s) => luminance(ramp[`--color-neutral-${s}`]));
    const expected = theme === "oscuro" ? "creciente" : "decreciente";

    for (let i = 1; i < lums.length; i++) {
      const ok = theme === "oscuro" ? lums[i] > lums[i - 1] : lums[i] < lums[i - 1];
      assert.ok(
        ok,
        `neutral-${TEXT_STEPS[i]} rompe el orden ${expected} frente a neutral-${TEXT_STEPS[i - 1]}`,
      );
    }
  });
}

/**
 * The one surface the tables above leave out. It is safe to leave out only while
 * nothing faint is written on it, so that is asserted rather than assumed — this
 * is the check that failed to exist the first time round.
 */
test("el chip bg-neutral-800 solo lleva el texto más fuerte", () => {
  const src = readFileSync(
    join(import.meta.dirname, "..", "components", "BlockEditor.tsx"),
    "utf8",
  );

  for (const match of src.matchAll(/bg-neutral-800[^"'`]*/g)) {
    assert.ok(
      !/text-neutral-(500|600|700)/.test(match[0]),
      `texto tenue sobre #262626: ${match[0]}`,
    );
  }
});
