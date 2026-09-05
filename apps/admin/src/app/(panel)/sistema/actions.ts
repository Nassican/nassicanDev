"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { runUptimeCheck } from "@/lib/uptime";
import { listVercelProjects, syncDeployments } from "@/lib/vercel";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export type ProjectList = {
  ok: boolean;
  message: string;
  projects: { id: string; name: string; framework: string | null }[];
};

export async function checkUptime(): Promise<ActionResult> {
  await requireUser();

  const result = await runUptimeCheck();
  revalidatePath("/sistema");

  if (!result.ok) return { ok: false, message: result.reason };

  return {
    ok: result.isOk,
    message: result.isOk
      ? `El sitio respondió ${result.statusCode} en ${result.responseMs} ms.`
      : `El sitio respondió ${result.statusCode ?? "nada"} en ${result.responseMs} ms.`,
  };
}

export async function refreshDeployments(): Promise<ActionResult> {
  await requireUser();

  const result = await syncDeployments();
  revalidatePath("/sistema");

  if (!result.ok) return { ok: false, message: result.reason };

  if (result.skipped.length > 0) {
    return {
      ok: true,
      message:
        `${result.rows} despliegues sincronizados. Sin leer: ` +
        result.skipped.map((s) => `${s.project} (${s.reason})`).join(", "),
    };
  }

  return { ok: true, message: `${result.rows} despliegues sincronizados.` };
}

/**
 * The project ids are not guessable, so the panel asks Vercel for them instead
 * of asking the operator to go digging in the dashboard - the same thing the
 * GA4 and Search Console modules do with their own ids.
 */
export async function detectProjects(): Promise<ProjectList> {
  await requireUser();

  try {
    const projects = await listVercelProjects();
    return {
      ok: true,
      message: `${projects.length} proyectos en la cuenta.`,
      projects,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "no se pudo consultar",
      projects: [],
    };
  }
}
