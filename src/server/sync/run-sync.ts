import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rateAt } from "@/domain/fx";
import { MARKETPLACES } from "@/domain/marketplaces";
import { currencyForCountry, type Currency } from "@/domain/money";
import { isoAddDays } from "@/domain/period";
import { buildDailyMetrics, type NormalizedListing } from "@/domain/sync-metrics";
import { parisToday } from "@/lib/dates";
import { getAdapter } from "@/server/connectors/registry";
import { AdapterError } from "@/server/connectors/types";
import type { MarketplaceCode } from "@/server/types";
import { selectAll, upsertBatches } from "@/server/supabase/admin";

/** Profondeur de la première synchro, puis recouvrement des synchros suivantes (commandes tardives, frais). */
export const INITIAL_DAYS = 30;
export const OVERLAP_DAYS = 3;

type ConnectionRow = {
  id: string;
  workspace_id: string;
  marketplace_code: MarketplaceCode;
  adapter: string;
  status: string;
  last_sync_at: string | null;
  credentials_secret_id: string | null;
};

export type SyncResult = { status: "success" | "error" | "rate_limited" | "skipped"; rows: number; message?: string };

/**
 * Synchronise une connexion : récupère les données de la marketplace, met à jour catalogue,
 * fiches, stock et commandes, puis recalcule les métriques journalières de la période.
 * Journalise chaque exécution dans sync_runs et met à jour l'état de la connexion.
 */
