"use server";

import { revalidatePath } from "next/cache";
import { cacheTags } from "@nassican/shared";
import { notifyPublicSite } from "@/lib/revalidate";
import { logAudit } from "@/lib/audit";
import { deviconIndex, fetchDeviconSvg, searchDevicons } from "@/lib/devicon";
import { setTechnologyColor, setTechnologyIcon } from "@/lib/skills";
import { requireUser } from "@/lib/session";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export type IconChoice = {
  name: string;
  variants: string[];
  color: string;
};

/**
 * Searches devicon for the picker.
 *
 * Runs on demand rather than shipping 578 entries to the browser with the page:
 * the operator opens this for one technology at a time, and the list is only
 * needed while the picker is open.
 */
export async function findIcons(query: string): Promise<IconChoice[]> {
  await requireUser();

  const index = await deviconIndex();
  return searchDevicons(index, query).map((entry) => ({
    name: entry.name,
    // Only the variants worth offering. `-wordmark` draws the brand *name*, which
    // is a logo for a header and not an icon for a chip.
    variants: entry.variants.filter((v) => !v.includes("wordmark")),
    color: entry.color,
  }));
}

/**
 * Fetches the markup for a preview, without storing it.
 *
 * The operator sees the real logo at the real size before committing, which for
 * a multi-colour mark is the only way to tell `original` from `plain` apart.
 */
export async function previewIcon(
  deviconName: string,
  variant: string,
  key: string,
): Promise<{ ok: true; svg: string } | { ok: false; message: string }> {
  await requireUser();

  const svg = await fetchDeviconSvg(deviconName, variant, key);
  if (!svg) return { ok: false, message: `No se pudo leer ${deviconName}-${variant}.` };
  return { ok: true, svg };
}

export async function chooseIcon(
  technologyId: string,
  key: string,
  deviconName: string,
  variant: string,
): Promise<ActionResult> {
  const user = await requireUser();

  const svg = await fetchDeviconSvg(deviconName, variant, key);
  if (!svg) {
    return { ok: false, message: `No se pudo leer ${deviconName}-${variant}.` };
  }

  const name = await setTechnologyIcon(technologyId, {
    deviconName,
    deviconVariant: variant,
    svg,
  });

  await logAudit({
    userId: user.id,
    action: "update",
    entityType: "technology",
    entityId: technologyId,
    diff: { icon: `${deviconName}-${variant}` },
  });

  revalidatePath("/habilidades");
  // Two deployments, so revalidateTag here would reach nothing. The notice goes
  // over HTTP, in after(), so the save does not wait for it.
  notifyPublicSite([cacheTags.skills]);

  return { ok: true, message: `${name}: icono ${variant === "original" ? "a color" : "monocolor"} guardado.` };
}

export async function clearIcon(technologyId: string): Promise<ActionResult> {
  const user = await requireUser();

  const name = await setTechnologyIcon(technologyId, null);
  await logAudit({
    userId: user.id,
    action: "update",
    entityType: "technology",
    entityId: technologyId,
    diff: { icon: null },
  });

  revalidatePath("/habilidades");
  notifyPublicSite([cacheTags.skills]);
  return { ok: true, message: `${name}: icono quitado.` };
}

export async function setColor(technologyId: string, hex: string): Promise<ActionResult> {
  const user = await requireUser();

  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return { ok: false, message: "El color tiene que ser un hex de seis dígitos." };
  }

  const name = await setTechnologyColor(technologyId, hex);
  await logAudit({
    userId: user.id,
    action: "update",
    entityType: "technology",
    entityId: technologyId,
    diff: { hex },
  });

  revalidatePath("/habilidades");
  notifyPublicSite([cacheTags.skills]);
  return { ok: true, message: `${name}: color guardado.` };
}
