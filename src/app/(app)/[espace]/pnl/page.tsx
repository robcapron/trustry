import type { Metadata } from "next";
import { UpcomingScreen } from "@/components/screens/upcoming";

export const metadata: Metadata = { title: "P&L détaillé" };

export default function PnlPage() {
  return (
    <UpcomingScreen
      title="P&L détaillé"
      description="Profit réel par canal, pays et SKU. Montants en € HT, marges en %."
      phase="Phase 2"
      icon="pnl"
      features={[
        "Tableau dépliable canal > pays > SKU",
        "CA HT, commissions, publicité, logistique, retours, coût d'achat",
        "Marge nette en % à chaque niveau",
        "Filtres période, canal, pays, marque",
        "Export CSV (sur ordinateur)",
      ]}
    />
  );
}
