import { ZERO_TOTALS, type MetricTotals, type Rollups } from "@/domain/metrics";
import type { DateRange } from "@/domain/period";
import type { DailyMetric, Product, Store } from "../types";

function toTotals(m: DailyMetric): MetricTotals {
  return {
    revenueHt: m.revenueHt,
    commissions: m.commissions,
    ads: m.ads,
    logistics: m.logistics,
    returns: m.returns,
    cogs: m.cogs,
    units: m.units,
    orders: m.orders,
  };
}

function add(target: MetricTotals, m: MetricTotals) {
  target.revenueHt += m.revenueHt;
  target.commissions += m.commissions;
  target.ads += m.ads;
  target.logistics += m.logistics;
  target.returns += m.returns;
  target.cogs += m.cogs;
  target.units += m.units;
  target.orders += m.orders;
}

/** Agrège en mémoire (mode démo) : par jour, par canal, par SKU et boutique. Même forme que les fonctions SQL. */
export function rollupInMemory(metrics: DailyMetric[], stores: Store[], products: Product[], range: DateRange): Rollups {
  const storeById = new Map(stores.map((s) => [s.id, s]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const daily = new Map<string, MetricTotals & { date: string }>();
  const channels = new Map<string, MetricTotals & { marketplace: string }>();
  const skus = new Map<string, Rollups["skus"][number]>();

  for (const m of metrics) {
    if (m.date < range.from || m.date > range.to) continue;
    const t = toTotals(m);
    const store = storeById.get(m.storeId);
    const product = productById.get(m.productId);
    if (!store || !product) continue;

    let d = daily.get(m.date);
    if (!d) daily.set(m.date, (d = { ...ZERO_TOTALS, date: m.date }));
    add(d, t);

    let c = channels.get(store.marketplace);
    if (!c) channels.set(store.marketplace, (c = { ...ZERO_TOTALS, marketplace: store.marketplace }));
    add(c, t);

    const key = `${store.id}:${product.id}`;
    let s = skus.get(key);
    if (!s) {
      skus.set(
        key,
        (s = {
          ...ZERO_TOTALS,
          productId: product.id,
          sku: product.sku,
          title: product.title,
          storeId: store.id,
          marketplace: store.marketplace,
          country: store.country,
        }),
      );
    }
    add(s, t);
  }

  return {
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    channels: [...channels.values()],
    skus: [...skus.values()],
  };
}
