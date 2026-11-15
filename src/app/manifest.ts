import type { MetadataRoute } from "next";
import { withBase } from "@/lib/base-path";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "9raya",
    short_name: "9raya",
    description: "Cours universitaires interactifs : leçons, démonstrations, quiz et séries.",
    start_url: withBase("/tableau-de-bord/"),
    scope: withBase("/"),
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2272d6",
    lang: "fr",
    icons: [
      { src: withBase("/icons/icon.svg"), sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: withBase("/icons/icon-192.png"), sizes: "192x192", type: "image/png" },
      { src: withBase("/icons/icon-512.png"), sizes: "512x512", type: "image/png" },
    ],
  };
}
