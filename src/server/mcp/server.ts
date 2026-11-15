import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { canEdit } from "@/domain/access";
import { CATEGORY_LABEL, compareAlerts, SEVERITY_LABEL, STATUS_LABEL } from "@/domain/alerts";
import { MARKETPLACE_ORDER, MARKETPLACES } from "@/domain/marketplaces";
import { CURRENCIES } from "@/domain/money";
import { lastClosedMonth } from "@/domain/monthly-review";
import { flattenPnl, pnlMetrics, type PnlNode } from "@/domain/pnl";
import { formatDeltaPercent, formatEur, formatPercent } from "@/lib/format";
import {
  getConnectorsOverview,
  getDashboard,
  getForecast,
  getMonthlyReview,
  getPnl,
  getToday,
  listAlerts,
  setAlertStatus,
} from "@/server/data";
import { runAlertEngine } from "@/server/sync/run-alerts";
import type { MarketplaceCode } from "@/server/types";
import type { McpPrincipal } from "./auth";
import { currentMcpContext } from "./context";
import { importCosts, importListings, importSales } from "./imports";

const eur = (cents: number | null | undefined) => (cents == null ? null : formatEur(cents));
const pct = (v: number | null | undefined) => (v == null ? null : formatPercent(v));
const delta = (v: number | null | undefined) => (v == null ? null : formatDeltaPercent(v));
const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 1) }] });
const fail = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true });

const PERIOD = z.enum(["7j", "mois", "trimestre"]).default("mois").describe("Période : 7 derniers jours, mois en cours, trimestre en cours");
const MARKETPLACE = z.enum(MARKETPLACE_ORDER as [MarketplaceCode, ...MarketplaceCode[]]);
const CURRENCY = z.enum(CURRENCIES);
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date AAAA-MM-JJ");

function pnlLine(node: PnlNode) {
  const m = pnlMetrics(node);
  return {
    libelle: node.label,
    ca_ht: eur(m.revenue),
    evolution: delta(m.delta),
    commissions: eur(m.commissions),
    pub: eur(m.ads),
    logistique: eur(m.logistics),
    retours: eur(m.returns),
    cout_achat: eur(m.cogs),
    profit_net: eur(m.profit),
    marge_nette: pct(m.margin),
    tacos: pct(m.tacos),
  };
}

const INSTRUCTIONS = `Serveur MCP Trustry : pilotage des marketplaces d'un espace client.
Règles : montants toujours en euros HT ; marges toujours en %, jamais en euros ; publicité toujours exprimée en TACoS (pub / CA HT total), jamais en ACoS ; une référence bloquée passe toujours avant un réassort ; une chute de ventes cite les SKU concernés ou indique que la baisse est liée au compte ; jamais de tiret long ni demi-cadratin, uniquement "-".
Les outils d'action créent une demande que l'équipe valide dans Trustry, sauf si l'espace autorise les actions automatiques.`;

