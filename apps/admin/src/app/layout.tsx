import type { Metadata } from "next";
import "./globals.css";

/**
 * The admin is a single-operator internal tool, so unlike the public site it is
 * Spanish only and has no `[locale]` segment. The bilingual rule in CLAUDE.md
 * covers what visitors read, not this panel - what it *edits* is still
 * bilingual and validated before publishing.
 */
export const metadata: Metadata = {
  title: {
    default: "App Nassican",
    template: "%s · App Nassican",
  },
  description: "Plataforma de gestión de nassican.com",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
