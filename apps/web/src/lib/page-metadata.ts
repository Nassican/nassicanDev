import "server-only";
import { isIndexableDeployment } from "@nassican/shared";
import { getPageSeo, getPageDirectory } from "./data/pages";
import { locales } from "@nassican/shared";
import { getSeoSettings } from "./data/seo-settings";
import { getSiteSettings } from "./data/site-config";
import { pageMetadata as buildMetadata } from "./seo";

/** Resolve editable defaults once; keep the metadata builder pure. */
export async function pageMetadata(input: Parameters<typeof buildMetadata>[0]) {
  const [seo, settings, pageOverride, directory] = await Promise.all([
    getSeoSettings(), getSiteSettings(), getPageSeo(input.path, input.locale), getPageDirectory(),
  ]);
  const page = directory.find((p) => p.route === input.path);
  const availableLocales = (input.availableLocales ?? locales).filter((locale) => {
    const t = page?.translations.find((t) => t.locale === locale);
    return !t?.noindex && (page?.kind !== "custom" || Boolean(t));
  });
  return buildMetadata({
    ...input,
    image: input.image || seo?.defaultOgImageUrl || undefined,
    override: input.override ? { ...input.override, noindex: input.override.noindex || Boolean(pageOverride?.noindex) } : pageOverride,
    availableLocales,
    indexable: isIndexableDeployment(process.env) && !settings.maintenanceMode,
  });
}
