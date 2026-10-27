import type { Metadata } from "next";
import PricingCalculator from "@/components/PricingCalculator";
import { getPricingCalculator } from "@/lib/pricing";
export const metadata: Metadata = { title: "Precios" };
export default async function Page() {
  return <PricingCalculator view={await getPricingCalculator()} />;
}
