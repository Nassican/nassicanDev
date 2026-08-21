import { ImageResponse } from "next/og";
import { profile } from "@/lib/data";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale, isLocale, locales } from "@/lib/i18n/config";

export const alt =
  "Jesús David Benavides Chicaiza - Full Stack Web Developer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/**
 * Social card rendered at build time, once per language. Monochrome to match
 * the site's palette; uses only system-safe fonts so no remote font fetch is
 * needed.
 */
export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = getDictionary(isLocale(locale) ? locale : defaultLocale);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
          padding: 80,
          background: "#0a0a0a",
          color: "#ededed",
        }}
      >
        <div
          style={{
            fontSize: 24,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#a3a3a3",
          }}
        >
          Nassican
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>
          {profile.name}
        </div>
        <div style={{ fontSize: 34, color: "#a3a3a3" }}>{t.meta.jobTitle}</div>
        <div style={{ fontSize: 26, color: "#737373", marginTop: 8 }}>
          Next.js · React · TypeScript · NestJS · PostgreSQL
        </div>
      </div>
    ),
    size,
  );
}
