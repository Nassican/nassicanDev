import type { Metadata } from "next";
import { getBillingView } from "@/lib/billing";
import PricingBilling from "@/components/PricingBilling";
export const metadata: Metadata = { title: "Cuotas y cobros" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = await getBillingView({
    quoteId: typeof params.quoteId === "string" ? params.quoteId : undefined,
    projectId: typeof params.projectId === "string" ? params.projectId : undefined,
  });
  return (
    <PricingBilling
      key={`${view.source?.quoteId || view.source?.projectId}:${view.plan?.id ?? "new"}`}
      view={view}
    />
  );
}
