/** Les 7 piliers de la gestion marketplace. */

export type PillarIcon =
  | "sourcing"
  | "catalogue"
  | "expedition"
  | "integration"
  | "publicite"
  | "commandes"
  | "sav";

export type Pillar = {
  number: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  slug: string;
  navLabel: string;
  cardLabel: string;
  title: string;
  description: string;
  icon: PillarIcon;
};

export const PILLARS: readonly Pillar[] = [
  {
    number: 1,
    slug: "sourcing-lancement",
    navLabel: "Sourcing et lancement",
    cardLabel: "Sourcing et lancement",
    title: "Sourcing et lancement produits",
    description: "Suivi J+90 des nouveaux produits et workflow Go-To-Market par étapes.",
    icon: "sourcing",
  },
  {
    number: 2,
    slug: "catalogue",
    navLabel: "Catalogue produits",
    cardLabel: "Catalogue produits",
    title: "Catalogue produits",
    description: "Prix et quantités par devise, score qualité des fiches, médias.",
    icon: "catalogue",
  },
  {
    number: 3,
    slug: "expedition-logistique",
    navLabel: "Expédition et logistique",
    cardLabel: "Promesse d'expédition",
    title: "Promesse d'expédition et logistique",
    description: "FBM, Prime, délais 24 h / 48 h, transporteurs, taux d'expédition à temps.",
    icon: "expedition",
  },
  {
    number: 4,
    slug: "integration",
    navLabel: "Intégration produits",
    cardLabel: "Intégration produits",
    title: "Intégration produits",
    description: "Références bloquées ou supprimées, erreurs catalogue, statut par marketplace.",
    icon: "integration",
  },
  {
    number: 5,
    slug: "publicite-deals",
    navLabel: "Publicité et deals",
    cardLabel: "Publicité et deals",
    title: "Publicité et deals",
    description: "Dépenses, TACoS, ROAS, campagnes, promos (Black Friday, Prime Day).",
    icon: "publicite",
  },
  {
    number: 6,
    slug: "commandes",
    navLabel: "Remontée des commandes",
    cardLabel: "Remontée des commandes",
    title: "Remontée des commandes",
    description: "Import, statut, tracking, anomalies.",
    icon: "commandes",
  },
  {
    number: 7,
    slug: "service-apres-vente",
    navLabel: "Service après-vente",
    cardLabel: "Service après-vente",
    title: "Service après-vente",
    description: "Retours, messages clients, délais de réponse.",
    icon: "sav",
  },
] as const;

export function pillarBySlug(slug: string): Pillar | undefined {
  return PILLARS.find((p) => p.slug === slug);
}

export type HealthStatus = "good" | "watch" | "critical";

export const HEALTH_LABEL: Record<HealthStatus, string> = {
  good: "Bon",
  watch: "À surveiller",
  critical: "Critique",
};

/** Seuils relevés sur la maquette : Bon >= 75, À surveiller 60-74, Critique < 60. */
export function healthFromScore(score: number): HealthStatus {
  if (score >= 75) return "good";
  if (score >= 60) return "watch";
  return "critical";
}
