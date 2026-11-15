import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkline } from "@/components/dashboard/sparkline";
import { StatusBadge, type Tone } from "@/components/trustry/badge";
import { Card, CardHeader } from "@/components/trustry/card";
import { Icon } from "@/components/trustry/icons";
import { PageHeader } from "@/components/trustry/page-header";
import { EmptyState } from "@/components/trustry/states";
import {
  lastClosedMonth,
  monthLabel,
  previousMonth,
  type BreakdownRow,
  type MonthSummary,
  type Pole,
  type PoleStatus,
} from "@/domain/monthly-review";
import { formatDeltaPercent, formatDeltaPoints, formatEur, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getMonthlyReview, getToday, getWorkspace } from "@/server/data";

export const metadata: Metadata = { title: "Revue mensuelle" };

const STATUS: Record<PoleStatus, { tone: Tone; label: string }> = {
  good: { tone: "bon", label: "Sous la cible" },
  watch: { tone: "important", label: "À surveiller" },
  critical: { tone: "critique", label: "Au-dessus de la cible" },
};

const pct = (v: number | null) => (v === null ? "-" : formatPercent(v));

function PoleCard({ pole }: { pole: Pole }) {
  const s = STATUS[pole.status];
  // Pour ces taux, baisser est une amélioration
  const deltaTone =
    pole.deltaPoints === null || Math.abs(pole.deltaPoints) < 0.05 ? "text-muted" : pole.deltaPoints < 0 ? "text-bon" : "text-critique";
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-card bg-surface px-6 py-[22px]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-title font-semibold tracking-[-0.015em]">{pole.label}</h2>
        <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-ui text-muted">{pole.metricLabel}</p>
          <p className="text-kpi font-bold tracking-[-0.03em] tabular">{pct(pole.value)}</p>
        </div>
        <Sparkline values={pole.series} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          Cible <b className="text-ink">{formatPercent(pole.target)}</b>
        </span>
        {pole.deltaPoints !== null ? (
          <span className={cn("font-semibold", deltaTone)}>{formatDeltaPoints(pole.deltaPoints)} vs M-1</span>
        ) : null}
        <span>
          Montant <b className="text-ink tabular">{formatEur(pole.amount)}</b>
        </span>
      </div>
      {pole.levers.length ? (
        <ul className="flex flex-col gap-1.5 border-t border-line pt-3 text-meta text-ink-2">
          {pole.levers.map((l) => (
            <li key={l} className="flex gap-2">
              <span className="mt-0.5 flex-none text-muted">
                <Icon name="arrowRight" size={14} />
              </span>
              {l}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function OperatingTable({ months, selected }: { months: MonthSummary[]; selected: string }) {
  const th = "px-1.5 pb-2 text-right font-medium whitespace-nowrap";
  const td = "px-1.5 py-2 text-right whitespace-nowrap tabular";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] border-collapse text-meta">
        <thead>
          <tr className="text-2xs font-semibold tracking-wide text-muted uppercase">
            <th />
            <th colSpan={4} className="px-2 pb-1 text-left">Ventes</th>
            <th colSpan={2} className="border-l border-line px-2 pb-1 text-left">Acquisition</th>
            <th colSpan={3} className="border-l border-line px-2 pb-1 text-left">Retours</th>
            <th colSpan={2} className="border-l border-line px-2 pb-1 text-left">Logistique</th>
            <th colSpan={1} className="border-l border-line px-2 pb-1 text-left">Frais int.</th>
            <th colSpan={2} className="border-l border-line px-2 pb-1 text-left">Résultat</th>
          </tr>
          <tr className="text-caption text-muted">
            <th className="pb-2 text-left font-medium">Mois</th>
            <th className={th}>Volume</th>
            <th className={th}>CA HT</th>
            <th className={th}>Évol.</th>
            <th className={th}>Marge brute</th>
            <th className={cn(th, "border-l border-line")}>Pub</th>
            <th className={th}>TACoS</th>
            <th className={cn(th, "border-l border-line")}>Volume</th>
            <th className={th}>% vol.</th>
            <th className={th}>Valeur</th>
            <th className={cn(th, "border-l border-line")}>Montant</th>
            <th className={th}>% CA</th>
            <th className={cn(th, "border-l border-line")}>OpEx</th>
            <th className={cn(th, "border-l border-line")}>Com. MP</th>
            <th className={th}>Marge nette</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month} className={cn("border-t border-line", m.month === selected && "bg-blanc font-semibold")}>
              <th scope="row" className={cn("py-2 pr-2 text-left whitespace-nowrap capitalize", m.month === selected ? "font-semibold" : "font-normal")}>
                {m.label}
                {m.partial ? <span className="ml-1 text-caption font-normal text-muted">(en cours)</span> : null}
              </th>
              <td className={td}>{formatNumber(m.units)}</td>
              <td className={td}>{formatEur(m.revenue)}</td>
              <td className={cn(td, m.revenueDelta === null ? "text-muted" : m.revenueDelta >= 0 ? "text-bon" : "text-critique")}>
                {m.revenueDelta === null ? "-" : formatDeltaPercent(m.revenueDelta)}
              </td>
              <td className={td}>{pct(m.grossMargin)}</td>
              <td className={cn(td, "border-l border-line")}>{formatEur(m.ads)}</td>
              <td className={td}>{pct(m.tacos)}</td>
              <td className={cn(td, "border-l border-line")}>{formatNumber(m.returnUnits)}</td>
              <td className={td}>{pct(m.returnRate)}</td>
              <td className={td}>{formatEur(m.returnsValue)}</td>
              <td className={cn(td, "border-l border-line")}>{formatEur(m.logistics)}</td>
              <td className={td}>{pct(m.logisticsRate)}</td>
              <td className={cn(td, "border-l border-line")}>{m.opex ? formatEur(m.opex) : "-"}</td>
              <td className={cn(td, "border-l border-line")}>{pct(m.commissionRate)}</td>
              <td className={cn(td, "font-semibold")}>{pct(m.netMargin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BreakdownTable({ rows, label }: { rows: BreakdownRow[]; label: string }) {
  const th = "px-2 pb-2 text-right font-medium whitespace-nowrap";
  const td = "px-2 py-2 text-right whitespace-nowrap tabular";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-ui">
        <thead>
          <tr className="text-caption text-muted">
            <th className="pb-2 text-left font-medium">{label}</th>
            <th className={th}>CA HT</th>
            <th className={th}>Part</th>
            <th className={th}>Évol. MoM</th>
            <th className={th}>Marge brute</th>
            <th className={th}>TACoS</th>
            <th className={th}>Retours</th>
            <th className={th}>Logistique</th>
            <th className={th}>Marge nette</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line">
              <th scope="row" className="py-2 pr-2 text-left font-medium whitespace-nowrap">{r.label}</th>
              <td className={td}>{formatEur(r.revenue)}</td>
              <td className={td}>{formatPercent(r.share)}</td>
              <td className={cn(td, "font-semibold", r.revenueDelta === null ? "text-muted" : r.revenueDelta >= 0 ? "text-bon" : "text-critique")}>
                {r.revenueDelta === null ? "-" : formatDeltaPercent(r.revenueDelta)}
              </td>
              <td className={td}>{pct(r.grossMargin)}</td>
              <td className={td}>{pct(r.tacos)}</td>
              <td className={td}>{pct(r.returnRate)}</td>
              <td className={td}>{pct(r.logisticsRate)}</td>
              <td className={cn(td, "font-semibold")}>{pct(r.netMargin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function RevueMensuellePage({ params, searchParams }: PageProps<"/[espace]/revue-mensuelle">) {
  const [{ espace }, query] = await Promise.all([params, searchParams]);
  const workspace = await getWorkspace(espace);
  if (!workspace) notFound();
  const today = await getToday();
  const closed = lastClosedMonth(today);
  const month = typeof query.mois === "string" && /^\d{4}-\d{2}$/.test(query.mois) && query.mois <= today.slice(0, 7) ? query.mois : closed;
  const review = await getMonthlyReview(workspace.id, month);

  const choices: string[] = [];
  for (let m = today.slice(0, 7), i = 0; i < 6; i++, m = previousMonth(m)) choices.push(m);

  return (
    <>
      <PageHeader
        eyebrow={month === today.slice(0, 7) ? "Mois en cours - chiffres partiels" : "Mois clos - montants HT"}
        title="Revue mensuelle"
        description="Les 4 pôles à améliorer chaque mois : acquisition (TACoS), retours, logistique et frais internes, avec cible, évolution et leviers."
        actions={
          <nav aria-label="Mois" className="flex h-10 flex-wrap items-center rounded-full bg-surface p-1">
            {choices.map((m) => (
              <Link
                key={m}
                href={`/${espace}/revue-mensuelle?mois=${m}`}
                aria-current={m === month ? "true" : undefined}
                className={cn(
                  "flex h-8 items-center rounded-2xl px-3 text-ui capitalize",
                  m === month ? "bg-blanc font-semibold text-ink shadow-segment" : "text-muted",
                )}
              >
                {monthLabel(m).replace(/ \d{4}$/, "")}
              </Link>
            ))}
          </nav>
        }
      />
      {!review.selected ? (
        <EmptyState icon="calendar" title={`Pas de ventes en ${monthLabel(month)}`} description="Choisissez un autre mois ou attendez la première synchronisation." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 2xl:grid-cols-4">
            {review.poles.map((p) => (
              <PoleCard key={p.key} pole={p} />
            ))}
          </div>
          <Card>
            <CardHeader
              title="Résultats opérationnels"
              subtitle={`13 derniers mois jusqu'à ${monthLabel(month)} - marge nette après frais internes`}
            />
            <OperatingTable months={review.months} selected={month} />
          </Card>
          <Card>
            <CardHeader title={`Par marketplace - ${monthLabel(month)}`} />
            <BreakdownTable rows={review.byMarketplace} label="Marketplace" />
          </Card>
          <Card>
            <CardHeader title={`Par marque - ${monthLabel(month)}`} />
            <BreakdownTable rows={review.byBrand} label="Marque" />
          </Card>
        </>
      )}
    </>
  );
}
