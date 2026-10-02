import type { Metadata } from "next";
import FinanceModule from "@/components/FinanceModule";
import { filtersFromParams, getFinances } from "@/lib/wallet";
import { runWalletSync } from "./actions";

export const metadata: Metadata = { title: "Finanzas" };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Filters arrive in the URL rather than in component state, so a filtered view
 * is a link worth keeping and the back button does what it should.
 */
export default async function FinanzasPage({ searchParams }: PageProps) {
  const filters = filtersFromParams(await searchParams);
  const summary = await getFinances(filters);

  return (
    <FinanceModule summary={summary} filters={filters} sync={runWalletSync} />
  );
}
