import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_RULES, evaluateAlerts, type AlertRules, type DetectedAlert, type ListingInput, type StoreSalesInput } from "@/domain/alert-engine";
import { storeLabel } from "@/domain/dashboard";
import { MARKETPLACE_NAMES } from "@/domain/marketplaces";
import { isoAddDays } from "@/domain/period";
import { parisToday } from "@/lib/dates";
import { selectAll } from "@/server/supabase/admin";

/** Clés produites par le moteur : seules ces alertes se résolvent automatiquement. */
const ENGINE_KEY = /^(blocked|stock|drop|tacos|token|sync-error|sync-late):/;

type MetricRow = { metric_date: string; store_id: string; product_id: string; units: number; revenue_ht_eur_cents: number; ads_eur_cents: number };

/** Recalcule les alertes d'un espace à partir des données synchronisées, et les enregistre. */
export async function runAlertEngine(supabase: SupabaseClient, workspaceId: string, now = new Date()) {
  const today = parisToday();
  const ws = workspaceId;

  const [{ data: rulesRow }, { data: connections }, { data: stores }, products, metrics, { data: blocked }, inventory] = await Promise.all([
    supabase.from("alert_rules").select("*").eq("workspace_id", ws).maybeSingle(),
    supabase.from("connections").select("id, marketplace_code, status, last_sync_at, sync_frequency_minutes, token_expires_at, last_error").eq("workspace_id", ws),
    supabase.from("stores").select("id, country, connection_id").eq("workspace_id", ws),
    selectAll<{ id: string; sku: string; brand: string }>((a, b) => supabase.from("products").select("id, sku, brand").eq("workspace_id", ws).range(a, b)),
    selectAll<MetricRow>((a, b) =>
      supabase
        .from("daily_sku_metrics")
        .select("metric_date, store_id, product_id, units, revenue_ht_eur_cents, ads_eur_cents")
        .eq("workspace_id", ws)
        .gte("metric_date", isoAddDays(today, -28))
        .lt("metric_date", today)
        .range(a, b),
    ),
    supabase.from("listings").select("product_id, store_id, status, block_reason").eq("workspace_id", ws).eq("status", "blocked"),
    selectAll<{ product_id: string; snapshot_date: string; quantity: number }>((a, b) =>
      supabase.from("inventory_snapshots").select("product_id, snapshot_date, quantity").eq("workspace_id", ws).gte("snapshot_date", isoAddDays(today, -3)).order("snapshot_date").range(a, b),
    ),
  ]);

  const rules: AlertRules = rulesRow
    ? {
        salesDropPercent: Number(rulesRow.sales_drop_percent),
        salesDropWindowDays: Number(rulesRow.sales_drop_window_days),
        stockCoverDays: Number(rulesRow.stock_cover_days),
        tacosTargetPercent: Number(rulesRow.tacos_target_percent),
      }
    : DEFAULT_RULES;

  const marketplaceOf = new Map((connections ?? []).map((c) => [c.id as string, c.marketplace_code as string]));
  const storeInfo = new Map(
    (stores ?? []).map((s) => {
      const mp = marketplaceOf.get(s.connection_id) ?? "?";
      return [s.id as string, { key: `${mp}:${s.country}`, label: storeLabel(mp, s.country, MARKETPLACE_NAMES), marketplace: mp }];
    }),
  );
  const productById = new Map(products.map((p) => [p.id, p]));
  const w = rules.salesDropWindowDays;
  const curFrom = isoAddDays(today, -w);
  const prevFrom = isoAddDays(today, -2 * w);

  // Agrégats utiles
  const revenue28 = new Map<string, number>(); // store|product
  const units14 = new Map<string, number>(); // product
  const revenue14 = new Map<string, number>();
  const channels = new Map<string, Set<string>>();
  const sales = new Map<string, StoreSalesInput>();
  const ads = new Map<string, { ads: number; revenue: number }>();
  for (const m of metrics) {
    const rev = Number(m.revenue_ht_eur_cents);
    const sp = `${m.store_id}|${m.product_id}`;
    revenue28.set(sp, (revenue28.get(sp) ?? 0) + rev);
    if (m.metric_date >= isoAddDays(today, -14)) {
      units14.set(m.product_id, (units14.get(m.product_id) ?? 0) + Number(m.units));
      revenue14.set(m.product_id, (revenue14.get(m.product_id) ?? 0) + rev);
      if (Number(m.units) > 0) channels.set(m.product_id, (channels.get(m.product_id) ?? new Set()).add(m.store_id));
    }
    const store = storeInfo.get(m.store_id);
    const sku = productById.get(m.product_id)?.sku;
    if (!store || !sku) continue;
    if (m.metric_date >= prevFrom) {
      let s = sales.get(m.store_id);
      if (!s) sales.set(m.store_id, (s = { storeKey: store.key, storeLabel: store.label, current: {}, previous: {} }));
      const bucket = m.metric_date >= curFrom ? s.current : s.previous;
      bucket[sku] = (bucket[sku] ?? 0) + rev;
    }
    if (m.metric_date >= curFrom) {
      const a = ads.get(store.marketplace) ?? { ads: 0, revenue: 0 };
      a.ads += Number(m.ads_eur_cents);
      a.revenue += rev;
      ads.set(store.marketplace, a);
    }
  }

  const listings: ListingInput[] = (blocked ?? []).flatMap((l) => {
    const store = storeInfo.get(l.store_id);
    const p = productById.get(l.product_id);
    if (!store || !p) return [];
    return [
      {
        sku: p.sku,
        storeKey: store.key,
        storeLabel: store.label,
        brand: p.brand,
        status: "blocked" as const,
        blockReason: l.block_reason,
        dailyRevenueCents: Math.round((revenue28.get(`${l.store_id}|${l.product_id}`) ?? 0) / 28),
      },
    ];
  });

  const latestStock = new Map<string, number>();
  for (const i of inventory) latestStock.set(i.product_id, Number(i.quantity));
  const stock = [...latestStock.entries()].flatMap(([productId, quantity]) => {
    const p = productById.get(productId);
    if (!p) return [];
    return [
      {
        sku: p.sku,
        quantity,
        dailyUnits: (units14.get(productId) ?? 0) / 14,
        dailyRevenueCents: Math.round((revenue14.get(productId) ?? 0) / 14),
        channels: channels.get(productId)?.size ?? 1,
      },
    ];
  });

  const detected = evaluateAlerts({
    now: now.toISOString(),
    rules,
    listings,
    stock,
    sales: [...sales.values()],
    ads: [...ads.entries()].map(([mp, a]) => ({ marketplace: mp, label: MARKETPLACE_NAMES[mp] ?? mp, adsCents: a.ads, revenueCents: a.revenue })),
    connections: (connections ?? []).map((c) => ({
      marketplace: c.marketplace_code,
      label: MARKETPLACE_NAMES[c.marketplace_code] ?? c.marketplace_code,
      status: c.status,
      lastSyncAt: c.last_sync_at,
      syncFrequencyMinutes: c.sync_frequency_minutes,
      tokenExpiresAt: c.token_expires_at,
      lastError: c.last_error,
    })),
  });

  return persistAlerts(supabase, ws, detected, now);
}

