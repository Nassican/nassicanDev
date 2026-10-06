import type { Metadata } from "next";
import ClientProjectsModule from "@/components/ClientProjectsModule";
import { getClientProjects } from "@/lib/client-projects";
import {
  changeClientProjectStatus,
  deleteClientProject,
  logProgress,
  removeProgress,
  saveClientProjectAction,
  setClientProjectFinishedAt,
} from "./actions";

export const metadata: Metadata = { title: "Trabajos" };

export default async function TrabajosPage() {
  const view = await getClientProjects();
  return (
    <ClientProjectsModule
      view={view}
      actions={{
        save: saveClientProjectAction,
        setStatus: changeClientProjectStatus,
        finishedAt: setClientProjectFinishedAt,
        log: logProgress,
        removeEntry: removeProgress,
        remove: deleteClientProject,
      }}
    />
  );
}
