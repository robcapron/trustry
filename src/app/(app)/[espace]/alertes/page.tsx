import type { Metadata } from "next";
import { UpcomingScreen } from "@/components/screens/upcoming";

export const metadata: Metadata = { title: "Alertes" };

export default function AlertesPage() {
  return (
    <UpcomingScreen
      title="Alertes"
      description="Toutes les alertes de l'espace, priorisées : une référence bloquée passe toujours avant un réassort."
      phase="Phase 2"
      icon="alertes"
      features={[
        "Filtres critique / important / info",
        "SKU concernés ou baisse liée au compte",
        "Action suggérée en un clic",
        "Statut : à traiter, en cours, résolu",
        "Notifications push sur iPhone pour les alertes critiques",
      ]}
    />
  );
}