export async function runConnectionSync(supabase: SupabaseClient, connectionId: string): Promise<SyncResult> {
  const { data: conn, error } = await supabase
    .from("connections")
    .select("id, workspace_id, marketplace_code, adapter, status, last_sync_at, credentials_secret_id")
    .eq("id", connectionId)
    .maybeSingle<ConnectionRow>();
  if (error || !conn) return { status: "skipped", rows: 0, message: "Connexion introuvable" };
  const ws = conn.workspace_id;
  const today = parisToday();

  // Identifiants (Vault) pour les connecteurs natifs
  let credentials: Record<string, string> | null = null;
  if (conn.credentials_secret_id) {
    const { data: secret } = await supabase.rpc("connection_credentials", { target: conn.id });
    try {
      credentials = secret ? JSON.parse(String(secret)) : null;
    } catch {
      credentials = null;
    }
  }

  const products = await selectAll<{ id: string; sku: string; title: string; brand: string }>((a, b) =>
    supabase.from("products").select("id, sku, title, brand").eq("workspace_id", ws).range(a, b),
  );
  const countries = MARKETPLACES[conn.marketplace_code]?.countries ?? ["FR"];
  const adapter = getAdapter(conn.adapter, {
    workspaceId: ws,
    connectionId: conn.id,
    marketplace: conn.marketplace_code,
    countries,
    catalogue: products.map((p) => ({ sku: p.sku, title: p.title, brand: p.brand, priceHtCents: 4_000 })),
    credentials,
    today,
  });
  if (!adapter) return { status: "skipped", rows: 0, message: "Pas encore de connecteur natif : synchro via Claude (MCP)" };

  const { data: run } = await supabase
    .from("sync_runs")
    .insert({ workspace_id: ws, connection_id: conn.id, job: "full", status: "running" })
    .select("id")
    .single();
  await supabase.from("connections").update({ status: "syncing", sync_progress: 0 }).eq("id", conn.id);

  const range = {
    from: conn.last_sync_at ? isoAddDays(conn.last_sync_at.slice(0, 10), -OVERLAP_DAYS) : isoAddDays(today, -(INITIAL_DAYS - 1)),
    to: today,
  };

  try {
    const [orders, listings, inventory, ads, fees, returns, tokenExpiresAt] = await Promise.all([
      adapter.orders(range),
      adapter.listings(),
      adapter.inventory(),
      adapter.ads(range),
      adapter.finances(range),
      adapter.returns(range),
      adapter.tokenExpiresAt(),
    ]);
    let rows = 0;

    // 1) Boutiques (une par pays)
    await upsertBatches(
      supabase,
      "stores",
      countries.map((c) => ({ workspace_id: ws, connection_id: conn.id, country: c, currency: currencyForCountry(c) })),
      "connection_id,country",
    );
    const { data: stores } = await supabase.from("stores").select("id, country").eq("connection_id", conn.id);
    const storeId = new Map((stores ?? []).map((s) => [s.country as string, s.id as string]));

    // 2) Produits inconnus (créés depuis les fiches et commandes)
    const known = new Map(products.map((p) => [p.sku, p.id]));
    const fromListings = new Map<string, NormalizedListing>(listings.map((l) => [l.sku, l]));
    const newSkus = new Set([...listings.map((l) => l.sku), ...orders.flatMap((o) => o.items.map((i) => i.sku))].filter((s) => !known.has(s)));
    if (newSkus.size) {
      rows += await upsertBatches(
        supabase,
        "products",
        [...newSkus].map((sku) => ({ workspace_id: ws, sku, title: fromListings.get(sku)?.title ?? sku, brand: fromListings.get(sku)?.brand ?? "", ean: fromListings.get(sku)?.ean ?? null })),
        "workspace_id,sku",
      );
      const fresh = await selectAll<{ id: string; sku: string }>((a, b) => supabase.from("products").select("id, sku").eq("workspace_id", ws).range(a, b));
      for (const p of fresh) known.set(p.sku, p.id);
    }
    await supabase.from("connections").update({ sync_progress: 30 }).eq("id", conn.id);

    // 3) Fiches et stock
    rows += await upsertBatches(
      supabase,
      "listings",
      listings
        .filter((l) => storeId.has(l.country) && known.has(l.sku))
        .map((l) => ({
          workspace_id: ws,
          product_id: known.get(l.sku),
          store_id: storeId.get(l.country),
          external_id: l.externalId,
          status: l.status,
          block_reason: l.blockReason,
          price_cents: l.priceCents,
          currency: l.currency,
          updated_at: new Date().toISOString(),
        })),
      "product_id,store_id",
    );
    rows += await upsertBatches(
      supabase,
      "inventory_snapshots",
      inventory.filter((i) => known.has(i.sku)).map((i) => ({ workspace_id: ws, product_id: known.get(i.sku), snapshot_date: today, quantity: i.quantity })),
      "product_id,snapshot_date",
    );

    // 4) Commandes (en-têtes ; les lignes servent au rapprochement OMS et aux coûts logistiques)
    rows += await upsertBatches(
      supabase,
      "orders",
      orders
        .filter((o) => storeId.has(o.country))
        .map((o) => ({ workspace_id: ws, store_id: storeId.get(o.country), external_id: o.externalId, ordered_at: o.orderedAt, status: o.status, currency: o.currency })),
      "store_id,external_id",
    );
    await supabase.from("connections").update({ sync_progress: 60 }).eq("id", conn.id);

    // 5) Coûts d'achat (Odoo) et taux BCE
    const costs = await selectAll<{ product_id: string; unit_cost_cents: number; valid_from: string }>((a, b) =>
      supabase.from("product_costs").select("product_id, unit_cost_cents, valid_from").eq("workspace_id", ws).order("valid_from").range(a, b),
    );
    const costBySku = new Map<string, { from: string; cents: number }[]>();
    const skuById = new Map([...known.entries()].map(([sku, id]) => [id, sku]));
    for (const c of costs) {
      const sku = skuById.get(c.product_id);
      if (sku) costBySku.set(sku, [...(costBySku.get(sku) ?? []), { from: c.valid_from, cents: Number(c.unit_cost_cents) }]);
    }
    const { data: fx } = await supabase
      .from("fx_rates")
      .select("rate_date, currency, eur_per_unit")
      .gte("rate_date", isoAddDays(range.from, -10))
      .order("rate_date");
    const fxBy = new Map<string, { date: string; eurPerUnit: number }[]>();
    for (const r of fx ?? []) fxBy.set(r.currency, [...(fxBy.get(r.currency) ?? []), { date: r.rate_date, eurPerUnit: Number(r.eur_per_unit) }]);

    const metrics = buildDailyMetrics({
      orders,
      fees,
      ads,
      returns,
      unitCost: (sku, date) => {
        const list = costBySku.get(sku);
        if (!list) return null;
        let v: number | null = null;
        for (const c of list) if (c.from <= date) v = c.cents;
        return v ?? list[0].cents;
      },
      eurPerUnit: (currency: Currency, date) => {
        const r = rateAt(fxBy.get(currency) ?? [], date);
        if (r === null) throw new AdapterError(`Taux BCE ${currency} indisponible`, "invalid");
        return r;
      },
    });

    // 6) Métriques journalières : on remplace la période synchronisée pour cette connexion
    const storeIds = [...storeId.values()];
    await supabase.from("daily_sku_metrics").delete().in("store_id", storeIds).gte("metric_date", range.from).lte("metric_date", range.to);
    rows += await upsertBatches(
      supabase,
      "daily_sku_metrics",
      metrics.rows
        .filter((m) => storeId.has(m.country) && known.has(m.sku))
        .map((m) => ({
          workspace_id: ws,
          metric_date: m.date,
          store_id: storeId.get(m.country),
          product_id: known.get(m.sku),
          units: m.units,
          orders_count: m.orders,
          revenue_ht_eur_cents: m.revenueHt,
          commissions_eur_cents: m.commissions,
          ads_eur_cents: m.ads,
          logistics_eur_cents: m.logistics,
          returns_eur_cents: m.returns,
          cogs_eur_cents: m.cogs,
          returns_units: m.returnUnits,
        })),
      "store_id,product_id,metric_date",
    );

    const quota = adapter.quota();
    const note = metrics.missingCosts.length ? `${metrics.missingCosts.length} SKU sans coût d'achat` : null;
    await supabase.from("sync_runs").update({ status: "success", finished_at: new Date().toISOString(), rows_upserted: rows, quota_remaining: quota.remaining, error: note }).eq("id", run?.id);
    await supabase
      .from("connections")
      .update({ status: "connected", sync_progress: 100, last_sync_at: new Date().toISOString(), last_error: null, token_expires_at: tokenExpiresAt })
      .eq("id", conn.id);
    return { status: "success", rows, message: note ?? undefined };
  } catch (e) {
    const kind = e instanceof AdapterError ? e.kind : "unavailable";
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    const status = kind === "rate_limited" ? "rate_limited" : "error";
    await supabase.from("sync_runs").update({ status, finished_at: new Date().toISOString(), error: message }).eq("id", run?.id);
    // Quota atteint : on garde l'état connecté, la prochaine synchro reprendra
    await supabase
      .from("connections")
      .update(status === "rate_limited" ? { status: "connected", sync_progress: null } : { status: "error", sync_progress: null, last_error: message })
      .eq("id", conn.id);
    if (status === "rate_limited") return { status, rows: 0, message };
    throw e;
  }
}
