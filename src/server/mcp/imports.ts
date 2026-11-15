import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rateAt } from "@/domain/fx";
import { MARKETPLACES } from "@/domain/marketplaces";
import { currencyForCountry, toEurCents, type Currency } from "@/domain/money";
import { isoAddDays } from "@/domain/period";
import { selectAll, upsertBatches } from "@/server/supabase/admin";
import type { MarketplaceCode } from "@/server/types";

/**
 * Imports poussés par Claude ("Via Claude (MCP)") : Claude lit les connecteurs auxquels il a accès
 * (Amazon Seller, Odoo, Google Drive...) et envoie à Trustry des données déjà agrégées.
 * Montants reçus en centimes HT dans la devise d'origine, convertis en EUR au taux BCE du jour.
 */

export type SalesLine = {
  date: string;
  country: string;
  sku: string;
  title?: string;
  brand?: string;
  units: number;
  orders?: number;
  revenueHtCents: number;
  currency: Currency;
  commissionsCents?: number;
  adsCents?: number;
  logisticsCents?: number;
  returnsCents?: number;
  returnUnits?: number;
};

export type ListingLine = {
  country: string;
  sku: string;
  title?: string;
  brand?: string;
  status: "active" | "blocked" | "inactive" | "deleted";
  blockReason?: string | null;
  priceCents?: number | null;
  currency?: Currency;
  stock?: number | null;
};

export type CostLine = { sku: string; unitCostHtCents: number; currency: Currency; validFrom: string };

