import type { Metadata } from "next";
import PricingRegions from "@/components/PricingRegions";
import { getPricingRegions } from "@/lib/pricing";
export const metadata: Metadata = { title: "Regiones de precios" };
export default async function Page() {
  return <PricingRegions view={await getPricingRegions()} />;
}
