import type { Metadata } from "next";
import NotFoundContent from "@/components/NotFoundContent";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "404 | Nassican",
  description:
    "La página solicitada no existe. The requested page does not exist.",
};

export default function GlobalNotFound() {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <NotFoundContent />
      </body>
    </html>
  );
}
