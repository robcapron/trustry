import Link from "next/link";
import { Button } from "@/components/trustry/button";
import { Icon } from "@/components/trustry/icons";
import { PERIOD_KEYS, PERIOD_LABEL, type PeriodKey } from "@/domain/period";
import type { PnlFilters, PnlView } from "@/domain/pnl";
import { cn } from "@/lib/utils";

const select = "h-10 rounded-full border border-line bg-blanc px-3.5 text-ui text-ink outline-0 focus:border-carbone";

export function pnlQuery(period: PeriodKey, f: PnlFilters, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams({ periode: period, ...extra });
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  return p.toString();
}

/** Filtres du P&L (formulaire GET : l'URL reste partageable). */
export function PnlFiltersBar({
  espace,
  period,
  filters,
  options,
}: {
  espace: string;
  period: PeriodKey;
  filters: PnlFilters;
  options: PnlView["options"];
}) {
  const base = `/${espace}/pnl`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Période" className="flex h-10 items-center rounded-full bg-surface p-1">
          {PERIOD_KEYS.map((k) => (
            <Link
              key={k}
              href={`${base}?${pnlQuery(k, filters)}`}
              aria-current={k === period ? "true" : undefined}
              className={cn("flex h-8 items-center rounded-2xl px-3 text-ui", k === period ? "bg-blanc font-semibold text-ink shadow-segment" : "text-muted")}
            >
              {PERIOD_LABEL[k]}
            </Link>
          ))}
        </nav>
        <Button asChild size="md" className="ml-auto max-lg:hidden">
          <a href={`${base}/export?${pnlQuery(period, filters)}`} download>
            <Icon name="importOms" size={16} />
            Exporter en CSV
          </a>
        </Button>
      </div>
      <form action={base} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="periode" value={period} />
        <label className="flex h-10 items-center gap-2 rounded-full bg-surface px-3.5 text-muted">
          <Icon name="search" size={16} />
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="SKU ou produit"
            aria-label="Rechercher un SKU ou un produit"
            className="w-36 border-0 bg-transparent text-ui text-ink outline-0"
          />
        </label>
        <select name="canal" defaultValue={filters.canal ?? ""} aria-label="Canal" className={select}>
          <option value="">Tous les canaux</option>
          {options.channels.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select name="pays" defaultValue={filters.pays ?? ""} aria-label="Pays" className={select}>
          <option value="">Tous les pays</option>
          {options.countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select name="marque" defaultValue={filters.marque ?? ""} aria-label="Marque" className={select}>
          <option value="">Toutes les marques</option>
          {options.brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <Button type="submit" variant="primary">
          Filtrer
        </Button>
        {Object.values(filters).some(Boolean) ? (
          <Link href={`${base}?periode=${period}`} className="px-2 text-ui font-medium text-muted underline-offset-4 hover:underline">
            Réinitialiser
          </Link>
        ) : null}
      </form>
    </div>
  );
}
