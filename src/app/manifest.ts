import type { MetadataRoute } from "next";

/** Application installable (PWA) : Chrome sur ordinateur, écran d'accueil sur iPhone. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trustry - Pilotage marketplaces",
    short_name: "Trustry",
    description: "Profit réel, alertes et 7 piliers de vos marketplaces.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#FFFFFF",
    theme_color: "#111214",
    lang: "fr",
    icons: [
      { src: "/icons/android-chrome-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/android-chrome-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-1024.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
    ],
  };
}
