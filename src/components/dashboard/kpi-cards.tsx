import { DeltaBadge } from "@/components/trustry/badge";
import type { DashboardView } from "@/domain/dashboard";
import { formatDeltaPercent, formatDeltaPoints, formatEur, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";

function Delta({ value, points = false, onDark = false }: { value: number | null; points?: boolean; onDark?: boolean }) {
  if (value === null) return null;
  const positive = value >= 0;
  const text = points ? formatDeltaPoints(value) : formatDeltaPercent(value);
  if (onDark && !positive) {
    return <span className="rounded-full bg-critique-soft px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-critique">{text}</span>;
  }
  return (
    <DeltaBadge positive={positive} onDark={onDark}>
      {text}
    </DeltaBadge>
  );
}

function KpiCard({
  label,
  value,
  delta,
  points,
  spark,
  footer,
  dark = false,
}: {
  label: string;
  value: string;
  delta: number | null;
  points?: boolean;
  spark: number[];
  footer: string;
  dark?: boolean;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col justify-between rounded-card px-6 py-[22px]",
        dark ? "gap-3 bg-carbone text-blanc" : "bg-surface",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-ui font-medium", dark ? "text-on-dark-muted" : "text-muted")}>{label}</span>
        <Delta value={delta} points={points} onDark={dark} />
      </div>
      <div className={cn("flex items-end justify-between gap-3", !dark && "mt-3")}>
        <span
          className={cn(
            "font-bold whitespace-nowrap tabular",
            dark ? "text-[32px] leading-none tracking-[-0.035em] sm:text-hero" : "text-[26px] leading-none tracking-[-0.03em] sm:text-kpi",
          )}
        >
          {value}
        </span>
        <Sparkline values={spark} color={dark ? "#E4FF1A" : "#111214"} />
      </div>
      <p className={cn("text-xs", dark ? "text-subtle" : "mt-2.5 text-muted")}>{footer}</p>
    </section>
  );
}

export function KpiCards({ view, monthLabel }: { view: DashboardView; monthLabel: string }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(230px,1fr))]">
      <KpiCard
        dark
        label={monthLabel}
        value={view.profit.value === null ? "-" : formatEur(view.profit.value)}
        delta={view.profit.delta}
        spark={view.profit.spark}
        footer={`${view.compareLabel} - montants HT`}
      />
      <KpiCard
        label="CA HT"
        value={formatEur(view.revenue.value ?? 0)}
        delta={view.revenue.delta}
        spark={view.revenue.spark}
        footer={view.compareLabel}
      />
      <KpiCard
        label="Marge nette"
        value={view.margin.value === null ? "-" : formatPercent(view.margin.value)}
        delta={view.margin.delta}
        points
        spark={view.margin.spark}
        footer={view.compareLabel}
      />
      <KpiCard
        label="Commandes"
        value={formatNumber(view.orders.value ?? 0)}
        delta={view.orders.delta}
        spark={view.orders.spark}
        footer={view.orders.basketCents === null ? view.compareLabel : `Panier moyen ${formatEur(view.orders.basketCents, 2)} HT`}
      />
    </div>
  );
}
