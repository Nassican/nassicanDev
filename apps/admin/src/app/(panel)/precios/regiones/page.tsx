import type { Metadata } from "next";
import PricingRegions from "@/components/PricingRegions";
import { getPricingRegions } from "@/lib/pricing";
import { listFiltersFromParams } from "@/lib/list-filters";
export const metadata: Metadata = { title: "Regiones de precios" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [view, params] = await Promise.all([getPricingRegions(), searchParams]);
  return (
    <PricingRegions
      key={JSON.stringify(params)}
      view={view}
      filters={listFiltersFromParams(params)}
    />
  );
}
