import type { Metadata } from "next";
import PricingQuotes from "@/components/PricingQuotes";
import { listPricingQuotes } from "@/lib/pricing";
import { listFiltersFromParams } from "@/lib/list-filters";
export const metadata: Metadata = { title: "Cotizaciones" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [rows, params] = await Promise.all([listPricingQuotes(), searchParams]);
  return <PricingQuotes rows={rows} filters={listFiltersFromParams(params)} />;
}
