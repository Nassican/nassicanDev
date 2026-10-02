import type { Metadata } from "next";
import { cookies } from "next/headers";
import { THEME_COOKIE, themeInitScript } from "@nassican/shared";
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /**
   * The class is decided on the server from the cookie, so the first painted
   * frame is already correct. The inline script below is the belt: it runs
   * before paint on a response that was cached without the cookie, and on a
   * back-navigation restored from the browser's own cache.
   *
   * Reading a cookie opts this layout out of static rendering, which costs
   * nothing here — every page behind it is behind a session check anyway.
   */
  const stored = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = stored === "light" ? "light" : "dark";

  return (
    <html lang="es" className={theme === "dark" ? "dark" : undefined}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
