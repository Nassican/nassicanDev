import type { Metadata } from "next";
import PricingSettings from "@/components/PricingSettings";
import { getPricingCalculator } from "@/lib/pricing";
export const metadata: Metadata = { title: "Parámetros de precios" };
export default async function Page() {
  const view = await getPricingCalculator();
  return <PricingSettings key={JSON.stringify(view.parameters)} view={view} />;
}
