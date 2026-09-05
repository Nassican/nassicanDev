import type { Metadata } from "next";
import StatsModule from "@/components/StatsModule";
import { getStats } from "@/lib/stats";
import { runContentCheck } from "./actions";

export const metadata: Metadata = { title: "Estadísticas" };

export default async function EstadisticasPage() {
  const stats = await getStats();
  return <StatsModule stats={stats} actions={{ check: runContentCheck }} />;
}
