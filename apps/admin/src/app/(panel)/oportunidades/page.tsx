import type { Metadata } from "next";
import OpportunitiesModule from "@/components/OpportunitiesModule";
import { getOpportunities } from "@/lib/opportunities";
import {
  changeStage,
  deleteOpportunity,
  logConversation,
  removeEntry,
  saveOpportunityAction,
} from "./actions";

export const metadata: Metadata = { title: "Oportunidades" };

export default async function OportunidadesPage() {
  const view = await getOpportunities();
  return (
    <OpportunitiesModule
      view={view}
      actions={{
        save: saveOpportunityAction,
        setStage: changeStage,
        log: logConversation,
        removeEntry,
        remove: deleteOpportunity,
      }}
    />
  );
}
