import type { Metadata } from "next";
import { db } from "@nassican/db";
import AnalyticsModule from "@/components/AnalyticsModule";
import VercelAnalytics from "@/components/VercelAnalytics";
import { getAnalyticsSummary } from "@/lib/analytics-summary";
import { getVercelSummary } from "@/lib/vercel";
import {
  detectAnalyticsProperties,
  runAnalyticsSync,
  runVercelSync,
} from "./actions";

export const metadata: Metadata = { title: "Analítica" };

export default async function AnaliticaPage() {
  const [summary, vercel, settings] = await Promise.all([
    getAnalyticsSummary(),
    getVercelSummary(),
    db.seoSettings.findUnique({
      where: { id: 1 },
      select: { ga4MeasurementId: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsModule
        summary={summary}
        measurementIdSet={Boolean(settings?.ga4MeasurementId)}
        actions={{ sync: runAnalyticsSync, detect: detectAnalyticsProperties }}
      />
      <VercelAnalytics summary={vercel} sync={runVercelSync} />
    </div>
  );
}
