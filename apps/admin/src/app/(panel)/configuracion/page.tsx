import type { Metadata } from "next";
import ConfigModule from "@/components/ConfigModule";
import { getConfigDraft } from "@/lib/site-config";
import { saveNavigation, saveSettings } from "./actions";

export const metadata: Metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const draft = await getConfigDraft();
  return (
    <ConfigModule draft={draft} actions={{ saveSettings, saveNavigation }} />
  );
}
