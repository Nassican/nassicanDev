import type { Metadata } from "next";
import PricingMarket from "@/components/PricingMarket";
import { getPricingMarket } from "@/lib/pricing";
import { listFiltersFromParams } from "@/lib/list-filters";
import { marketSelectionFromParams } from "@/lib/pricing-market";
import { marketComparisonFromParams } from "@/lib/pricing-comparison";
export const metadata: Metadata = { title: "Mercado de precios" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [view, params] = await Promise.all([getPricingMarket(), searchParams]);
  const selection = marketSelectionFromParams(view.services, view.quotes, params);
  const comparisonFilters = marketComparisonFromParams(
    view.services,
    params,
    view.geography.places,
  );
  return (
    <PricingMarket
      key={JSON.stringify(comparisonFilters)}
      view={view}
      filters={listFiltersFromParams(params)}
      selection={selection}
      comparisonFilters={comparisonFilters}
    />
  );
}