export async function persistAlerts(supabase: SupabaseClient, ws: string, detected: DetectedAlert[], now = new Date()) {
  const { data: open } = await supabase.from("alerts").select("id, dedupe_key").eq("workspace_id", ws).neq("status", "resolved");
  const openByKey = new Map((open ?? []).map((a) => [a.dedupe_key as string, a.id as string]));
  const fields = (d: DetectedAlert) => ({
    severity: d.severity,
    category: d.category,
    pillar: d.pillar,
    title: d.title,
    detail: d.detail,
    scope: d.scope,
    subjects: d.subjects,
    revenue_at_risk_eur_cents: d.revenueAtRiskCents,
    suggested_action: d.suggestedAction,
  });
  const created = detected.filter((d) => !openByKey.has(d.dedupeKey));
  if (created.length) {
    const { error } = await supabase.from("alerts").insert(created.map((d) => ({ workspace_id: ws, dedupe_key: d.dedupeKey, ...fields(d) })));
    if (error) throw new Error(`alerts : ${error.message}`);
  }
  // Mise à jour du contenu des alertes encore ouvertes (le statut choisi par l'équipe est conservé)
  for (const d of detected.filter((x) => openByKey.has(x.dedupeKey))) {
    await supabase.from("alerts").update(fields(d)).eq("id", openByKey.get(d.dedupeKey)!);
  }
  // Résolution automatique quand la cause a disparu
  const keys = new Set(detected.map((d) => d.dedupeKey));
  const gone = [...openByKey.entries()].filter(([k]) => ENGINE_KEY.test(k) && !keys.has(k)).map(([, id]) => id);
  if (gone.length) await supabase.from("alerts").update({ status: "resolved", resolved_at: now.toISOString() }).in("id", gone);
  return { created: created.length, updated: detected.length - created.length, resolved: gone.length };
}
