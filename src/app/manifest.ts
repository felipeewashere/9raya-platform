import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "9raya",
    short_name: "9raya",
    description: "Cours universitaires interactifs : leçons, démonstrations, quiz et séries.",
    start_url: "/tableau-de-bord",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2272d6",
    lang: "fr",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
