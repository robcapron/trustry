import type { NextConfig } from "next";

// cacheComponents volontairement désactivé : toutes les pages sont propres
// à un utilisateur et à un espace (RLS), on privilégie un rendu dynamique
// simple et sûr. A réévaluer quand les écrans seront stabilisés.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
  // L'outil Import OMS (HTML existant) est lu sur disque par sa route : on l'inclut dans le bundle serveur.
  outputFileTracingIncludes: {
    "/**/import-oms/outil": ["./src/modules/import-oms/*.html"],
  },
};

export default nextConfig;
