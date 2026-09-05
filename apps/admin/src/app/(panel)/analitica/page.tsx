import type { Metadata } from "next";
import { db } from "@nassican/db";
import AnalyticsModule from "@/components/AnalyticsModule";
import { getAnalyticsSummary } from "@/lib/analytics-summary";
import { detectAnalyticsProperties, runAnalyticsSync } from "./actions";

export const metadata: Metadata = { title: "Analítica" };

export default async function AnaliticaPage() {
  const [summary, settings] = await Promise.all([
    getAnalyticsSummary(),
    db.seoSettings.findUnique({
      where: { id: 1 },
      select: { ga4MeasurementId: true },
    }),
  ]);

  return (
    <AnalyticsModule
      summary={summary}
      measurementIdSet={Boolean(settings?.ga4MeasurementId)}
      actions={{ sync: runAnalyticsSync, detect: detectAnalyticsProperties }}
    />
  );
}
