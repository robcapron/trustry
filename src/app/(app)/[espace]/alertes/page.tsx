import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusControl } from "@/components/alerts/status-control";
import { SEVERITY_TONE } from "@/components/dashboard/priority-alerts";
import { Code, StatusBadge } from "@/components/trustry/badge";
import { Button } from "@/components/trustry/button";
import { PageHeader } from "@/components/trustry/page-header";
import { EmptyState } from "@/components/trustry/states";
import { canEdit } from "@/domain/access";
import {
  alertActionPath,
  CATEGORY_LABEL,
  compareAlerts,
  SEVERITIES,
  SEVERITY_LABEL,
  STATUS_LABEL,
  type AlertStatus,
  type Severity,
} from "@/domain/alerts";
import { PILLARS } from "@/domain/pillars";
import { formatEur, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getWorkspace, listAlerts } from "@/server/data";

export const metadata: Metadata = { title: "Alertes" };

const SEVERITY_TAB: Record<Severity, string> = { critical: "Critiques", important: "Importantes", info: "Infos" };
const STATUS_TABS: { key: "ouvertes" | AlertStatus; label: string }[] = [
  { key: "ouvertes", label: "Ouvertes" },
  { key: "todo", label: STATUS_LABEL.todo },
  { key: "in_progress", label: STATUS_LABEL.in_progress },
  { key: "resolved", label: "Résolues" },
];

function Pill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn("flex h-8 items-center gap-1.5 rounded-2xl px-3 text-ui whitespace-nowrap", active ? "bg-blanc font-semibold text-ink shadow-segment" : "text-muted")}
    >
      {children}
    </Link>
  );
}

export default async function AlertesPage({ params, searchParams }: PageProps<"/[espace]/alertes">) {
  const [{ espace }, query] = await Promise.all([params, searchParams]);
  const workspace = await getWorkspace(espace);
  if (!workspace) notFound();
  const all = await listAlerts(workspace.id);

  const sev = SEVERITIES.includes(query.niveau as Severity) ? (query.niveau as Severity) : null;
  const statusKey = STATUS_TABS.some((t) => t.key === query.statut) ? (query.statut as (typeof STATUS_TABS)[number]["key"]) : "ouvertes";
  const highlighted = typeof query.alerte === "string" ? query.alerte : null;

  const byStatus = all.filter((a) => (statusKey === "ouvertes" ? a.status !== "resolved" : a.status === statusKey));
  const alerts = byStatus
    .filter((a) => !sev || a.severity === sev)
    .sort((a, b) => compareAlerts({ ...a, createdAt: new Date(a.createdAt) }, { ...b, createdAt: new Date(b.createdAt) }));
  const count = (s: Severity) => byStatus.filter((a) => a.severity === s).length;
  const href = (next: { niveau?: string | null; statut?: string }) => {
    const p = new URLSearchParams();
    const n = next.niveau === undefined ? sev : next.niveau;
    const st = next.statut ?? statusKey;
    if (n) p.set("niveau", n);
    if (st !== "ouvertes") p.set("statut", st);
    const q = p.toString();
    return `/${espace}/alertes${q ? `?${q}` : ""}`;
  };
  const readOnly = !canEdit(workspace.role);

  return (
    <>
      <PageHeader
        title="Alertes"
        description="Priorisées automatiquement : une référence bloquée passe toujours avant un réassort, puis la sévérité et le CA HT à risque."
      />
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Sévérité" className="flex h-10 items-center rounded-full bg-surface p-1">
          <Pill href={href({ niveau: null })} active={!sev}>
            Toutes <span className="text-caption text-muted">{byStatus.length}</span>
          </Pill>
          {SEVERITIES.map((s) => (
            <Pill key={s} href={href({ niveau: s })} active={sev === s}>
              {SEVERITY_TAB[s]} <span className="text-caption text-muted">{count(s)}</span>
            </Pill>
          ))}
        </nav>
        <nav aria-label="Statut" className="flex h-10 items-center rounded-full bg-surface p-1">
          {STATUS_TABS.map((t) => (
            <Pill key={t.key} href={href({ statut: t.key })} active={statusKey === t.key}>
              {t.label}
            </Pill>
          ))}
        </nav>
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          icon="alertes"
          title={statusKey === "resolved" ? "Aucune alerte résolue" : "Aucune alerte à traiter"}
          description="Les alertes apparaissent ici dès qu'une référence est bloquée, qu'un stock s'épuise ou que les ventes chutent."
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {alerts.map((a) => {
            const pillar = PILLARS.find((p) => p.number === a.pillar);
            const subjects = a.subjects.length > 8 ? [...a.subjects.slice(0, 8), `+${a.subjects.length - 8}`] : a.subjects;
            return (
              <li
                key={a.id}
                id={`alerte-${a.id}`}
                className={cn(
                  "scroll-mt-24 rounded-card bg-surface px-5 py-4 sm:px-6",
                  highlighted === a.id && "ring-2 ring-carbone",
                )}
              >
                <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                  <div className="flex w-[110px] flex-none flex-col items-start gap-1.5">
                    <StatusBadge tone={SEVERITY_TONE[a.severity]}>{SEVERITY_LABEL[a.severity]}</StatusBadge>
                    <span className="text-caption text-muted">{formatRelative(new Date(a.createdAt))}</span>
                  </div>
                  <div className="min-w-0 flex-[1_1_320px]">
                    <p className="text-caption font-semibold text-muted">
                      {CATEGORY_LABEL[a.category]}
                      {pillar ? ` - Pilier ${pillar.number} ${pillar.navLabel}` : ""}
                    </p>
                    <h2 className="mt-0.5 text-nav font-semibold">{a.title}</h2>
                    <p className="mt-0.5 text-xs text-muted">{a.detail}</p>
                    {a.scope === "account" ? (
                      <p className="mt-2 text-xs font-semibold text-important">Baisse liée au compte, pas à un SKU en particulier</p>
                    ) : null}
                    {subjects.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5" aria-label={a.scope === "account" ? "Compte concerné" : "SKU concernés"}>
                        {subjects.map((s) => (
                          <Code key={s} className="bg-blanc">{s}</Code>
                        ))}
                      </div>
                    ) : null}
                    {a.revenueAtRiskCents > 0 ? (
                      <p className="mt-2 text-xs text-ink-2">
                        CA HT à risque : <b className="tabular">{formatEur(a.revenueAtRiskCents)}</b>
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-none flex-col items-end gap-2 max-sm:w-full max-sm:items-stretch">
                    {a.suggestedAction ? (
                      <Button asChild size="sm" variant={a.severity === "critical" ? "primary" : "secondary"}>
                        <Link href={`/${espace}${alertActionPath(a.category)}`}>{a.suggestedAction}</Link>
                      </Button>
                    ) : null}
                    <StatusControl espace={espace} alertId={a.id} status={a.status} readOnly={readOnly} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {readOnly ? <p className="text-caption text-muted">Rôle lecture seule : vous pouvez consulter les alertes sans changer leur statut.</p> : null}
    </>
  );
}
