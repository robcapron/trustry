import type { ProfitComponents } from "./profit";

/** Totaux agrégés (centimes d'euro HT) + volumes. */
export type MetricTotals = ProfitComponents & { units: number; orders: number };

export const ZERO_TOTALS: MetricTotals = { revenueHt: 0, commissions: 0, ads: 0, logistics: 0, returns: 0, cogs: 0, units: 0, orders: 0 };

export function addTotals(a: MetricTotals, b: MetricTotals): MetricTotals {
  return {
    revenueHt: a.revenueHt + b.revenueHt,
    commissions: a.commissions + b.commissions,
    ads: a.ads + b.ads,
    logistics: a.logistics + b.logistics,
    returns: a.returns + b.returns,
    cogs: a.cogs + b.cogs,
    units: a.units + b.units,
    orders: a.orders + b.orders,
  };
}

export function sumTotals(rows: MetricTotals[]): MetricTotals {
  return rows.reduce(addTotals, { ...ZERO_TOTALS });
}

/** Lignes renvoyées par la source de données (démo ou Supabase) pour une plage de dates. */
export type DailyRollup = MetricTotals & { date: string };
export type ChannelRollup = MetricTotals & { marketplace: string };
export type SkuStoreRollup = MetricTotals & {
  productId: string;
  sku: string;
  title: string;
  storeId: string;
  marketplace: string;
  country: string;
};

export type Rollups = {
  daily: DailyRollup[];
  channels: ChannelRollup[];
  skus: SkuStoreRollup[];
};
