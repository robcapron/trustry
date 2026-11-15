import Link from "next/link";
import { Button } from "@/components/trustry/button";
import { Code, StatusBadge, type Tone } from "@/components/trustry/badge";
import { Icon } from "@/components/trustry/icons";
import { SEVERITY_LABEL, type Severity } from "@/domain/alerts";
import type { DashboardView } from "@/domain/dashboard";

export const SEVERITY_TONE: Record<Severity, Tone> = { critical: "critique", important: "important", info: "info" };

function plural(n: number, one: string, many: string) {
  return `${n} ${n > 1 ? many : one}`;
}

export function subjectsLabel(subjects: string[]): string | null {
  if (subjects.length === 0) return null;
  return subjects.length > 1 ? `${subjects[0]} +${subjects.length - 1}` : subjects[0];
}

export function PriorityAlerts({ view, alertsHref }: { view: DashboardView; alertsHref: string }) {
  const a = view.alerts;
  const summary = [
    a.critical ? plural(a.critical, "critique", "critiques") : null,
    a.important ? plural(a.important, "importante", "importantes") : null,
    a.info ? plural(a.info, "info", "infos") : null,
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    <section className="min-w-0 flex-[1_1_480px] rounded-card bg-surface px-6 py-[22px]">
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-title font-semibold tracking-[-0.015em]">À traiter en priorité</h2>
          <p className="mt-0.5 text-meta text-muted">{summary || "Aucune alerte ouverte"}</p>
        </div>
        <Link href={alertsHref} className="inline-flex items-center gap-1 text-ui font-medium whitespace-nowrap">
          {plural(a.total, "alerte", "alertes")}
          <Icon name="arrowRight" size={14} />
        </Link>
      </div>
      {a.top.length === 0 ? (
        <p className="rounded-item bg-blanc px-3.5 py-6 text-center text-ui text-muted">Rien à traiter pour le moment.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {a.top.map((alert) => {
            const subjects = subjectsLabel(alert.subjects);
            return (
              <li key={alert.id} className="flex flex-wrap items-center gap-3 rounded-item bg-blanc px-3.5 py-3">
                <div className="w-[92px] flex-none">
                  <StatusBadge tone={SEVERITY_TONE[alert.severity]}>{SEVERITY_LABEL[alert.severity]}</StatusBadge>
                </div>
                <div className="min-w-0 flex-[1_1_220px]">
                  <div className="text-nav font-semibold">{alert.title}</div>
                  <div className="mt-0.5 text-xs text-muted">{alert.detail}</div>
                  {subjects ? (
                    <div className="mt-[5px]">
                      <Code>{subjects}</Code>
                    </div>
                  ) : null}
                </div>
                {alert.suggestedAction ? (
                  <Button asChild size="sm" variant={alert.severity === "critical" ? "primary" : "secondary"}>
                    <Link href={`${alertsHref}?alerte=${alert.id}#alerte-${alert.id}`}>{alert.suggestedAction}</Link>
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
