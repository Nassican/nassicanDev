import type { Metadata } from "next";
import BudgetModule from "@/components/BudgetModule";
import { getBudget } from "@/lib/budget";
import { deleteBudgetLine, saveBudgetLine } from "./actions";

export const metadata: Metadata = { title: "Presupuesto" };

export default async function PresupuestoPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const view = await getBudget(mes);
  return <BudgetModule view={view} actions={{ save: saveBudgetLine, remove: deleteBudgetLine }} />;
}
