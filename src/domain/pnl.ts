/**
 * P&L détaillé : arbre canal > pays > SKU. Montants en centimes d'euro HT, marges en %.
 */
import { addTotals, ZERO_TOTALS, type MetricTotals, type SkuStoreRollup } from "./metrics";
import { deltaPercent, netMarginPercent, netProfit, tacosPercent } from "./profit";

export type PnlFilters = { canal?: string; pays?: string; marque?: string; q?: string };

export type PnlNode = {
  key: string;
  level: "channel" | "country" | "sku";
  label: string;
  sublabel?: string;
  totals: MetricTotals;
  previousRevenue: number;
  children: PnlNode[];
};

export type PnlMetrics = {
  revenue: number;
  delta: number | null;
  commissions: number;
  ads: number;
  logistics: number;
  returns: number;
  cogs: number;
  profit: number;
  margin: number | null;
  tacos: number | null;
};

export type PnlView = {
  rows: PnlNode[];
  total: PnlNode;
  options: { channels: { value: string; label: string }[]; countries: string[]; brands: string[] };
  skuCount: number;
};

export function pnlMetrics(node: Pick<PnlNode, "totals" | "previousRevenue">): PnlMetrics {
  const t = node.totals;
  return {
    revenue: t.revenueHt,
    delta: deltaPercent(t.revenueHt, node.previousRevenue),
    commissions: t.commissions,
    ads: t.ads,
    logistics: t.logistics,
    returns: t.returns,
    cogs: t.cogs,
    profit: netProfit(t),
    margin: netMarginPercent(t),
    tacos: tacosPercent(t.ads, t.revenueHt),
  };
}

function matches(s: SkuStoreRollup, f: PnlFilters): boolean {
  if (f.canal && s.marketplace !== f.canal) return false;
  if (f.pays && s.country !== f.pays) return false;
  if (f.marque && s.brand !== f.marque) return false;
  if (f.q) {
    const q = f.q.trim().toLowerCase();
    if (q && !s.sku.toLowerCase().includes(q) && !s.title.toLowerCase().includes(q)) return false;
  }
  return true;
}

const byRevenue = (a: PnlNode, b: PnlNode) => b.totals.revenueHt - a.totals.revenueHt;

export function buildPnl(input: {
  current: SkuStoreRollup[];
  previous: SkuStoreRollup[];
  names: Record<string, string>;
  filters: PnlFilters;
}): PnlView {
  const { names, filters } = input;
  const all = [...input.current, ...input.previous];
  const options = {
    channels: [...new Set(all.map((s) => s.marketplace))]
      .map((value) => ({ value, label: names[value] ?? value }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr")),
    countries: [...new Set(all.map((s) => s.country))].sort(),
    brands: [...new Set(all.map((s) => s.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
  };

  const prevByKey = new Map<string, number>();
  for (const s of input.previous.filter((x) => matches(x, filters))) {
    const k = `${s.storeId}:${s.productId}`;
    prevByKey.set(k, (prevByKey.get(k) ?? 0) + s.revenueHt);
  }

  const channels = new Map<string, PnlNode>();
  const seen = new Set<string>();
  const add = (s: SkuStoreRollup, totals: MetricTotals, prevRevenue: number) => {
    let ch = channels.get(s.marketplace);
    if (!ch) {
      ch = { key: s.marketplace, level: "channel", label: names[s.marketplace] ?? s.marketplace, totals: { ...ZERO_TOTALS }, previousRevenue: 0, children: [] };
      channels.set(s.marketplace, ch);
    }
    let co = ch.children.find((c) => c.key === `${s.marketplace}:${s.country}`);
    if (!co) {
      co = { key: `${s.marketplace}:${s.country}`, level: "country", label: s.country, totals: { ...ZERO_TOTALS }, previousRevenue: 0, children: [] };
      ch.children.push(co);
    }
    co.children.push({
      key: `${s.storeId}:${s.productId}`,
      level: "sku",
      label: s.title,
      sublabel: s.sku,
      totals,
      previousRevenue: prevRevenue,
      children: [],
    });
    for (const n of [ch, co]) {
      n.totals = addTotals(n.totals, totals);
      n.previousRevenue += prevRevenue;
    }
  };

  for (const s of input.current.filter((x) => matches(x, filters))) {
    const k = `${s.storeId}:${s.productId}`;
    seen.add(k);
    add(s, s, prevByKey.get(k) ?? 0);
  }
  // SKU sans vente sur la période mais vendus avant : on les garde (CA 0, évolution -100 %)
  for (const s of input.previous.filter((x) => matches(x, filters))) {
    const k = `${s.storeId}:${s.productId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    add(s, { ...ZERO_TOTALS }, prevByKey.get(k) ?? 0);
  }

  const rows = [...channels.values()].sort(byRevenue);
  for (const ch of rows) {
    ch.children.sort(byRevenue);
    for (const co of ch.children) co.children.sort(byRevenue);
  }
  const total: PnlNode = {
    key: "total",
    level: "channel",
    label: "Total",
    totals: rows.reduce((t, r) => addTotals(t, r.totals), { ...ZERO_TOTALS }),
    previousRevenue: rows.reduce((t, r) => t + r.previousRevenue, 0),
    children: [],
  };
  return { rows, total, options, skuCount: seen.size };
}

/** Lignes à plat pour l'export CSV (une ligne par SKU et boutique). */
export function flattenPnl(view: PnlView): { channel: string; country: string; node: PnlNode }[] {
  return view.rows.flatMap((ch) => ch.children.flatMap((co) => co.children.map((node) => ({ channel: ch.label, country: co.label, node }))));
}
