import Link from "next/link";
import { StatusBadge, type Tone } from "@/components/trustry/badge";
import type { DashboardView } from "@/domain/dashboard";
import { HEALTH_LABEL, PILLARS, type HealthStatus } from "@/domain/pillars";
import { cn } from "@/lib/utils";

const TONE: Record<HealthStatus, Tone> = { good: "bon", watch: "important", critical: "critique" };
const BAR: Record<HealthStatus, string> = { good: "bg-bon", watch: "bg-important", critical: "bg-critique" };

export function PillarHealth({ view, espace }: { view: DashboardView; espace: string }) {
  return (
    <section className="min-w-0 flex-[1_1_480px] rounded-card bg-surface px-6 py-[22px]">
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <h2 className="text-title font-semibold tracking-[-0.015em]">Santé des 7 piliers</h2>
        {view.pillars.global !== null ? (
          <span className="text-ui text-muted">
            Score global <b className="text-base text-ink">{view.pillars.global}</b>/100
          </span>
        ) : null}
      </div>
      {view.pillars.rows.length === 0 ? (
        <p className="py-6 text-center text-ui text-muted">Scores calculés après la première synchronisation.</p>
      ) : (
        <ul>
          {view.pillars.rows.map((p) => {
            const slug = PILLARS.find((x) => x.number === p.number)?.slug;
            return (
              <li key={p.number} className="border-t border-line">
                <Link
                  href={`/${espace}/piliers/${slug}`}
                  className="grid grid-cols-[26px_minmax(0,1fr)_30px] items-center gap-3 py-2.5 sm:grid-cols-[26px_minmax(0,1fr)_80px_30px_100px]"
                >
                  <span className="grid size-[26px] place-items-center rounded-lg bg-carbone text-xs font-bold text-fluo">{p.number}</span>
                  <div className="min-w-0">
                    <div className="truncate text-nav font-semibold">{p.label}</div>
                    <div className="truncate text-xs text-muted">{p.headline}</div>
                  </div>
                  <div className="hidden h-1.5 rounded-[3px] bg-blanc sm:block">
                    <div className={cn("h-1.5 rounded-[3px]", BAR[p.health])} style={{ width: `${p.score}%` }} />
                  </div>
                  <span className="text-right text-sm font-bold tabular">{p.score}</span>
                  <div className="hidden text-right sm:block">
                    <StatusBadge tone={TONE[p.health]}>{HEALTH_LABEL[p.health]}</StatusBadge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
