import Link from "next/link";
import { StatusBadge } from "@/components/trustry/badge";
import { Icon } from "@/components/trustry/icons";
import type { SkuRow } from "@/domain/dashboard";
import { formatDeltaPercent, formatEur, formatPercent } from "@/lib/format";

export function SkuTable({ title, rows, href, withCause = false }: { title: string; rows: SkuRow[]; href: string; withCause?: boolean }) {
  return (
    <section className="min-w-0 flex-[1_1_460px] rounded-card bg-surface px-6 py-[22px]">
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <h2 className="text-title font-semibold tracking-[-0.015em]">{title}</h2>
        <Link href={href} className="inline-flex items-center gap-1 text-ui font-medium whitespace-nowrap">
          Tous les SKU
          <Icon name="arrowRight" size={14} />
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-ui text-muted">{withCause ? "Aucune baisse notable sur la période." : "Pas encore de ventes sur la période."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={`w-full border-collapse text-ui ${withCause ? "min-w-[500px] xl:min-w-0" : "min-w-[420px]"}`}>
            <thead>
              <tr className="text-caption text-muted">
                <th className="w-[22px]" />
                <th className="pb-2 text-left font-medium">Produit</th>
                <th className="pb-2 pl-2 text-right font-medium whitespace-nowrap">CA HT</th>
                <th className="pb-2 pl-2 text-right font-medium">Évol.</th>
                <th className="pb-2 pl-2 text-right font-medium">Marge</th>
                {withCause ? <th className="pb-2 pl-2 text-right font-medium">Cause</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key} className="border-t border-line">
                  <td className="py-2.5 font-bold text-faint">{i + 1}</td>
                  <td className="py-2.5 pr-2">
                    <div className="font-semibold">{r.title}</div>
                    <div className="mt-0.5 font-mono text-2xs text-muted">
                      {r.sku} - {r.storeLabel}
                    </div>
                  </td>
                  <td className="pl-2 text-right whitespace-nowrap tabular">{formatEur(r.revenue)}</td>
                  <td
                    className={`pl-2 text-right font-semibold whitespace-nowrap tabular ${r.delta === null ? "text-muted" : r.delta >= 0 ? "text-bon" : "text-critique"}`}
                  >
                    {r.delta === null ? "Nouveau" : formatDeltaPercent(r.delta)}
                  </td>
                  <td className="pl-2 text-right whitespace-nowrap tabular">{r.margin === null ? "-" : formatPercent(r.margin)}</td>
                  {withCause && r.cause ? (
                    <td className="pl-2 text-right">
                      <StatusBadge tone={r.cause.tone}>{r.cause.label}</StatusBadge>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
