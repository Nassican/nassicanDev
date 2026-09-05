import type { Metadata } from "next";
import SystemModule from "@/components/SystemModule";
import { getSystemSummary } from "@/lib/system";
import { checkUptime, detectProjects, refreshDeployments } from "./actions";

export const metadata: Metadata = { title: "Sistema" };

export default async function SistemaPage() {
  const summary = await getSystemSummary();
  return (
    <SystemModule
      summary={summary}
      actions={{ checkUptime, refreshDeployments, detectProjects }}
    />
  );
}
