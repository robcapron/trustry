import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PnlFiltersBar } from "@/components/pnl/pnl-filters";
import { PnlTable } from "@/components/pnl/pnl-table";
import { Card } from "@/components/trustry/card";
import { PageHeader } from "@/components/trustry/page-header";
import { EmptyState } from "@/components/trustry/states";
import { buildPeriod, formatRange, parsePeriod } from "@/domain/period";
import { pnlMetrics } from "@/domain/pnl";
import { formatDeltaPercent, formatEur, formatNumber, formatPercent } from "@/lib/format";
import { parsePnlFilters } from "@/lib/search-params";
import { getPnl, getToday, getWorkspace } from "@/server/data";

export const metadata: Metadata = { title: "P&L détaillé" };

export default async function PnlPage({ params, searchParams }: PageProps<"/[espace]/pnl">) {
  const [{ espace }, query] = await Promise.all([params, searchParams]);
  const workspace = await getWorkspace(espace);
  if (!workspace) notFound();
  const periodKey = parsePeriod(query.periode);
  const filters = parsePnlFilters(query);
  const [view, today] = await Promise.all([getPnl(workspace.id, periodKey, filters), getToday()]);
  const period = buildPeriod(periodKey, today);
  const m = pnlMetrics(view.total);
  const filtered = Object.values(filters).some(Boolean);

  const kpis = [
    { label: "CA HT", value: formatEur(m.revenue), sub: m.delta === null ? "" : `${formatDeltaPercent(m.delta)} vs ${formatRange(period.previous)}` },
    { label: "Profit net", value: formatEur(m.profit), sub: "Après tous les coûts" },
    { label: "Marge nette", value: m.margin === null ? "-" : formatPercent(m.margin), sub: "Profit net / CA HT" },
    { label: "TACoS", value: m.tacos === null ? "-" : formatPercent(m.tacos), sub: "Publicité / CA HT total" },
  ];

  return (
    <>
      <PageHeader
        eyebrow={`Du ${formatRange(period.current)} - montants HT`}
        title="P&L détaillé"
        description="Profit réel par canal, pays et SKU : CA HT - commissions - publicité - logistique - retours - coût d'achat."
      />
      <PnlFiltersBar espace={espace} period={periodKey} filters={filters} options={view.options} />
      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <p className="text-ui font-medium text-muted">{k.label}</p>
            <p className="mt-2 text-[24px] leading-none font-bold tracking-[-0.03em] whitespace-nowrap tabular sm:text-kpi">{k.value}</p>
            <p className="mt-2 text-xs text-muted">{k.sub}</p>
          </Card>
        ))}
      </div>
      {view.rows.length === 0 ? (
        <EmptyState
          icon="pnl"
          title={filtered ? "Aucun résultat pour ces filtres" : "Pas encore de ventes sur la période"}
          description={filtered ? "Élargissez la période ou retirez un filtre." : "Les ventes apparaîtront après la première synchronisation d'une marketplace."}
        />
      ) : (
        <Card>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-title font-semibold tracking-[-0.015em]">Détail par canal</h2>
            <p className="text-meta text-muted">
              {formatNumber(view.skuCount)} SKU x boutique
              <span className="lg:hidden"> - détail par SKU sur ordinateur</span>
            </p>
          </div>
          <PnlTable key={JSON.stringify(filters) + periodKey} rows={view.rows} total={view.total} expandAll={Boolean(filters.q)} />
        </Card>
      )}
    </>
  );
}
