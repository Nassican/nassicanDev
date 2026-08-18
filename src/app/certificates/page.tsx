import type { Metadata } from "next";
import CertificatesClient from "./CertificatesClient";
import { certificates } from "@/lib/data";
import { certificatesJsonLd } from "@/lib/seo";

const description = `Listado de ${certificates.length} certificados y cursos completados por Jesús David Benavides Chicaiza en desarrollo frontend, Git y GitHub, e idiomas. Filtra por proveedor y categoría.`;

export const metadata: Metadata = {
  title: "Certificados y cursos",
  description,
  alternates: {
    canonical: "/certificates",
  },
  openGraph: {
    type: "website",
    url: "/certificates",
    title: "Certificados y cursos | Jesús David Benavides Chicaiza",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Certificados y cursos | Jesús David Benavides Chicaiza",
    description,
  },
};

export default function CertificatesPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(certificatesJsonLd) }}
      />
      <CertificatesClient />
    </main>
  );
}
