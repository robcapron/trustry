import type { Metadata } from "next";
import { UpcomingScreen } from "@/components/screens/upcoming";
import { dashboardEyebrow } from "@/lib/dates";
import { requireUser } from "@/server/data";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <UpcomingScreen
      eyebrow={dashboardEyebrow()}
      title={`Bonjour ${user.firstName}.`}
      phase="Phase 1"
      icon="dashboard"
      features={[
        "Profit net du mois, CA HT, marge nette en %, commandes",
        "Évolution vs période précédente (7 jours, mois, trimestre)",
        "CA HT par jour et répartition par canal",
        "Alertes prioritaires (référence bloquée toujours en tête)",
        "Santé des 7 piliers (score /100)",
        "Top et flop 5 SKU avec la cause",
      ]}
    />
  );
}
