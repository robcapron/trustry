import { DeltaBadge } from "@/components/trustry/badge";
import type { DashboardView } from "@/domain/dashboard";
import { formatDeltaPercent, formatEur, formatEurCompact } from "@/lib/format";

const STEPS = [500, 1000, 2000, 2500, 4000, 5000, 10000, 20000, 25000, 40000, 50000, 100000, 200000, 250000, 500000];

/** Graduation "propre" : 3 intervalles couvrant le maximum (ex. 0, 4 k€, 8 k€, 12 k€). */
function niceScale(maxEuros: number): number[] {
  const step = STEPS.find((s) => s * 3 >= maxEuros) ?? Math.ceil(maxEuros / 3);
  return [3, 2, 1, 0].map((i) => i * step);
}

export function DailyChart({ view, legendCurrent, legendPrevious }: { view: DashboardView; legendCurrent: string; legendPrevious: string }) {
  const max = Math.max(1, ...view.daily.map((d) => Math.max(d.current, d.previous ?? 0))) / 100;
  const ticks = niceScale(max);
  const top = ticks[0] || 1;
  const n = view.daily.length;
  const labelEvery = n <= 10 ? 1 : n <= 31 ? 2 : 7;

  return (
    <section className="min-w-0 flex-[3_1_520px] rounded-card bg-surface px-6 py-[22px]">
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <h2 className="text-title font-semibold tracking-[-0.015em]">CA HT par jour</h2>
        <div className="flex flex-wrap justify-end gap-3.5 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-carbone" />
            {legendCurrent}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-line-strong" />
            {legendPrevious}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-fluo shadow-[inset_0_0_0_1.5px_#111214]" />
            Aujourd&apos;hui
          </span>
        </div>
      </div>
      <div className="-mt-1 mb-3.5 flex flex-wrap items-baseline gap-2.5">
        <span className="text-chart font-bold tracking-[-0.03em] tabular">{formatEur(view.revenue.value ?? 0)}</span>
        {view.revenue.delta !== null ? (
          <DeltaBadge positive={view.revenue.delta >= 0}>{formatDeltaPercent(view.revenue.delta)}</DeltaBadge>
        ) : null}
        <span className="text-xs text-muted">{view.compareLabel}</span>
      </div>

      <div className="relative" role="img" aria-label={`CA HT par jour, ${n} jours`}>
        <div aria-hidden className="absolute inset-[0_0_19px_0] flex flex-col justify-between">
          {ticks.map((t) => (
            <div key={t} className="flex items-center gap-2">
              <span className="w-[34px] text-right text-tiny text-muted">{formatEurCompact(t)}</span>
              <div className="flex-1 border-t border-dashed border-grid" />
            </div>
          ))}
        </div>
        <div className="relative flex gap-1 pl-[42px]">
          {view.daily.map((d, i) => (
            <div
              key={d.date}
              className="flex min-w-0 flex-[1_1_0] flex-col items-center gap-1.5"
              title={`${d.day} : ${formatEur(d.current)}${d.previous !== null ? ` (période précédente ${formatEur(d.previous)})` : ""}`}
            >
              <div className="flex h-[190px] w-full items-end justify-center gap-0.5">
                {d.previous !== null ? (
                  <div
                    className="w-[28%] max-w-[9px] rounded-t-[4px] bg-line-strong"
                    style={{ height: `${Math.min(100, (d.previous / 100 / top) * 100)}%` }}
                  />
                ) : null}
                <div
                  className={
                    d.isToday
                      ? "w-[44%] max-w-[15px] rounded-t-[4px] bg-fluo shadow-[inset_0_0_0_1.5px_#111214]"
                      : "w-[44%] max-w-[15px] rounded-t-[4px] bg-carbone"
                  }
                  style={{ height: `${Math.min(100, (d.current / 100 / top) * 100)}%` }}
                />
              </div>
              <span className="h-[13px] text-2xs text-muted">{i % labelEvery === 0 || d.isToday ? d.day : ""}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
