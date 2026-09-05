import type { Metadata } from "next";
import SeoModule from "@/components/SeoModule";
import {
  getSearchConsoleSummary,
  getSeoSettingsDraft,
  listRedirects,
} from "@/lib/seo";
import {
  detectSearchConsoleSites,
  runSearchConsoleSync,
  saveRedirects,
  saveSeoSettings,
} from "./actions";

export const metadata: Metadata = { title: "SEO" };

export default async function SeoPage() {
  const [settings, redirects, searchConsole] = await Promise.all([
    getSeoSettingsDraft(),
    listRedirects(),
    getSearchConsoleSummary(),
  ]);

  return (
    <SeoModule
      settings={settings}
      redirects={redirects}
      searchConsole={searchConsole}
      actions={{
        saveSettings: saveSeoSettings,
        saveRedirects,
        sync: runSearchConsoleSync,
        detect: detectSearchConsoleSites,
      }}
    />
  );
}
