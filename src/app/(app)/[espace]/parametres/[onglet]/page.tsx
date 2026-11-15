import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatusBadge, type Tone } from "@/components/trustry/badge";
import { Card, CardHeader } from "@/components/trustry/card";
import { PageHeader } from "@/components/trustry/page-header";
import { EmptyState, SyncErrorState } from "@/components/trustry/states";
import { SETTINGS_TABS, SettingsTabs, type SettingsTab } from "@/components/screens/settings-tabs";
import { SeedButton } from "@/components/screens/seed-button";
import { UpcomingScreen } from "@/components/screens/upcoming";
import { canManageMembers, canUseModule, MODULE_LABEL, ROLE_LABEL } from "@/domain/access";
import { isDemoMode } from "@/lib/env";
import { formatNumber, formatRelative } from "@/lib/format";
import { MARKETPLACES } from "@/domain/marketplaces";
import { getSyncSummary, getWorkspace, listConnections, listMembers } from "@/server/data";
import type { ConnectionStatus } from "@/server/types";

const TAB_COPY: Record<SettingsTab, { title: string; description: string }> = {
  connecteurs: {
    title: "Connecteurs",
    description: "Branchez vos marketplaces une fois : les commandes, stocks, pubs et finances remontent ensuite automatiquement.",
  },
  espace: { title: "Espace client", description: "Nom, devise de référence et modules activés pour cet espace." },
  utilisateurs: { title: "Utilisateurs et rôles", description: "Qui a accès à cet espace, avec quel rôle et à quels modules." },
  alertes: { title: "Alertes et notifications", description: "Seuils de déclenchement et notifications." },
  facturation: { title: "Facturation", description: "Abonnement et factures." },
};

export async function generateMetadata({ params }: PageProps<"/[espace]/parametres/[onglet]">): Promise<Metadata> {
  const { onglet } = await params;
  return { title: TAB_COPY[onglet as SettingsTab]?.title ?? "Paramètres" };
}

const STATUS: Record<ConnectionStatus, { tone: Tone; label: string }> = {
  connected: { tone: "bon", label: "Connecté" },
  syncing: { tone: "info", label: "Synchro en cours" },
  error: { tone: "critique", label: "En erreur" },
  not_connected: { tone: "neutre", label: "Non connecté" },
};

export default async function SettingsPage({ params }: PageProps<"/[espace]/parametres/[onglet]">) {
  const { espace, onglet } = await params;
  if (!SETTINGS_TABS.some((t) => t.slug === onglet)) notFound();
  const tab = onglet as SettingsTab;
  const workspace = await getWorkspace(espace);
  if (!workspace) notFound();
  const copy = TAB_COPY[tab];

  return (
    <>
      <PageHeader eyebrow={`Paramètres - ${workspace.name}`} title={copy.title} description={copy.description} />
      <SettingsTabs espace={espace} active={tab} />
      {tab === "connecteurs" ? <ConnectorsTab workspaceId={workspace.id} /> : null}
      {tab === "espace" ? (
        <Card>
          <CardHeader title="Informations" />
          <dl className="grid gap-4 text-ui sm:grid-cols-3">
            <div>
              <dt className="text-muted">Nom</dt>
              <dd className="font-semibold">{workspace.name}</dd>
            </div>
            <div>
              <dt className="text-muted">Organisation</dt>
              <dd className="font-semibold">{workspace.organizationName}</dd>
            </div>
            <div>
              <dt className="text-muted">Devise des totaux</dt>
              <dd className="font-semibold">EUR (montants HT)</dd>
            </div>
            <div className="sm:col-span-3">
              <dt className="text-muted">Modules activés</dt>
              <dd className="font-semibold">
                {workspace.enabledModules.length
                  ? workspace.enabledModules.map((m) => MODULE_LABEL[m as keyof typeof MODULE_LABEL] ?? m).join(", ")
                  : "Aucun module optionnel"}
              </dd>
            </div>
          </dl>
          {!isDemoMode() && process.env.TRUSTRY_ALLOW_DEMO_SEED === "1" && canManageMembers(workspace.role) ? (
            <div className="mt-6 border-t border-line pt-5">
              <p className="mb-3 text-ui text-muted">
                Environnement de développement : remplir cet espace vide avec les données d&apos;exemple.
              </p>
              <SeedButton espace={workspace.slug} />
            </div>
          ) : null}
        </Card>
      ) : null}
      {tab === "utilisateurs" ? <MembersTab workspaceId={workspace.id} enabledModules={workspace.enabledModules} /> : null}
      {tab === "alertes" ? (
        <UpcomingScreen
          phase="Phase 2"
          icon="alertes"
          features={[
            "Seuil de chute de ventes (20 % sur 7 jours par défaut)",
            "Couverture de stock minimale (7 jours)",
            "TACoS cible par espace",
            "Notifications push iPhone et email",
          ]}
        />
      ) : null}
      {tab === "facturation" ? (
        <EmptyState icon="lock" title="Bientôt disponible" description="La facturation des espaces clients arrivera après la version 1." />
      ) : null}
    </>
  );
}

