import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CertificatesClient from "./CertificatesClient";
import { getDictionary } from "@/lib/i18n";
import { isLocale, locales } from "@/lib/i18n/config";
import { certificatesJsonLd, pageMetadata } from "@/lib/seo";

type PageParams = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);

  return pageMetadata({
    locale,
    path: "/certificates",
    title: t.certificates.title,
    description: t.certificates.metaDescription,
  });
}

export default async function CertificatesPage({ params }: PageParams) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(certificatesJsonLd(locale)),
        }}
      />
      <CertificatesClient locale={locale} t={t} />
    </main>
  );
}
