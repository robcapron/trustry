import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/trustry/badge";
import { Card, CardHeader } from "@/components/trustry/card";
import { PageHeader } from "@/components/trustry/page-header";
import { EmptyState } from "@/components/trustry/states";
import { SETTINGS_TABS, SettingsTabs, type SettingsTab } from "@/components/screens/settings-tabs";
import { SeedButton } from "@/components/screens/seed-button";
import { UpcomingScreen } from "@/components/screens/upcoming";
import { canManageMembers, canUseModule, MODULE_LABEL, ROLE_LABEL } from "@/domain/access";
import { isDemoMode } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { MARKETPLACE_ORDER } from "@/domain/marketplaces";
import { headers } from "next/headers";
import { ConnectorsScreen } from "@/components/connectors/connectors-screen";
import { getConnectorsOverview, getCurrentUser, getMonthlyPlan, getToday, getWorkspace, listInvitations, listMembers } from "@/server/data";
import type { WorkspaceSummary } from "@/server/types";
import { InviteForm, MemberRow, type MemberRowData } from "@/components/settings/members";
import { TargetsForm } from "@/components/settings/targets-form";
import { monthLabel } from "@/domain/monthly-review";
import type { MarketplaceCode } from "@/server/types";

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

export default async function SettingsPage({ params, searchParams }: PageProps<"/[espace]/parametres/[onglet]">) {
  const [{ espace, onglet }, query] = await Promise.all([params, searchParams]);
  if (!SETTINGS_TABS.some((t) => t.slug === onglet)) notFound();
  const tab = onglet as SettingsTab;
  const workspace = await getWorkspace(espace);
  if (!workspace) notFound();
  const copy = TAB_COPY[tab];

  return (
    <>
      <PageHeader eyebrow={`Paramètres - ${workspace.name}`} title={copy.title} description={copy.description} />
      <SettingsTabs espace={espace} active={tab} />
      {tab === "connecteurs" ? (
        <ConnectorsTab
          workspace={workspace}
          selected={typeof query.connecter === "string" ? query.connecter : null}
          filter={typeof query.filtre === "string" ? query.filtre : ""}
          notice={typeof query.ok === "string" ? query.ok.slice(0, 300) : null}
        />
      ) : null}
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
      {tab === "espace" ? <TargetsCard workspace={workspace} /> : null}
      {tab === "utilisateurs" ? <MembersTab workspace={workspace} /> : null}
      {tab === "alertes" ? (
        <UpcomingScreen
          phase="Phase 3"
          icon="alertes"
          features={[
            "Seuil de chute de ventes (20 % sur 7 jours par défaut)",
            "Couverture de stock minimale (7 jours)",
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

async function MembersTab({ workspace }: { workspace: WorkspaceSummary }) {
  const [list, invitations, user] = await Promise.all([listMembers(workspace.id), listInvitations(workspace.id), getCurrentUser()]);
  const enabled = workspace.enabledModules;
  const showOms = enabled.includes("import-oms");
  const canManage = canManageMembers(workspace.role);
  const rows: MemberRowData[] = list.map((m) => ({
    userId: m.userId,
    fullName: m.fullName,
    email: m.email,
    role: m.role,
    omsAccess: canUseModule({ module: "import-oms", role: m.role, enabledModules: enabled, grantedModules: m.grantedModules }),
    isSelf: m.userId === user?.id,
  }));
  return (
    <>
      <Card>
        <CardHeader title="Membres" subtitle={`${list.length} ${list.length > 1 ? "personnes" : "personne"}`} />
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-ui">
            <thead>
              <tr className="border-b border-line text-caption text-muted">
                <th className="py-2 pr-2 font-medium">Membre</th>
                <th className="px-2 py-2 font-medium">Rôle</th>
                {showOms ? <th className="px-2 py-2 font-medium">Import OMS</th> : null}
                <th className="py-2 pl-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <MemberRow key={m.userId} espace={workspace.slug} member={m} canManage={canManage} showOms={showOms} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-caption text-muted">
          Propriétaire et admin ont accès à tous les modules activés. Lecture seule : consultation sans modification.
        </p>
      </Card>
      {canManage ? (
        <Card>
          <CardHeader title="Inviter un membre" subtitle="La personne crée son accès avec le lien reçu, puis rejoint l'espace avec le rôle choisi." />
          <InviteForm espace={workspace.slug} showOms={showOms} />
          {invitations.length ? (
            <ul className="mt-5 border-t border-line pt-3">
              {invitations.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-ui">
                  <span>
                    {i.email} <span className="text-muted">- {ROLE_LABEL[i.role]}</span>
                  </span>
                  <StatusBadge tone="info">En attente</StatusBadge>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}

async function TargetsCard({ workspace }: { workspace: WorkspaceSummary }) {
  const month = (await getToday()).slice(0, 7);
  const plan = await getMonthlyPlan(workspace.id, month);
  const euros = (cents: number | null) => (cents === null ? "" : formatNumber(cents / 100));
  const pct = (v: number) => formatNumber(v, 1);
  return (
    <Card id="objectifs">
      <CardHeader
        title="Objectifs et cibles"
        subtitle="L'objectif de CA alimente la prévision d'atterrissage du Dashboard, les cibles alimentent la revue mensuelle."
      />
      <TargetsForm
        espace={workspace.slug}
        monthLabel={monthLabel(month)}
        canEdit={canManageMembers(workspace.role)}
        money={[
          { name: "objectif", label: "Objectif de CA HT du mois", suffix: "€ HT", value: euros(plan.revenueTarget), hint: "Laisser vide pour ne pas fixer d'objectif" },
          { name: "opex", label: "Frais internes du mois (OpEx)", suffix: "€ HT", value: euros(plan.opex) },
        ]}
        rates={[
          { name: "tacos", label: "TACoS cible", suffix: "%", value: pct(plan.targets.tacos) },
          { name: "retours", label: "Taux de retour cible", suffix: "%", value: pct(plan.targets.returnRate) },
          { name: "logistique", label: "Logistique / CA cible", suffix: "%", value: pct(plan.targets.logisticsRate) },
          { name: "frais", label: "OpEx / CA cible", suffix: "%", value: pct(plan.targets.opexRate) },
        ]}
      />
    </Card>
  );
}

async function ConnectorsTab({
  workspace,
  selected,
  filter,
  notice,
}: {
  workspace: WorkspaceSummary;
  selected: string | null;
  filter: string;
  notice: string | null;
}) {
  const [overview, h] = await Promise.all([getConnectorsOverview(workspace.id), headers()]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "trustry.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return (
    <ConnectorsScreen
      espace={workspace.slug}
      workspaceName={workspace.name}
      overview={overview}
      canEdit={canManageMembers(workspace.role)}
      allowTest={isDemoMode() || process.env.TRUSTRY_ALLOW_DEMO_SEED === "1"}
      mcpUrl={`${proto}://${host}/api/mcp/${workspace.slug}`}
      selected={MARKETPLACE_ORDER.includes(selected as MarketplaceCode) ? (selected as MarketplaceCode) : null}
      filter={filter}
      notice={notice}
    />
  );
}
