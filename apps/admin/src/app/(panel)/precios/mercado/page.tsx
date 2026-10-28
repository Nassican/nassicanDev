import type { Metadata } from "next";
import PricingMarket from "@/components/PricingMarket";
import { getPricingMarket } from "@/lib/pricing";
import { listFiltersFromParams } from "@/lib/list-filters";
import { marketSelectionFromParams } from "@/lib/pricing-market";
export const metadata: Metadata = { title: "Mercado de precios" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [view, params] = await Promise.all([getPricingMarket(), searchParams]);
  const selection = marketSelectionFromParams(view.services, view.quotes, params);
  return (
    <PricingMarket
      key={JSON.stringify(selection)}
      view={view}
      filters={listFiltersFromParams(params)}
      selection={selection}
    />
  );
}
