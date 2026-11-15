import Link from "next/link";
import { StatusBadge, type Tone } from "@/components/trustry/badge";
import { Button } from "@/components/trustry/button";
import { Card, CardHeader } from "@/components/trustry/card";
import { Icon } from "@/components/trustry/icons";
import { CONNECTOR_SPECS, DATA_SCOPES } from "@/domain/connector-fields";
import { MARKETPLACES } from "@/domain/marketplaces";
import { formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Connection, ConnectorsOverview, MarketplaceCode } from "@/server/types";
import { ApiKeyForm, ConnectForm, CopyField, FrequencySelect, ManageActions, McpLevels } from "./forms";

type RowState = "connected" | "syncing" | "error" | "expired" | "not_connected";

function rowState(c: Connection | null): RowState {
  if (!c || c.status === "not_connected") return "not_connected";
  if (c.status === "error") return c.tokenExpiresAt && new Date(c.tokenExpiresAt) < new Date() ? "expired" : "error";
  return c.status;
}

const STATE: Record<RowState, { tone: Tone; label: string }> = {
  connected: { tone: "bon", label: "Connecté" },
  syncing: { tone: "info", label: "Synchro en cours" },
  error: { tone: "critique", label: "En erreur" },
  expired: { tone: "critique", label: "Jeton expiré" },
  not_connected: { tone: "neutre", label: "Non connecté" },
};

const SIGLE: Record<MarketplaceCode, string> = {
  amazon_eu: "AM",
  amazon_us: "AM",
  amazon_jp_au: "AM",
  decathlon: "DE",
  kaufland: "KA",
  bol: "BO",
  cdiscount: "CD",
  ebay: "EB",
  allegro: "AL",
  tiktok_shop: "TT",
  alltricks: "AT",
};

function Avatar({ code, muted }: { code: MarketplaceCode; muted?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 flex-none items-center justify-center rounded-nav text-caption font-bold",
        muted ? "border border-line bg-blanc text-muted" : "bg-carbone text-fluo",
      )}
    >
      {SIGLE[code]}
    </span>
  );
}

