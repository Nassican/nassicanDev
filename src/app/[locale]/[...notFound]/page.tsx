import { notFound } from "next/navigation";
import { locales } from "@/lib/i18n/config";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale, notFound: ["404"] }));
}

export default function CatchAllPage() {
  notFound();
}
