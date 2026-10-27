import type { Metadata } from "next";
import PricingMarket from "@/components/PricingMarket";
import { getPricingMarket } from "@/lib/pricing";
import { listFiltersFromParams } from "@/lib/list-filters";
export const metadata: Metadata = { title: "Mercado de precios" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [view, params] = await Promise.all([getPricingMarket(), searchParams]);
  const one = (k: string) => (typeof params[k] === "string" ? params[k] : "");
  return (
    <PricingMarket
      view={view}
      filters={listFiltersFromParams(params)}
      selection={{
        serviceId: one("serviceId") || view.services[0]?.id || "",
        scope:
          one("scope") === "basic" || one("scope") === "advanced"
            ? (one("scope") as "basic" | "advanced")
            : "standard",
        unit:
          one("unit") === "monthly" || one("unit") === "hour"
            ? (one("unit") as "monthly" | "hour")
            : "project",
        mode:
          one("mode") === "onsite" || one("mode") === "hybrid"
            ? (one("mode") as "onsite" | "hybrid")
            : "remote",
      }}
    />
  );
}
