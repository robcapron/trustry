import Link from "next/link";
import { Icon } from "@/components/trustry/icons";
import { PERIOD_KEYS, PERIOD_LABEL, type PeriodKey } from "@/domain/period";
import { cn } from "@/lib/utils";
import type { SyncSummary } from "@/server/types";

/** Recherche, choix de période et état des connecteurs (en-tête de la maquette). */
export function DashboardControls({
  espace,
  period,
  sync,
}: {
  espace: string;
  period: PeriodKey;
  sync: SyncSummary;
}) {
  const healthy = sync.errors === 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={`/${espace}/pnl`} className="hidden h-10 items-center gap-2 rounded-full bg-surface px-3.5 text-muted md:flex">
        <Icon name="search" size={16} />
        <input
          type="search"
          name="q"
          placeholder="SKU, ASIN, commande"
          aria-label="Rechercher un SKU, un ASIN ou une commande"
          className="w-40 border-0 bg-transparent text-ui text-ink outline-0"
        />
      </form>
      <nav aria-label="Période" className="flex h-10 items-center rounded-full bg-surface p-1">
        {PERIOD_KEYS.map((k) => (
          <Link
            key={k}
            href={`/${espace}/dashboard?periode=${k}`}
            aria-current={k === period ? "true" : undefined}
            scroll={false}
            className={cn(
              "flex h-8 items-center rounded-2xl px-3 text-ui",
              k === period ? "bg-blanc font-semibold text-ink shadow-segment" : "text-muted",
            )}
          >
            {PERIOD_LABEL[k]}
          </Link>
        ))}
      </nav>
      {sync.total > 0 ? (
        <Link
          href={`/${espace}/parametres/connecteurs`}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-3.5 text-ui text-muted"
        >
          <span className={cn("size-2 rounded-full", healthy ? "bg-bon" : "bg-attention")} />
          {sync.upToDate}/{sync.total} connecteurs à jour
          {sync.errors ? ` - ${sync.errors} erreur${sync.errors > 1 ? "s" : ""}` : ""}
        </Link>
      ) : null}
    </div>
  );
}
