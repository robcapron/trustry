import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDemoDataset } from "./seed";

/**
 * Charge les données d'exemple d'un espace démo (même slug) dans Supabase,
 * avec la session de l'utilisateur : la RLS s'applique (owner/admin requis).
 * Réservé aux environnements où TRUSTRY_ALLOW_DEMO_SEED=1.
 */
export async function seedWorkspaceFromDemo(
  supabase: SupabaseClient,
  target: { id: string; slug: string },
): Promise<{ rows: number }> {
  const ds = buildDemoDataset();
  const source = ds.workspaces.find((w) => w.slug === target.slug);
  if (!source) throw new Error(`Aucun jeu d'exemple pour l'espace ${target.slug}.`);

  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("workspace_id", target.id);
  if ((count ?? 0) > 0) throw new Error("Cet espace contient déjà des produits : chargement annulé.");

  const ws = target.id;
  const mine = <T extends { workspaceId: string }>(rows: T[]) => rows.filter((r) => r.workspaceId === source.id);
  let total = 0;

  async function insert(table: string, rows: Record<string, unknown>[], batch = 1000) {
    for (let i = 0; i < rows.length; i += batch) {
      const { error } = await supabase.from(table).insert(rows.slice(i, i + batch));
      if (error) throw new Error(`${table} : ${error.message}`);
    }
    total += rows.length;
  }

  await insert(
    "connections",
    mine(ds.connections).map((c) => ({
      id: c.id,
      workspace_id: ws,
      marketplace_code: c.marketplace,
      method: c.method,
      status: c.status,
      sync_frequency_minutes: c.syncFrequencyMinutes,
      sync_progress: c.syncProgress,
      last_sync_at: c.lastSyncAt,
      token_expires_at: c.tokenExpiresAt,
      last_error: c.lastError,
    })),
  );
  await insert(
    "stores",
    mine(ds.stores).map((s) => ({ id: s.id, workspace_id: ws, connection_id: s.connectionId, country: s.country, currency: s.currency })),
  );
  const products = mine(ds.products);
  await insert(
    "products",
    products.map((p) => ({ id: p.id, workspace_id: ws, sku: p.sku, brand: p.brand, title: p.title })),
  );
  await insert(
    "product_costs",
    products.map((p) => ({
      workspace_id: ws,
      product_id: p.id,
      unit_cost_cents: p.unitCostCents,
      currency: "EUR",
      valid_from: "2026-01-01",
      source: "manual",
    })),
  );
  await insert(
    "listings",
    mine(ds.listings).map((l) => ({
      id: l.id,
      workspace_id: ws,
      product_id: l.productId,
      store_id: l.storeId,
      status: l.status,
      block_reason: l.blockReason,
      quality_score: l.qualityScore,
    })),
  );
  await insert(
    "daily_sku_metrics",
    mine(ds.metrics).map((m) => ({
      workspace_id: ws,
      metric_date: m.date,
      store_id: m.storeId,
      product_id: m.productId,
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
  );
  await insert(
    "alerts",
    mine(ds.alerts).map((a) => ({
      workspace_id: ws,
      severity: a.severity,
      category: a.category,
      pillar: a.pillar,
      title: a.title,
      detail: a.detail,
      scope: a.scope,
      subjects: a.subjects,
      revenue_at_risk_eur_cents: a.revenueAtRiskCents,
      suggested_action: a.suggestedAction,
      status: a.status,
      dedupe_key: a.id,
      created_at: a.createdAt,
    })),
  );
  await insert(
    "pillar_scores",
    mine(ds.pillarScores).map((p) => ({ workspace_id: ws, score_date: p.date, pillar: p.pillar, score: p.score, headline: p.headline })),
  );
  await supabase.from("alert_rules").upsert({ workspace_id: ws });
  await insert(
    "monthly_costs",
    Object.entries(ds.opex)
      .filter(([k]) => k.startsWith(`${source.id}:`))
      .map(([k, v]) => ({
        workspace_id: ws,
        month: `${k.split(":")[1]}-01`,
        opex_eur_cents: v,
        revenue_target_eur_cents: ds.revenueTargets[k] ?? null,
      })),
  );
  return { rows: total };
}
