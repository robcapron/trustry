import Link from "next/link";
import { Icon } from "@/components/trustry/icons";
import type { DashboardView } from "@/domain/dashboard";
import { formatDeltaPercent, formatEur, formatPercent } from "@/lib/format";

export function ChannelTable({ view, pnlHref }: { view: DashboardView; pnlHref: string }) {
  return (
    <section className="min-w-0 flex-[2_1_400px] rounded-card bg-surface px-6 py-[22px]">
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <h2 className="text-title font-semibold tracking-[-0.015em]">Par canal</h2>
        <Link href={pnlHref} className="inline-flex items-center gap-1 text-ui font-medium whitespace-nowrap">
          P&amp;L détaillé
          <Icon name="arrowRight" size={14} />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-ui">
          <thead>
            <tr className="text-caption text-muted">
              <th className="pb-2 text-left font-medium">Canal</th>
              <th className="hidden pb-2 pl-2 text-right font-medium sm:table-cell">Part</th>
              <th className="pb-2 pl-2 text-right font-medium whitespace-nowrap">CA HT</th>
              <th className="pb-2 pl-2 text-right font-medium">Marge</th>
              <th className="pb-2 pl-2 text-right font-medium">Évol.</th>
            </tr>
          </thead>
          <tbody>
            {view.channels.map((c) => (
              <tr key={c.key} className="border-t border-line">
                <td className="py-[9px] font-medium whitespace-nowrap">{c.name}</td>
                <td className="hidden w-[30%] py-[9px] pl-2.5 sm:table-cell">
                  <div className="h-1.5 rounded-[3px] bg-blanc">
                    <div className="h-1.5 rounded-[3px] bg-carbone" style={{ width: `${Math.max(2, c.share * 100)}%` }} />
                  </div>
                </td>
                <td className="pl-2 text-right whitespace-nowrap tabular">{formatEur(c.revenue)}</td>
                <td className="pl-2 text-right font-semibold whitespace-nowrap tabular">{c.margin === null ? "-" : formatPercent(c.margin)}</td>
                <td
                  className={`pl-2 text-right font-semibold whitespace-nowrap tabular ${c.delta === null ? "text-muted" : c.delta >= 0 ? "text-bon" : "text-critique"}`}
                >
                  {c.delta === null ? "-" : formatDeltaPercent(c.delta)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