async function ConnectorsTab({ workspaceId }: { workspaceId: string }) {
  const [connections, summary] = await Promise.all([listConnections(workspaceId), getSyncSummary(workspaceId)]);
  if (connections.length === 0) {
    return (
      <EmptyState
        icon="connecteurs"
        title="Aucune marketplace connectée"
        description="Connectez votre première marketplace pour voir remonter commandes, stocks et finances."
      />
    );
  }
  const cards: { tone: Tone; label: string; value: number; suffix?: string }[] = [
    { tone: "bon", label: "Connectés", value: summary.upToDate, suffix: `/ ${summary.total}` },
    { tone: "info", label: "Synchro en cours", value: summary.syncing },
    { tone: "critique", label: "En erreur", value: summary.errors },
    { tone: "neutre", label: "Non connecté", value: summary.notConnected },
  ];
  const errors = connections.filter((c) => c.status === "error");
  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <StatusBadge tone={c.tone}>{c.label}</StatusBadge>
            <p className="mt-3 text-kpi font-bold tracking-[-0.03em]">
              {formatNumber(c.value)}
              {c.suffix ? <span className="ml-1 text-ui font-normal text-muted">{c.suffix}</span> : null}
            </p>
          </Card>
        ))}
      </div>
      {errors.map((c) => (
        <SyncErrorState key={c.id} message={c.lastError ?? "Synchronisation interrompue."} />
      ))}
      <Card>
        <CardHeader title="Mes marketplaces" subtitle={`${connections.length} connecteurs`} />
        <ul className="flex flex-col sm:hidden">
          {connections.map((c) => {
            const mp = MARKETPLACES[c.marketplace];
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
                <span className="min-w-0">
                  <span className="block text-ui font-semibold">{mp.name}</span>
                  <span className="block text-caption text-muted">
                    {c.lastSyncAt ? formatRelative(new Date(c.lastSyncAt)) : "Jamais synchronisé"}
                  </span>
                </span>
                <StatusBadge tone={STATUS[c.status].tone}>
                  {c.status === "syncing" && c.syncProgress != null ? `Synchro ${c.syncProgress} %` : STATUS[c.status].label}
                </StatusBadge>
              </li>
            );
          })}
        </ul>
        <div className="-mx-1 hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[560px] text-left text-ui">
            <thead>
              <tr className="border-b border-line text-caption text-muted">
                <th className="py-2 pr-2 font-medium">Marketplace</th>
                <th className="px-2 py-2 font-medium">Méthode</th>
                <th className="px-2 py-2 font-medium">Statut</th>
                <th className="py-2 pl-2 text-right font-medium">Dernière synchro</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((c) => {
                const mp = MARKETPLACES[c.marketplace];
                return (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="py-3 pr-2">
                      <span className="block font-semibold">{mp.name}</span>
                      <span className="text-caption text-muted">{mp.countries.join(" ")}</span>
                    </td>
                    <td className="px-2 py-3 text-ink-2">{mp.api}</td>
                    <td className="px-2 py-3">
                      <StatusBadge tone={STATUS[c.status].tone}>
                        {c.status === "syncing" && c.syncProgress != null ? `Synchro ${c.syncProgress} %` : STATUS[c.status].label}
                      </StatusBadge>
                    </td>
                    <td className="py-3 pl-2 text-right text-meta text-muted">
                      {c.lastSyncAt ? formatRelative(new Date(c.lastSyncAt)) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-caption text-muted">Connexion, reconnexion et journal de synchro : Phase 3.</p>
      </Card>
    </>
  );
}

async function MembersTab({ workspaceId, enabledModules }: { workspaceId: string; enabledModules: string[] }) {
  const members = await listMembers(workspaceId);
  const showOms = enabledModules.includes("import-oms");
  return (
    <Card>
      <CardHeader title="Membres" subtitle={`${members.length} ${members.length > 1 ? "personnes" : "personne"}`} />
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-ui">
          <thead>
            <tr className="border-b border-line text-caption text-muted">
              <th className="py-2 pr-2 font-medium">Membre</th>
              <th className="px-2 py-2 font-medium">Rôle</th>
              {showOms ? <th className="py-2 pl-2 font-medium">Import OMS</th> : null}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const oms = canUseModule({ module: "import-oms", role: m.role, enabledModules, grantedModules: m.grantedModules });
              return (
                <tr key={m.userId} className="border-b border-line last:border-0">
                  <td className="py-3 pr-2">
                    <span className="block font-semibold">{m.fullName}</span>
                    {m.email ? <span className="text-caption text-muted">{m.email}</span> : null}
                  </td>
                  <td className="px-2 py-3">{ROLE_LABEL[m.role]}</td>
                  {showOms ? (
                    <td className="py-3 pl-2">
                      <StatusBadge tone={oms ? "bon" : "neutre"}>{oms ? "Accès" : "Pas d'accès"}</StatusBadge>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-caption text-muted">
        Propriétaire et admin ont accès à tous les modules activés. Invitations et modification des accès : Phase 2.
      </p>
    </Card>
  );
}
