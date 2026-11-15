import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChannelTable } from "@/components/dashboard/channel-table";
import { DailyChart } from "@/components/dashboard/daily-chart";
import { DashboardControls } from "@/components/dashboard/dashboard-header";
import { ForecastCard } from "@/components/dashboard/forecast-card";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { PillarHealth } from "@/components/dashboard/pillar-health";
import { PriorityAlerts } from "@/components/dashboard/priority-alerts";
import { SkuTable } from "@/components/dashboard/sku-tables";
import { Button } from "@/components/trustry/button";
import { PageHeader } from "@/components/trustry/page-header";
import { EmptyState } from "@/components/trustry/states";
import { canManageMembers } from "@/domain/access";
import { buildPeriod, monthName, parsePeriod, type PeriodKey } from "@/domain/period";
import { dashboardEyebrow } from "@/lib/dates";
import { getDashboard, getForecast, getSyncSummary, getToday, getWorkspace, requireUser } from "@/server/data";

export const metadata: Metadata = { title: "Dashboard" };

const PROFIT_LABEL: Record<PeriodKey, string> = {
  "7j": "Profit net sur 7 jours",
  mois: "Profit net du mois",
  trimestre: "Profit net du trimestre",
};

export default async function DashboardPage({ params, searchParams }: PageProps<"/[espace]/dashboard">) {
  const [{ espace }, query] = await Promise.all([params, searchParams]);
  const periodKey = parsePeriod(query.periode);
  const [user, workspace] = await Promise.all([requireUser(), getWorkspace(espace)]);
  if (!workspace) notFound();

  const [view, sync, today, forecast] = await Promise.all([
    getDashboard(workspace.id, periodKey),
    getSyncSummary(workspace.id),
    getToday(),
    getForecast(workspace.id, periodKey === "trimestre" ? "trimestre" : "mois"),
  ]);
  const period = buildPeriod(periodKey, today);
  const legends: Record<PeriodKey, [string, string]> = {
    "7j": ["7 derniers jours", "7 jours précédents"],
    mois: [monthName(period.current.from), monthName(period.previous.from)],
    trimestre: ["Trimestre", "Trimestre précédent"],
  };

  return (
    <>
      <PageHeader
        eyebrow={dashboardEyebrow()}
        title={`Bonjour ${user.firstName}.`}
        actions={<DashboardControls espace={espace} period={periodKey} sync={sync} />}
      />
      {!view.hasData ? (
        <EmptyState
          icon="connecteurs"
          title="Pas encore de ventes à afficher"
          description="Connectez une marketplace : les commandes, coûts et marges apparaîtront ici après la première synchronisation."
          action={
            <Button asChild variant="primary">
              <Link href={`/${espace}/parametres/connecteurs`}>Connecter une marketplace</Link>
            </Button>
          }
        />
      ) : (
        <>
          <KpiCards view={view} monthLabel={PROFIT_LABEL[periodKey]} />
          <ForecastCard
            forecast={forecast}
            settingsHref={canManageMembers(workspace.role) ? `/${espace}/parametres/espace#objectifs` : null}
          />
          <div className="flex flex-wrap gap-3.5">
            <DailyChart view={view} legendCurrent={legends[periodKey][0]} legendPrevious={legends[periodKey][1]} />
            <ChannelTable view={view} pnlHref={`/${espace}/pnl?periode=${periodKey}`} />
          </div>
          <div className="flex flex-wrap gap-3.5">
            <PriorityAlerts view={view} alertsHref={`/${espace}/alertes`} />
            <PillarHealth view={view} espace={espace} />
          </div>
          <div className="flex flex-wrap gap-3.5">
            <SkuTable title="Top 5 SKU" rows={view.topSkus} href={`/${espace}/pnl?periode=${periodKey}&vue=sku`} />
            <SkuTable title="Flop 5 SKU" rows={view.flopSkus} href={`/${espace}/pnl?periode=${periodKey}&vue=sku`} withCause />
          </div>
        </>
      )}
    </>
  );
}