/** Crée le serveur MCP d'un espace, avec les outils autorisés par le rôle et le niveau d'accès. */
export function createTrustryMcpServer(principal: McpPrincipal) {
  const ws = principal.workspace;
  const server = new McpServer({ name: "trustry", version: "1.0.0" }, { instructions: INSTRUCTIONS });
  const canWrite = canEdit(principal.role);
  const level = ws.mcpPermission;

  // ---------------------------------------------------------------- Lecture
  server.registerTool(
    "resume_espace",
    {
      title: "Résumé de l'espace",
      description: `Profit net, CA HT, marge nette, commandes, canaux, top et flop SKU, alertes prioritaires de l'espace ${ws.name}, comparés à la période précédente équivalente.`,
      inputSchema: { periode: PERIOD },
      annotations: { readOnlyHint: true },
    },
    async ({ periode }) => {
      const v = await getDashboard(ws.id, periode);
      if (!v.hasData) return json({ espace: ws.name, message: "Pas encore de ventes : connectez une marketplace." });
      return json({
        espace: ws.name,
        periode,
        comparaison: v.compareLabel,
        profit_net: { valeur: eur(v.profit.value), evolution: delta(v.profit.delta) },
        ca_ht: { valeur: eur(v.revenue.value), evolution: delta(v.revenue.delta) },
        marge_nette: { valeur: pct(v.margin.value), evolution_points: v.margin.delta },
        commandes: { valeur: v.orders.value, panier_moyen_ht: eur(v.orders.basketCents) },
        canaux: v.channels.map((c) => ({ canal: c.name, ca_ht: eur(c.revenue), marge_nette: pct(c.margin), evolution: delta(c.delta) })),
        top_sku: v.topSkus.map((s) => ({ sku: s.sku, titre: s.title, boutique: s.storeLabel, ca_ht: eur(s.revenue), evolution: delta(s.delta), marge_nette: pct(s.margin) })),
        flop_sku: v.flopSkus.map((s) => ({ sku: s.sku, boutique: s.storeLabel, ca_ht: eur(s.revenue), evolution: delta(s.delta), cause: s.cause?.label ?? null })),
        alertes: { total: v.alerts.total, critiques: v.alerts.critical, importantes: v.alerts.important, prioritaires: v.alerts.top.map((a) => a.title) },
        sante_piliers: { global: v.pillars.global, piliers: v.pillars.rows.map((p) => ({ pilier: p.label, score: p.score })) },
      });
    },
  );

  server.registerTool(
    "prevision_atterrissage",
    {
      title: "Prévision d'atterrissage",
      description: "CA HT projeté en fin de mois ou de trimestre (rythme des 14 derniers jours corrigé du profil N-1), fourchette, objectif, rythme requis, profit et marge projetés.",
      inputSchema: { portee: z.enum(["mois", "trimestre"]).default("mois") },
      annotations: { readOnlyHint: true },
    },
    async ({ portee }) => {
      const f = await getForecast(ws.id, portee);
      return json({
        periode: `${f.start} au ${f.monthEnd}`,
        jours_clos: f.closedDays,
        jours_restants: f.remainingDays,
        realise_ca_ht: eur(f.realized.revenueHt),
        atterrissage_ca_ht: eur(f.landing),
        fourchette: [eur(f.low), eur(f.high)],
        methode: f.method === "saisonnalise" ? "rythme 14 jours corrigé du profil N-1" : "rythme 14 jours",
        sans_saisonnalite: eur(f.runRateLanding),
        vs_periode_precedente: delta(f.deltaVsPreviousMonth),
        vs_n_1: delta(f.deltaVsLastYear),
        objectif: eur(f.target),
        atteinte_objectif: pct(f.targetProgress),
        rythme_actuel_par_jour: eur(f.runRateDaily),
        rythme_requis_par_jour: eur(f.requiredDaily),
        profit_net_projete: eur(f.netProfit),
        marge_nette: pct(f.netMargin),
        tacos: pct(f.tacos),
        fiabilite: f.confidence,
      });
    },
  );

  server.registerTool(
    "pnl_detaille",
    {
      title: "P&L détaillé",
      description: "Compte de résultat par canal, pays ou SKU : CA HT, commissions, pub, logistique, retours, coût d'achat, profit net, marge nette en %, TACoS. Filtres optionnels.",
      inputSchema: {
        periode: PERIOD,
        niveau: z.enum(["canal", "pays", "sku"]).default("canal"),
        canal: MARKETPLACE.optional(),
        pays: z.string().length(2).optional(),
        marque: z.string().optional(),
        recherche: z.string().optional().describe("SKU ou titre"),
        limite: z.number().int().min(1).max(200).default(50),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ periode, niveau, canal, pays, marque, recherche, limite }) => {
      const view = await getPnl(ws.id, periode, { canal, pays, marque, q: recherche });
      const lines =
        niveau === "canal"
          ? view.rows.map((n) => ({ canal: n.label, ...pnlLine(n) }))
          : niveau === "pays"
            ? view.rows.flatMap((ch) => ch.children.map((co) => ({ canal: ch.label, pays: co.label, ...pnlLine(co) })))
            : flattenPnl(view).map((x) => ({ canal: x.channel, pays: x.country, sku: x.node.label, titre: x.node.sublabel, ...pnlLine(x.node) }));
      return json({ periode, total: pnlLine(view.total), lignes: lines.slice(0, limite), lignes_total: lines.length });
    },
  );

  server.registerTool(
    "lister_alertes",
    {
      title: "Alertes",
      description: "Alertes de l'espace triées par priorité (référence bloquée d'abord, puis gravité, puis CA à risque).",
      inputSchema: {
        statut: z.enum(["todo", "in_progress", "resolved", "ouvertes"]).default("ouvertes"),
        gravite: z.enum(["critical", "important", "info"]).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ statut, gravite }) => {
      const all = (await listAlerts(ws.id))
        .filter((a) => (statut === "ouvertes" ? a.status !== "resolved" : a.status === statut))
        .filter((a) => !gravite || a.severity === gravite)
        .sort((a, b) => compareAlerts({ ...a, createdAt: new Date(a.createdAt) }, { ...b, createdAt: new Date(b.createdAt) }));
      return json(
        all.map((a) => ({
          id: a.id,
          gravite: SEVERITY_LABEL[a.severity],
          categorie: CATEGORY_LABEL[a.category],
          titre: a.title,
          detail: a.detail,
          cause: a.scope === "account" ? "liée au compte" : "SKU identifiés",
          concernes: a.subjects,
          ca_a_risque_ht: eur(a.revenueAtRiskCents),
          action_suggeree: a.suggestedAction,
          statut: STATUS_LABEL[a.status],
          creee_le: a.createdAt,
        })),
      );
    },
  );

  server.registerTool(
    "revue_mensuelle",
    {
      title: "Revue mensuelle par pôle",
      description: "Acquisition (TACoS), retours, logistique et frais internes d'un mois clos : valeur, cible, évolution, leviers, et répartition par marketplace et marque.",
      inputSchema: { mois: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("AAAA-MM, dernier mois clos par défaut") },
      annotations: { readOnlyHint: true },
    },
    async ({ mois }) => {
      const month = mois ?? lastClosedMonth(await getToday());
      const r = await getMonthlyReview(ws.id, month);
      if (!r.selected) return json({ mois: month, message: "Pas de ventes ce mois-ci." });
      return json({
        mois: month,
        ca_ht: eur(r.selected.revenue),
        evolution: delta(r.selected.revenueDelta),
        marge_nette_apres_opex: pct(r.selected.netMargin),
        poles: r.poles.map((p) => ({ pole: p.label, indicateur: p.metricLabel, valeur: pct(p.value), cible: pct(p.target), evolution_points: p.deltaPoints, montant_ht: eur(p.amount), statut: p.status, leviers: p.levers })),
        par_marketplace: r.byMarketplace.map((b) => ({ marketplace: b.label, ca_ht: eur(b.revenue), part: pct(b.share), tacos: pct(b.tacos), retours: pct(b.returnRate), logistique: pct(b.logisticsRate), marge_nette: pct(b.netMargin) })),
        par_marque: r.byBrand.slice(0, 15).map((b) => ({ marque: b.label, ca_ht: eur(b.revenue), part: pct(b.share), marge_nette: pct(b.netMargin) })),
      });
    },
  );

  server.registerTool(
    "etat_connecteurs",
    {
      title: "État des connecteurs",
      description: "Statut de chaque marketplace (connectée, en erreur, non connectée), méthode, dernière synchro et erreurs.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const o = await getConnectorsOverview(ws.id);
      return json({
        niveau_acces_claude: level,
        marketplaces: o.rows.map((r) => ({
          code: r.marketplace,
          nom: MARKETPLACES[r.marketplace].name,
          pays: MARKETPLACES[r.marketplace].countries,
          statut: r.connection?.status ?? "not_connected",
          methode: r.connection?.method ?? null,
          derniere_synchro: r.connection?.lastSyncAt ?? null,
          erreur: r.connection?.lastError ?? null,
        })),
      });
    },
  );

  // ---------------------------------------------------------------- Actions (niveau 2 et 3)
  if (level !== "read" && canWrite) {
    const auto = level === "actions_auto";
    const ctx = () => currentMcpContext();
    const record = async (tool: string, title: string, payload: Record<string, unknown>, status: "pending" | "executed", result?: unknown) => {
      const c = ctx();
      if (!c) throw new Error("Contexte MCP manquant");
      const { data, error } = await c.supabase
        .from("mcp_action_requests")
        .insert({ workspace_id: ws.id, requested_by: principal.userId, tool, title, payload, status, via: principal.via, result: result ?? null, decided_at: status === "executed" ? new Date().toISOString() : null })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await c.supabase.from("audit_log").insert({ workspace_id: ws.id, actor_id: principal.userId, action: `mcp.${tool}`, target: title, payload });
      return data.id as string;
    };

    server.registerTool(
      "changer_statut_alerte",
      {
        title: "Changer le statut d'une alerte",
        description: auto
          ? "Passe une alerte à faire, en cours ou résolue (exécuté immédiatement : actions automatiques activées)."
          : "Demande de passer une alerte à faire, en cours ou résolue. L'équipe valide la demande dans Trustry.",
        inputSchema: { alerte_id: z.string().uuid(), statut: z.enum(["todo", "in_progress", "resolved"]), commentaire: z.string().max(500).optional() },
        annotations: { destructiveHint: false, idempotentHint: true },
      },
      async ({ alerte_id, statut, commentaire }) => {
        const alert = (await listAlerts(ws.id)).find((a) => a.id === alerte_id);
        if (!alert) return fail("Alerte introuvable dans cet espace.");
        const title = `${STATUS_LABEL[statut]} : ${alert.title}`;
        if (auto) {
          await setAlertStatus(ws.id, alerte_id, statut);
          await record("changer_statut_alerte", title, { alerte_id, statut, commentaire }, "executed", { ok: true });
          return json({ execute: true, message: `Alerte passée en "${STATUS_LABEL[statut]}".` });
        }
        const id = await record("changer_statut_alerte", title, { alerte_id, statut, commentaire }, "pending");
        return json({ execute: false, demande: id, message: "Demande créée : à valider dans Trustry (page Alertes)." });
      },
    );

    server.registerTool(
      "demander_action_marketplace",
      {
        title: "Demander une action sur une marketplace",
        description:
          "Prépare une action sur une marketplace (débloquer une référence, ajuster un prix, ajuster des enchères, lancer un réassort). Elle est enregistrée dans Trustry pour validation et exécution par l'équipe : Trustry ne modifie pas encore les marketplaces directement.",
        inputSchema: {
          type: z.enum(["debloquer_reference", "ajuster_prix", "ajuster_encheres", "reassort"]),
          marketplace: MARKETPLACE,
          pays: z.string().length(2),
          sku: z.string().min(1),
          detail: z.string().min(3).max(1000).describe("Ce qu'il faut faire et pourquoi"),
          valeur_ht: z.number().optional().describe("Nouveau prix HT ou nouvelle enchère, en euros"),
        },
      },
      async (input) => {
        const labels = { debloquer_reference: "Débloquer", ajuster_prix: "Ajuster le prix", ajuster_encheres: "Ajuster les enchères", reassort: "Réassort" };
        const title = `${labels[input.type]} ${input.sku} sur ${MARKETPLACES[input.marketplace].name} ${input.pays}`;
        const id = await record("demander_action_marketplace", title, input, "pending");
        const note = input.type === "reassort" ? " Rappel : débloquez d'abord les références bloquées, le réassort se lance en parallèle." : "";
        return json({ demande: id, message: `Demande enregistrée, à valider dans Trustry.${note}` });
      },
    );
  }

  // ---------------------------------------------------------------- Imports (synchro via Claude)
  if (canWrite) {
    const supa = () => {
      const c = currentMcpContext();
      if (!c) throw new Error("Contexte MCP manquant");
      return c.supabase;
    };
    const afterImport = async () => {
      try {
        await runAlertEngine(supa(), ws.id);
      } catch {
        // les alertes seront recalculées par le job horaire
      }
    };

    server.registerTool(
      "importer_ventes",
      {
        title: "Importer des ventes (synchro via Claude)",
        description:
          "Envoie à Trustry les ventes agrégées par jour, pays et SKU d'une marketplace, lues dans un autre connecteur (ex. Amazon Seller). Montants HT en centimes, dans la devise de la boutique. Les lignes existantes (même jour, pays, SKU) sont remplacées. 2 000 lignes max par appel.",
        inputSchema: {
          marketplace: MARKETPLACE,
          lignes: z
            .array(
              z.object({
                date: DATE,
                pays: z.string().length(2),
                sku: z.string().min(1),
                titre: z.string().optional(),
                marque: z.string().optional(),
                unites: z.number().int().min(0),
                commandes: z.number().int().min(0).optional(),
                ca_ht_centimes: z.number().int(),
                devise: CURRENCY,
                commissions_centimes: z.number().int().optional(),
                pub_centimes: z.number().int().optional(),
                logistique_centimes: z.number().int().optional(),
                retours_centimes: z.number().int().optional().describe("Remboursement HT + frais de retour - valeur restockée"),
                retours_unites: z.number().int().optional(),
              }),
            )
            .min(1)
            .max(2000),
        },
      },
      async ({ marketplace, lignes }) => {
        try {
          const res = await importSales(
            supa(),
            ws.id,
            marketplace,
            lignes.map((l) => ({
              date: l.date,
              country: l.pays.toUpperCase(),
              sku: l.sku,
              title: l.titre,
              brand: l.marque,
              units: l.unites,
              orders: l.commandes,
              revenueHtCents: l.ca_ht_centimes,
              currency: l.devise,
              commissionsCents: l.commissions_centimes,
              adsCents: l.pub_centimes,
              logisticsCents: l.logistique_centimes,
              returnsCents: l.retours_centimes,
              returnUnits: l.retours_unites,
            })),
          );
          await afterImport();
          return json({ lignes_enregistrees: res.rows, sku_sans_cout_achat: res.skusWithoutCost, conseil: res.skusWithoutCost ? "Importez les coûts d'achat (importer_couts_achat) pour une marge exacte." : null });
        } catch (e) {
          return fail(e instanceof Error ? e.message : "Import impossible");
        }
      },
    );

    server.registerTool(
      "importer_fiches_et_stock",
      {
        title: "Importer l'état des fiches et le stock",
        description: "Statut des fiches par pays (active, bloquée avec motif, inactive), prix TTC affiché en centimes et stock disponible. Les références bloquées créent une alerte critique.",
        inputSchema: {
          marketplace: MARKETPLACE,
          lignes: z
            .array(
              z.object({
                pays: z.string().length(2),
                sku: z.string().min(1),
                titre: z.string().optional(),
                marque: z.string().optional(),
                statut: z.enum(["active", "blocked", "inactive", "deleted"]),
                motif_blocage: z.string().optional(),
                prix_centimes: z.number().int().optional(),
                devise: CURRENCY.optional(),
                stock: z.number().int().min(0).optional(),
              }),
            )
            .min(1)
            .max(5000),
        },
      },
      async ({ marketplace, lignes }) => {
        try {
          const res = await importListings(
            supa(),
            ws.id,
            marketplace,
            lignes.map((l) => ({
              country: l.pays.toUpperCase(),
              sku: l.sku,
              title: l.titre,
              brand: l.marque,
              status: l.statut,
              blockReason: l.motif_blocage,
              priceCents: l.prix_centimes,
              currency: l.devise,
              stock: l.stock,
            })),
          );
          await afterImport();
          return json({ fiches: res.listings, stocks: res.stock });
        } catch (e) {
          return fail(e instanceof Error ? e.message : "Import impossible");
        }
      },
    );

    server.registerTool(
      "importer_couts_achat",
      {
        title: "Importer les coûts d'achat (Odoo)",
        description: "Coût d'achat unitaire HT par SKU (ex. coût standard Odoo), en centimes, avec sa date de validité. Sert au calcul de la marge.",
        inputSchema: {
          lignes: z.array(z.object({ sku: z.string().min(1), cout_unitaire_ht_centimes: z.number().int().min(0), devise: CURRENCY.default("EUR"), valable_depuis: DATE })).min(1).max(5000),
        },
      },
      async ({ lignes }) => {
        try {
          const res = await importCosts(
            supa(),
            ws.id,
            lignes.map((l) => ({ sku: l.sku, unitCostHtCents: l.cout_unitaire_ht_centimes, currency: l.devise, validFrom: l.valable_depuis })),
          );
          return json({ couts_enregistres: res.costs, note: "Les marges des ventes déjà importées seront recalculées au prochain import de ventes." });
        } catch (e) {
          return fail(e instanceof Error ? e.message : "Import impossible");
        }
      },
    );
  }

  return server;
}
