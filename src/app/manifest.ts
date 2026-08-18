import type { MetadataRoute } from "next";
import { defaultDescription, siteName } from "@/lib/seo";
import { profile } from "@/lib/data";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${profile.name} - Portafolio`,
    short_name: siteName,
    description: defaultDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    lang: "es",
    icons: [
      {
        src: "/brand/LogoNassican.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