export function ConnectorsScreen({
  espace,
  workspaceName,
  overview,
  canEdit,
  allowTest,
  mcpUrl,
  selected,
  filter,
  notice,
}: {
  espace: string;
  workspaceName: string;
  overview: ConnectorsOverview;
  canEdit: boolean;
  allowTest: boolean;
  mcpUrl: string;
  selected: MarketplaceCode | null;
  filter: string;
  notice?: string | null;
}) {
  const rows = overview.rows.map((r) => ({ ...r, state: rowState(r.connection) }));
  const by = (states: RowState[]) => rows.filter((r) => states.includes(r.state));
  const names = (list: typeof rows) => (list.length && list.length <= 2 ? list.map((r) => MARKETPLACES[r.marketplace].name).join(", ") : "");
  const cards = [
    { tone: "bon" as Tone, label: "Connectés", list: by(["connected"]), suffix: `/ ${rows.length}` },
    { tone: "info" as Tone, label: "Synchro en cours", list: by(["syncing"]) },
    { tone: "critique" as Tone, label: "En erreur", list: by(["error", "expired"]) },
    { tone: "neutre" as Tone, label: "Non connecté", list: by(["not_connected"]) },
  ];
  const q = filter.trim().toLowerCase();
  const visible = q ? rows.filter((r) => MARKETPLACES[r.marketplace].name.toLowerCase().includes(q)) : rows;
  const storesCount = rows.filter((r) => r.state !== "not_connected").reduce((t, r) => t + MARKETPLACES[r.marketplace].countries.length, 0);
  const firstMissing = rows.find((r) => r.state === "not_connected")?.marketplace ?? null;
  const panel = selected ?? firstMissing;
  const panelRow = panel ? rows.find((r) => r.marketplace === panel) : undefined;
  const href = (code: MarketplaceCode) => `/${espace}/parametres/connecteurs?connecter=${code}#panneau`;
  const apiActive = rows.filter((r) => r.connection?.method === "api" && r.state !== "not_connected").length;

  return (
    <>
      <div className="flex flex-wrap gap-2.5">
        <Button asChild variant="secondary">
          <a href="#journal">Journal de synchro</a>
        </Button>
        {canEdit && firstMissing ? (
          <Button asChild variant="primary">
            <Link href={href(firstMissing)}>+ Ajouter une marketplace</Link>
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <StatusBadge tone={c.tone}>{c.label}</StatusBadge>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-kpi font-bold tracking-[-0.03em] tabular">{formatNumber(c.list.length)}</span>
              <span className="text-ui text-muted">{c.suffix ?? names(c.list)}</span>
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card tone="dark" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-title font-semibold">
                Via Claude (MCP) <span className="rounded-full bg-fluo px-2 py-0.5 text-2xs font-semibold text-carbone">Recommandé</span>
              </h2>
              <p className="mt-1 max-w-xl text-ui text-on-dark-muted">
                Reliez votre espace Trustry à Claude : interrogez votre profit, vos alertes et vos SKU en langage naturel, et lancez des actions avec validation.
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-meta font-semibold text-fluo">
              <span className="size-1.5 rounded-full bg-fluo" />
              {overview.mcpUsers ? `Actif - ${overview.mcpUsers} utilisateur${overview.mcpUsers > 1 ? "s" : ""}` : "Prêt à connecter"}
            </span>
          </div>
          <div>
            <p className="mb-2 text-meta font-semibold">URL du serveur MCP</p>
            <CopyField value={mcpUrl} dark />
          </div>
          <ol className="grid gap-2.5 sm:grid-cols-3">
            {["Copiez l'URL du serveur", "Dans Claude, ajoutez un connecteur personnalisé avec cette URL", `Autorisez l'accès à l'espace ${workspaceName}`].map((t, i) => (
              <li key={t} className="rounded-item bg-white/5 p-3.5 text-meta">
                <span className="mb-2.5 flex size-6 items-center justify-center rounded-full bg-fluo text-caption font-bold text-carbone">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
          <McpLevels espace={espace} level={overview.mcpPermission} canEdit={canEdit} />
        </Card>

        <Card className="flex flex-col gap-4">
          <CardHeader
            title="Via les API des marketplaces"
            subtitle="Connexion directe aux API officielles : SP-API, Mirakl, Kaufland, Bol, Octopia..."
            action={<StatusBadge tone="bon">{`${apiActive} active${apiActive > 1 ? "s" : ""}`}</StatusBadge>}
          />
          <ul className="-mt-2 flex flex-wrap gap-2">
            {["Commandes", "Catalogue et offres", "Stocks", "Prix par devise", "Publicité", "Retours et messages", "Finances et commissions"].map((s) => (
              <li key={s} className="rounded-full bg-blanc px-3.5 py-1.5 text-meta">
                {s}
              </li>
            ))}
          </ul>
          <div>
            <p className="mb-2 text-ui font-semibold">Clé API Trustry</p>
            <ApiKeyForm espace={espace} prefix={overview.apiKey?.prefix ?? null} canEdit={canEdit} />
            <p className="mt-2 text-caption text-muted">
              Pour vos outils internes (ERP, OMS, Looker Studio).
              {overview.apiKey ? ` Créée ${formatRelative(new Date(overview.apiKey.createdAt))}${overview.apiKey.createdBy ? ` par ${overview.apiKey.createdBy}` : ""}.` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-item bg-blanc px-4 py-3">
            <span>
              <span className="block text-ui font-semibold">Fréquence de synchronisation</span>
              <span className="block text-caption text-muted">Commandes et stocks. Finances : 1 fois par jour</span>
            </span>
            <FrequencySelect espace={espace} value={overview.frequency} canEdit={canEdit} />
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Mes marketplaces"
            subtitle={`${rows.length} connecteurs - ${storesCount} boutiques pays`}
            action={
              <form className="flex h-10 items-center gap-2 rounded-full bg-blanc px-3.5 text-muted">
                <Icon name="search" size={15} />
                <input name="filtre" defaultValue={filter} placeholder="Filtrer" aria-label="Filtrer les marketplaces" className="w-28 bg-transparent text-ui text-ink outline-none" />
              </form>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-ui">
              <thead>
                <tr className="border-b border-line text-caption text-muted">
                  <th className="py-2 pr-2 font-medium">Marketplace</th>
                  <th className="px-2 py-2 font-medium">Méthode</th>
                  <th className="px-2 py-2 font-medium">Statut</th>
                  <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Dernière synchro</th>
                  <th className="py-2 pl-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map(({ marketplace, connection: c, state }) => {
                  const mp = MARKETPLACES[marketplace];
                  const st = STATE[state];
                  const cta = state === "not_connected" ? "Connecter" : state === "expired" || state === "error" ? "Reconnecter" : state === "syncing" ? "Détails" : "Gérer";
                  return [
                    <tr key={marketplace} className={cn("border-b border-line", (state === "error" || state === "expired") && "border-0")}>
                      <td className="py-3 pr-2">
                        <span className="flex items-center gap-3">
                          <Avatar code={marketplace} muted={state === "not_connected"} />
                          <span>
                            <span className="block font-semibold">{mp.name}</span>
                            <span className="text-caption text-muted">{mp.countries.join(" ")}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-2 py-3 text-meta text-ink-2">{c?.method === "mcp" ? "Via Claude (MCP)" : c?.adapter === "mock" ? "Données de test" : mp.api}</td>
                      <td className="px-2 py-3">
                        <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                      </td>
                      <td className="px-2 py-3 text-right text-meta whitespace-nowrap text-muted tabular">
                        {state === "syncing" && c?.syncProgress != null ? (
                          <span className="inline-flex items-center gap-2.5">
                            <span className="h-1 w-12 overflow-hidden rounded-full bg-asphalte">
                              <span className="block h-full bg-info" style={{ width: `${c.syncProgress}%` }} />
                            </span>
                            {c.syncProgress} %
                          </span>
                        ) : c?.lastSyncAt ? (
                          formatRelative(new Date(c.lastSyncAt))
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3 pl-2 text-right whitespace-nowrap">
                        <Button asChild size="sm" variant={state === "not_connected" || state === "expired" || state === "error" ? "primary" : "secondary"}>
                          <Link href={href(marketplace)}>{cta}</Link>
                        </Button>
                      </td>
                    </tr>,
                    (state === "error" || state === "expired") && c?.lastError ? (
                      <tr key={`${marketplace}-err`} className="border-b border-line">
                        <td colSpan={5} className="pb-3">
                          <p className="rounded-item bg-critique-soft px-4 py-3 text-meta text-critique">
                            <b>Erreur de synchro :</b> {c.lastError}
                          </p>
                        </td>
                      </tr>
                    ) : null,
                  ];
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {panelRow ? (
          <Card id="panneau" className="scroll-mt-24">
            <div className="mb-5 flex items-center gap-3">
              <Avatar code={panelRow.marketplace} muted={panelRow.state === "not_connected"} />
              <div>
                <h2 className="text-title font-semibold">
                  {panelRow.state === "not_connected" || panelRow.state === "expired" || panelRow.state === "error" ? "Connecter" : "Gérer"}{" "}
                  {MARKETPLACES[panelRow.marketplace].name}
                </h2>
                <p className="text-ui text-muted">
                  {MARKETPLACES[panelRow.marketplace].api} - {MARKETPLACES[panelRow.marketplace].countries.join(", ")}
                </p>
              </div>
            </div>
            {panelRow.state === "connected" || panelRow.state === "syncing" ? (
              <div className="flex flex-col gap-4">
                {notice ? (
                  <p role="status" className="rounded-item bg-bon-soft px-4 py-3 text-meta text-bon">
                    {notice}
                  </p>
                ) : null}
                <dl className="grid grid-cols-2 gap-3 text-ui">
                  <div>
                    <dt className="text-caption text-muted">Méthode</dt>
                    <dd className="font-semibold">{panelRow.connection?.method === "mcp" ? "Via Claude (MCP)" : MARKETPLACES[panelRow.marketplace].api}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted">Dernière synchro</dt>
                    <dd className="font-semibold">{panelRow.connection?.lastSyncAt ? formatRelative(new Date(panelRow.connection.lastSyncAt)) : "Jamais"}</dd>
                  </div>
                </dl>
                <ManageActions espace={espace} connectionId={panelRow.connection!.id} canEdit={canEdit} />
              </div>
            ) : canEdit ? (
              <ConnectForm
                key={panelRow.marketplace}
                espace={espace}
                marketplace={panelRow.marketplace}
                name={MARKETPLACES[panelRow.marketplace].name}
                spec={CONNECTOR_SPECS[panelRow.marketplace]}
                scopes={DATA_SCOPES}
                allowTest={allowTest}
              />
            ) : (
              <p className="text-meta text-muted">La connexion des marketplaces est réservée au propriétaire ou à un admin de l&apos;espace.</p>
            )}
          </Card>
        ) : null}
      </div>

      <Card id="journal" className="scroll-mt-24">
        <CardHeader title="Journal de synchro" subtitle="30 dernières exécutions" />
        {overview.runs.length === 0 ? (
          <p className="text-meta text-muted">Aucune synchro pour l&apos;instant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-ui">
              <thead>
                <tr className="border-b border-line text-caption text-muted">
                  <th className="py-2 pr-2 font-medium">Marketplace</th>
                  <th className="px-2 py-2 font-medium">Statut</th>
                  <th className="px-2 py-2 text-right font-medium">Lignes</th>
                  <th className="px-2 py-2 font-medium">Détail</th>
                  <th className="py-2 pl-2 text-right font-medium">Début</th>
                </tr>
              </thead>
              <tbody>
                {overview.runs.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-2 font-medium">{MARKETPLACES[r.marketplace]?.name ?? r.marketplace}</td>
                    <td className="px-2 py-2.5">
                      <StatusBadge tone={r.status === "success" ? "bon" : r.status === "running" ? "info" : r.status === "rate_limited" ? "important" : "critique"}>
                        {r.status === "success" ? "Réussie" : r.status === "running" ? "En cours" : r.status === "rate_limited" ? "Quota atteint" : "Échec"}
                      </StatusBadge>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular">{formatNumber(r.rows)}</td>
                    <td className="px-2 py-2.5 text-meta text-muted">{r.error ?? "-"}</td>
                    <td className="py-2.5 pl-2 text-right text-meta text-muted">{formatRelative(new Date(r.startedAt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
