import { ImageResponse } from "next/og";
import { profile } from "@/lib/data";

export const alt =
  "Jesús David Benavides Chicaiza — Desarrollador Web Full Stack";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social card rendered at build time. Monochrome to match the site's palette;
 * uses only system-safe fonts so no remote font fetch is needed.
 */
export default function OpengraphImage() {
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
        <div style={{ fontSize: 34, color: "#a3a3a3" }}>
          Desarrollador Web Full Stack
        </div>
        <div style={{ fontSize: 26, color: "#737373", marginTop: 8 }}>
          Next.js · React · TypeScript · NestJS · PostgreSQL
        </div>
      </div>
    ),
    size,
  );
}