async function ensureConnection(supabase: SupabaseClient, ws: string, marketplace: MarketplaceCode, countries: string[]) {
  const { data: existing } = await supabase.from("connections").select("id, method, status").eq("workspace_id", ws).eq("marketplace_code", marketplace).maybeSingle();
  let id = existing?.id as string | undefined;
  if (!id) {
    const { data, error } = await supabase
      .from("connections")
      .insert({ workspace_id: ws, marketplace_code: marketplace, method: "mcp", status: "connected" })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Connexion ${marketplace} : ${error?.message}`);
    id = data.id as string;
  }
  const known = MARKETPLACES[marketplace].countries;
  const unknown = countries.filter((c) => !known.includes(c));
  if (unknown.length) throw new Error(`Pays non gérés pour ${MARKETPLACES[marketplace].name} : ${unknown.join(", ")}`);
  await upsertBatches(
    supabase,
    "stores",
    [...new Set(countries)].map((c) => ({ workspace_id: ws, connection_id: id, country: c, currency: currencyForCountry(c) })),
    "connection_id,country",
  );
  const { data: stores } = await supabase.from("stores").select("id, country").eq("connection_id", id);
  return { connectionId: id, storeId: new Map((stores ?? []).map((s) => [s.country as string, s.id as string])) };
}

async function ensureProducts(supabase: SupabaseClient, ws: string, lines: { sku: string; title?: string; brand?: string }[]) {
  const products = await selectAll<{ id: string; sku: string }>((a, b) => supabase.from("products").select("id, sku").eq("workspace_id", ws).range(a, b));
  const known = new Map(products.map((p) => [p.sku, p.id]));
  const fresh = new Map<string, { sku: string; title?: string; brand?: string }>();
  for (const l of lines) if (!known.has(l.sku) && !fresh.has(l.sku)) fresh.set(l.sku, l);
  if (fresh.size) {
    await upsertBatches(
      supabase,
      "products",
      [...fresh.values()].map((l) => ({ workspace_id: ws, sku: l.sku, title: l.title || l.sku, brand: l.brand ?? "" })),
      "workspace_id,sku",
    );
    const all = await selectAll<{ id: string; sku: string }>((a, b) => supabase.from("products").select("id, sku").eq("workspace_id", ws).range(a, b));
    for (const p of all) known.set(p.sku, p.id);
  }
  return known;
}

async function fxLookup(supabase: SupabaseClient, from: string) {
  const { data } = await supabase.from("fx_rates").select("rate_date, currency, eur_per_unit").gte("rate_date", isoAddDays(from, -10)).order("rate_date");
  const by = new Map<string, { date: string; eurPerUnit: number }[]>();
  for (const r of data ?? []) by.set(r.currency, [...(by.get(r.currency) ?? []), { date: r.rate_date, eurPerUnit: Number(r.eur_per_unit) }]);
  return (cents: number, currency: Currency, date: string) => {
    if (currency === "EUR") return cents;
    const rate = rateAt(by.get(currency) ?? [], date);
    if (rate === null) throw new Error(`Taux BCE ${currency} indisponible : lancez la récupération des taux`);
    return toEurCents(cents, currency, rate);
  };
}

export async function importSales(supabase: SupabaseClient, ws: string, marketplace: MarketplaceCode, lines: SalesLine[]) {
  if (!lines.length) return { rows: 0, skusWithoutCost: 0 };
  const started = new Date().toISOString();
  const { connectionId, storeId } = await ensureConnection(supabase, ws, marketplace, lines.map((l) => l.country));
  const products = await ensureProducts(supabase, ws, lines);
  const from = lines.reduce((m, l) => (l.date < m ? l.date : m), lines[0].date);
  const eur = await fxLookup(supabase, from);

  const costs = await selectAll<{ product_id: string; unit_cost_cents: number; valid_from: string }>((a, b) =>
    supabase.from("product_costs").select("product_id, unit_cost_cents, valid_from").eq("workspace_id", ws).order("valid_from").range(a, b),
  );
  const costAt = (productId: string, date: string) => {
    let v: number | null = null;
    for (const c of costs) if (c.product_id === productId && c.valid_from <= date) v = Number(c.unit_cost_cents);
    return v ?? (costs.find((c) => c.product_id === productId)?.unit_cost_cents as number | undefined) ?? null;
  };

  const missing = new Set<string>();
  const merged = new Map<string, Record<string, unknown>>();
  for (const l of lines) {
    const productId = products.get(l.sku)!;
    const unit = costAt(productId, l.date);
    if (unit === null) missing.add(l.sku);
    const key = `${storeId.get(l.country)}|${productId}|${l.date}`;
    const prev = merged.get(key);
    const row = {
      workspace_id: ws,
      metric_date: l.date,
      store_id: storeId.get(l.country),
      product_id: productId,
      units: l.units + Number(prev?.units ?? 0),
      orders_count: (l.orders ?? l.units) + Number(prev?.orders_count ?? 0),
      revenue_ht_eur_cents: eur(l.revenueHtCents, l.currency, l.date) + Number(prev?.revenue_ht_eur_cents ?? 0),
      commissions_eur_cents: eur(l.commissionsCents ?? 0, l.currency, l.date) + Number(prev?.commissions_eur_cents ?? 0),
      ads_eur_cents: eur(l.adsCents ?? 0, l.currency, l.date) + Number(prev?.ads_eur_cents ?? 0),
      logistics_eur_cents: eur(l.logisticsCents ?? 0, l.currency, l.date) + Number(prev?.logistics_eur_cents ?? 0),
      returns_eur_cents: eur(l.returnsCents ?? 0, l.currency, l.date) + Number(prev?.returns_eur_cents ?? 0),
      cogs_eur_cents: (unit ?? 0) * l.units + Number(prev?.cogs_eur_cents ?? 0),
      returns_units: (l.returnUnits ?? 0) + Number(prev?.returns_units ?? 0),
    };
    merged.set(key, row);
  }
  const rows = await upsertBatches(supabase, "daily_sku_metrics", [...merged.values()], "store_id,product_id,metric_date");
  const note = missing.size ? `${missing.size} SKU sans coût d'achat` : null;
  await supabase.from("sync_runs").insert({ workspace_id: ws, connection_id: connectionId, job: "claude", status: "success", started_at: started, finished_at: new Date().toISOString(), rows_upserted: rows, error: note });
  await supabase.from("connections").update({ status: "connected", last_sync_at: new Date().toISOString(), last_error: null, sync_progress: null }).eq("id", connectionId);
  return { rows, skusWithoutCost: missing.size };
}

export async function importListings(supabase: SupabaseClient, ws: string, marketplace: MarketplaceCode, lines: ListingLine[]) {
  if (!lines.length) return { listings: 0, stock: 0 };
  const { storeId } = await ensureConnection(supabase, ws, marketplace, lines.map((l) => l.country));
  const products = await ensureProducts(supabase, ws, lines);
  const listings = await upsertBatches(
    supabase,
    "listings",
    lines.map((l) => ({
      workspace_id: ws,
      product_id: products.get(l.sku),
      store_id: storeId.get(l.country),
      status: l.status,
      block_reason: l.status === "blocked" ? (l.blockReason ?? "Motif non communiqué") : null,
      price_cents: l.priceCents ?? null,
      currency: l.currency ?? currencyForCountry(l.country),
      updated_at: new Date().toISOString(),
    })),
    "product_id,store_id",
  );
  // Stock : un instantané par produit et par jour (somme des pays transmis)
  const today = new Date().toISOString().slice(0, 10);
  const stock = new Map<string, number>();
  for (const l of lines) if (l.stock != null) stock.set(l.sku, (stock.get(l.sku) ?? 0) + l.stock);
  const snapshots = await upsertBatches(
    supabase,
    "inventory_snapshots",
    [...stock.entries()].map(([sku, quantity]) => ({ workspace_id: ws, product_id: products.get(sku), snapshot_date: today, quantity })),
    "product_id,snapshot_date",
  );
  return { listings, stock: snapshots };
}

export async function importCosts(supabase: SupabaseClient, ws: string, lines: CostLine[]) {
  if (!lines.length) return { costs: 0 };
  const products = await ensureProducts(supabase, ws, lines);
  const eur = await fxLookup(supabase, lines.reduce((m, l) => (l.validFrom < m ? l.validFrom : m), lines[0].validFrom));
  const costs = await upsertBatches(
    supabase,
    "product_costs",
    lines.map((l) => ({
      workspace_id: ws,
      product_id: products.get(l.sku),
      unit_cost_cents: eur(l.unitCostHtCents, l.currency, l.validFrom),
      currency: "EUR",
      valid_from: l.validFrom,
      source: "odoo",
    })),
    "product_id,valid_from",
  );
  return { costs };
}
