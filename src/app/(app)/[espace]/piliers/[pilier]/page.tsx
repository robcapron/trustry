import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UpcomingScreen } from "@/components/screens/upcoming";
import { pillarBySlug } from "@/domain/pillars";

const FEATURES: Record<number, string[]> = {
  1: ["Suivi J+90 des nouveaux produits", "Workflow Go-To-Market par étapes", "Objectifs de ventes vs réalisé", "Alertes de lancement en retard"],
  2: ["Prix et quantités par devise", "Score qualité des fiches", "Médias manquants", "Ruptures et couverture de stock"],
  3: ["FBM, Prime, délais 24 h / 48 h", "Transporteurs et coûts", "Taux d'expédition à temps", "Retards par marketplace"],
  4: ["Références bloquées ou supprimées", "Erreurs catalogue par marketplace", "Motif de blocage et action de déblocage", "Priorité absolue sur le réassort"],
  5: ["Dépenses publicitaires", "TACoS et ROAS par campagne", "Campagnes au-dessus de la cible", "Promos Black Friday, Prime Day"],
  6: ["Import des commandes", "Statut et tracking", "Anomalies de remontée", "Commandes en attente par connecteur"],
  7: ["Retours et motifs", "Messages clients", "Délais de réponse", "Taux de retour par SKU"],
};

export async function generateMetadata({ params }: PageProps<"/[espace]/piliers/[pilier]">): Promise<Metadata> {
  const { pilier } = await params;
  return { title: pillarBySlug(pilier)?.title ?? "Pilier" };
}

export default async function PilierPage({ params }: PageProps<"/[espace]/piliers/[pilier]">) {
  const { pilier } = await params;
  const p = pillarBySlug(pilier);
  if (!p) notFound();
  return (
    <UpcomingScreen
      eyebrow={`Pilier ${p.number} sur 7`}
      title={p.title}
      description={p.description}
      phase="Phase 5"
      icon={p.icon}
      features={[...FEATURES[p.number], "KPI, liste filtrable et actions (page type commune)"]}
    />
  );
}
