import type { Metadata } from "next";
import { Button } from "@/components/trustry/button";
import { Code, CountBadge, DeltaBadge, StatusBadge } from "@/components/trustry/badge";
import { Card, CardHeader } from "@/components/trustry/card";
import { PageHeader } from "@/components/trustry/page-header";
import { EmptyState, LoadingState, SyncErrorState } from "@/components/trustry/states";
import { formatDeltaPercent, formatDeltaPoints, formatEur, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Design system" };

const SWATCHES = [
  ["Noir Carbone", "#111214", "bg-carbone"],
  ["Jaune Fluo", "#E4FF1A", "bg-fluo"],
  ["Gris Asphalte", "#E9EAEC", "bg-asphalte"],
  ["Fond cartes", "#F5F5F7", "bg-surface"],
  ["Blanc", "#FFFFFF", "bg-blanc border border-line"],
  ["Critique", "#B42318", "bg-critique"],
  ["Important", "#B54708", "bg-important"],
  ["Bon", "#067647", "bg-bon"],
  ["Info", "#175CD3", "bg-info"],
] as const;

/** Référence visuelle des tokens et composants (non listée dans la navigation). */
export default function DesignSystemPage() {
  return (
    <>
      <PageHeader eyebrow="Référence interne" title="Design system Trustry" description="Tokens et composants de base, direction Combo A+B." />
      <Card>
        <CardHeader title="Couleurs" subtitle="Le jaune fluo ne s'utilise jamais en texte sur fond clair." />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SWATCHES.map(([name, hex, cls]) => (
            <li key={name} className="rounded-item bg-blanc p-2.5">
              <span className={`block h-14 rounded-nav ${cls}`} />
              <span className="mt-2 block text-ui font-semibold">{name}</span>
              <span className="text-caption text-muted">{hex}</span>
            </li>
          ))}
        </ul>
      </Card>
      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Typographie et formats FR" />
          <p className="text-hero font-bold tracking-[-0.035em]">{formatEur(3047000)}</p>
          <p className="mt-2 text-kpi font-bold tracking-[-0.03em]">{formatPercent(21.4)}</p>
          <p className="mt-3 font-brand text-[40px] leading-none font-black italic">TRUSTRY</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <DeltaBadge positive>{formatDeltaPercent(12.4)}</DeltaBadge>
            <DeltaBadge positive={false}>{formatDeltaPoints(-0.6)}</DeltaBadge>
            <Code>ACTA-HLM-ADV-BLK-M</Code>
            <CountBadge count={7} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Boutons et statuts" />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary">Débloquer</Button>
            <Button>Journal de synchro</Button>
            <Button variant="primary" size="sm">
              Lancer le réassort
            </Button>
            <Button size="sm">Voir les SKU</Button>
            <Button variant="accent" size="sm">
              Copier
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge tone="critique">Critique</StatusBadge>
            <StatusBadge tone="important">Important</StatusBadge>
            <StatusBadge tone="important">À surveiller</StatusBadge>
            <StatusBadge tone="bon">Bon</StatusBadge>
            <StatusBadge tone="info">Info</StatusBadge>
            <StatusBadge tone="neutre">Non connecté</StatusBadge>
          </div>
        </Card>
      </div>
      <SyncErrorState
        message="le jeton d'accès TikTok Shop a expiré le 13 nov. Aucune commande remontée depuis 2 jours."
        action={
          <Button variant="primary" size="sm">
            Reconnecter
          </Button>
        }
      />
      <EmptyState title="État vide" description="Aucune donnée pour cette période. Élargissez la période ou connectez une marketplace." />
      <LoadingState />
    </>
  );
}
