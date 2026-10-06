import type { Metadata } from "next";
import BudgetModule from "@/components/BudgetModule";
import { getBudget } from "@/lib/budget";
import { changeCategories, changeLimit, close, createBudget, rename, reopen } from "./actions";

export const metadata: Metadata = { title: "Presupuesto" };

export default async function PresupuestoPage() {
  const view = await getBudget();
  return (
    <BudgetModule
      view={view}
      actions={{ create: createBudget, limit: changeLimit, rename, categories: changeCategories, close, reopen }}
    />
  );
}
