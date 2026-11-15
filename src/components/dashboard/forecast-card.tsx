import Link from "next/link";
import { StatusBadge, type Tone } from "@/components/trustry/badge";
import { Card } from "@/components/trustry/card";
import type { Forecast } from "@/domain/forecast";
import { monthLabel, previousMonth } from "@/domain/monthly-review";
import { monthName } from "@/domain/period";
import { formatDeltaPercent, formatEur, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

function targetStatus(progress: number | null): { tone: Tone; label: string } {
  if (progress === null) return { tone: "info", label: "Pas d'objectif" };
  if (progress >= 100) return { tone: "bon", label: "Objectif dépassé" };
  if (progress >= 90) return { tone: "important", label: "Objectif à portée" };
  return { tone: "critique", label: "Sous l'objectif" };
}

function Compare({ label, delta }: { label: string; delta: number | null }) {
  if (delta === null) return null;
  return (
    <span className="text-meta text-muted">
      <b className={cn("font-semibold tabular", delta >= 0 ? "text-bon" : "text-critique")}>{formatDeltaPercent(delta)}</b> vs {label}
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-caption text-muted">{label}</p>
      <p className="text-title font-semibold tracking-[-0.015em] tabular">{value}</p>
      {hint ? <p className="text-caption text-muted">{hint}</p> : null}
    </div>
  );
}

/** Prévision d'atterrissage fin de mois : réalisé, projection, fourchette et objectif. */
export function ForecastCard({ forecast: f, settingsHref }: { forecast: Forecast; settingsHref: string | null }) {
  const month = monthName(f.monthEnd).toLowerCase();
  const status = targetStatus(f.targetProgress);
  // Échelle de la barre : le plus grand de l'objectif et du haut de fourchette
  const max = Math.max(f.high, f.target ?? 0) * 1.04;
  const pos = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const onTrack = f.target !== null && f.requiredDaily !== null && f.requiredDaily <= f.runRateDaily;

  return (
    <Card aria-labelledby="forecast-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="forecast-title" className="text-title font-semibold tracking-[-0.015em]">
            Atterrissage fin {month}
          </h2>
          <p className="mt-0.5 text-ui text-muted">
            Prévision du CA HT au {Number(f.monthEnd.slice(8, 10))} {month} - {f.closedDays} jours clos, {f.remainingDays} restants
            {f.confidence === "faible" ? " (début de mois : fiabilité faible)" : ""}
          </p>
        </div>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            <span className="text-kpi font-bold tracking-[-0.03em] whitespace-nowrap tabular">{formatEur(f.landing)}</span>
            <span className="pb-1 text-meta text-muted tabular">
              fourchette {formatEur(f.low)} - {formatEur(f.high)}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Compare label={monthLabel(previousMonth(f.month)).replace(/ \d{4}$/, "")} delta={f.deltaVsPreviousMonth} />
            <Compare label={monthLabel(`${Number(f.month.slice(0, 4)) - 1}${f.month.slice(4)}`)} delta={f.deltaVsLastYear} />
          </div>

          {/* Barre : réalisé (plein), projection (hachuré), fourchette, objectif */}
          <div className="mt-2">
            <div
              className="relative h-3.5 rounded-full bg-asphalte"
              role="img"
              aria-label={`Réalisé ${formatEur(f.realized.revenueHt)}, atterrissage ${formatEur(f.landing)}${f.target ? `, objectif ${formatEur(f.target)}` : ""}`}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[repeating-linear-gradient(135deg,var(--color-line-strong)_0_4px,var(--color-asphalte)_4px_8px)]"
                style={{ width: pos(f.landing) }}
              />
              <div className="absolute inset-y-0 left-0 rounded-full bg-carbone" style={{ width: pos(f.realized.revenueHt) }} />
              <div
                className="absolute -inset-y-1 rounded-full border border-ink-2/40"
                style={{ left: pos(f.low), width: `calc(${pos(f.high)} - ${pos(f.low)})` }}
              />
              {f.target ? (
                <div className="absolute -top-2 -bottom-2 w-0.5 bg-critique" style={{ left: pos(f.target) }} title="Objectif" />
              ) : null}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-carbone" /> Réalisé <b className="text-ink tabular">{formatEur(f.realized.revenueHt)}</b>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-line-strong" /> Projection
              </span>
              {f.target ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-0.5 bg-critique" /> Objectif <b className="text-ink tabular">{formatEur(f.target)}</b> (
                  {formatPercent(f.targetProgress!, 0)} atteint en projection)
                </span>
              ) : settingsHref ? (
                <Link href={settingsHref} className="font-medium text-info underline-offset-2 hover:underline">
                  Fixer un objectif de CA
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-line max-lg:border-t max-lg:pt-4 lg:border-l lg:pl-6 sm:grid-cols-4 lg:grid-cols-2">
          <Stat label="Profit net projeté" value={formatEur(f.netProfit)} hint="à marge constante" />
          <Stat label="Marge nette" value={f.netMargin === null ? "-" : formatPercent(f.netMargin)} hint="depuis le 1er du mois" />
          <Stat label="Rythme actuel" value={`${formatEur(f.runRateDaily)} / j`} hint="14 derniers jours clos" />
          {f.requiredDaily !== null ? (
            <Stat
              label="Rythme requis"
              value={`${formatEur(f.requiredDaily)} / j`}
              hint={onTrack ? "atteignable au rythme actuel" : "pour atteindre l'objectif"}
            />
          ) : (
            <Stat label="TACoS" value={f.tacos === null ? "-" : formatPercent(f.tacos)} hint="depuis le 1er du mois" />
          )}
        </div>
      </div>

      <p className="mt-4 border-t border-line pt-3 text-caption text-muted">
        Au rythme actuel sans effet saisonnier : <b className="text-ink tabular">{formatEur(f.runRateLanding)}</b>
        {f.seasonalLanding !== null ? (
          <>
            {" "}
            - corrigé du profil de {month} {Number(f.month.slice(0, 4)) - 1} (Black Friday, jours de semaine) :{" "}
            <b className="text-ink tabular">{formatEur(f.seasonalLanding)}</b>
          </>
        ) : (
          " - pas d'historique N-1 pour corriger la saisonnalité"
        )}
      </p>
    </Card>
  );
}
