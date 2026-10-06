import type { Metadata } from "next";
import PerformanceModule from "@/components/PerformanceModule";
import { getPageSpeed } from "@/lib/pagespeed";
import { measureNow } from "./actions";

export const metadata: Metadata = { title: "Rendimiento" };

/** «Medir ahora» waits on five Lighthouse runs, up to a minute each, in parallel. */
export const maxDuration = 120;

export default async function RendimientoPage() {
  const view = await getPageSpeed();
  return <PerformanceModule view={view} measure={measureNow} />;
}
