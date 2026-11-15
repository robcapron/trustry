/**
 * Construction du Dashboard global à partir des agrégats (pur, testé).
 * Montants en centimes d'euro HT, marges en %.
 */
import { compareAlerts, type AlertCategory, type Severity } from "./alerts";
import { addTotals, sumTotals, ZERO_TOTALS, type MetricTotals, type Rollups, type SkuStoreRollup } from "./metrics";
import { deltaPercent, netMarginPercent, netProfit } from "./profit";
import { eachDay, formatRange, type Period } from "./period";
import { healthFromScore, PILLARS, type HealthStatus } from "./pillars";

export type DashboardAlert = {
  id: string;
  severity: Severity;
  category: AlertCategory;
  pillar: number | null;
  title: string;
  detail: string;
  scope: "sku" | "account";
  subjects: string[];
  revenueAtRiskCents: number;
  suggestedAction: string | null;
  status: "todo" | "in_progress" | "resolved";
  createdAt: string;
};

export type DashboardInput = {
  period: Period;
  today: string;
  current: Rollups;
  previous: Rollups;
  alerts: DashboardAlert[];
  pillarScores: { pillar: number; score: number; headline: string }[];
  /** clés `${storeId}:${productId}` des fiches bloquées */
  blockedListings: Set<string>;
  marketplaceNames: Record<string, string>;
};

export type Kpi = { value: number | null; delta: number | null; spark: number[] };

export type DailyBar = { date: string; day: number; current: number; previous: number | null; isToday: boolean };

export type ChannelRow = {
  key: string;
  name: string;
  revenue: number;
  /** part relative au premier canal (0..1), pour la barre */
  share: number;
  margin: number | null;
  delta: number | null;
};

export type SkuCause = { label: string; tone: "critique" | "important" | "neutre" };

export type SkuRow = {
  key: string;
  sku: string;
  title: string;
  storeLabel: string;
  revenue: number;
  delta: number | null;
  margin: number | null;
  cause?: SkuCause;
};

export type PillarRow = { number: number; label: string; headline: string; score: number; health: HealthStatus };

export type DashboardView = {
  compareLabel: string;
  hasData: boolean;
  profit: Kpi;
  revenue: Kpi;
  /** marge nette en %, delta en points */
  margin: Kpi;
  orders: Kpi & { basketCents: number | null };
  daily: DailyBar[];
  channels: ChannelRow[];
  alerts: { top: DashboardAlert[]; total: number; critical: number; important: number; info: number };
  pillars: { rows: PillarRow[]; global: number | null };
  topSkus: SkuRow[];
  flopSkus: SkuRow[];
};

const MAX_CHANNEL_ROWS = 8;
const FLOP_MIN_PREVIOUS_CENTS = 50_000; // 500 € HT sur la période précédente
const FLOP_MIN_PREVIOUS_UNITS = 8;

export function storeLabel(marketplace: string, country: string, names: Record<string, string>): string {
  if (marketplace.startsWith("amazon")) return `Amazon ${country}`;
  return names[marketplace] ?? marketplace;
}

function pointsDelta(cur: MetricTotals, prev: MetricTotals): number | null {
  const a = netMarginPercent(cur);
  const b = netMarginPercent(prev);
  return a === null || b === null ? null : a - b;
}

export function buildDashboard(input: DashboardInput): DashboardView {
  const { period, today, current, previous, marketplaceNames: names } = input;
  const cur = sumTotals(current.daily);
  const prev = sumTotals(previous.daily);

  // Séries quotidiennes alignées jour à jour
  const curDays = eachDay(period.current);
  const prevDays = eachDay(period.previous);
  const curByDate = new Map(current.daily.map((d) => [d.date, d]));
  const prevByDate = new Map(previous.daily.map((d) => [d.date, d]));
  const series = curDays.map((d) => curByDate.get(d) ?? { ...ZERO_TOTALS, date: d });

  const daily: DailyBar[] = curDays.map((d, i) => ({
    date: d,
    day: Number(d.slice(8, 10)),
    current: curByDate.get(d)?.revenueHt ?? 0,
    previous: i < prevDays.length ? (prevByDate.get(prevDays[i])?.revenueHt ?? 0) : null,
    isToday: d === today,
  }));

  // Canaux : les 8 premiers, puis "Autres"
  const prevChannels = new Map(previous.channels.map((c) => [c.marketplace, c]));
  const sortedChannels = [...current.channels].sort((a, b) => b.revenueHt - a.revenueHt);
  const head = sortedChannels.length > MAX_CHANNEL_ROWS + 1 ? sortedChannels.slice(0, MAX_CHANNEL_ROWS) : sortedChannels;
  const tail = sortedChannels.slice(head.length);
  const rows: { key: string; name: string; cur: MetricTotals; prev: MetricTotals }[] = head.map((c) => ({
    key: c.marketplace,
    name: names[c.marketplace] ?? c.marketplace,
    cur: c,
    prev: prevChannels.get(c.marketplace) ?? ZERO_TOTALS,
  }));
  if (tail.length) {
    rows.push({
      key: "autres",
      name: "Autres",
      cur: sumTotals(tail),
      prev: sumTotals(tail.map((c) => prevChannels.get(c.marketplace) ?? ZERO_TOTALS)),
    });
  }
  const maxRevenue = Math.max(1, ...rows.map((r) => r.cur.revenueHt));
  const channels: ChannelRow[] = rows.map((r) => ({
    key: r.key,
    name: r.name,
    revenue: r.cur.revenueHt,
    share: r.cur.revenueHt / maxRevenue,
    margin: netMarginPercent(r.cur),
    delta: deltaPercent(r.cur.revenueHt, r.prev.revenueHt),
  }));

  // SKU par boutique
  const prevSku = new Map(previous.skus.map((s) => [`${s.storeId}:${s.productId}`, s]));
  const skuRows = mergeSkus(current.skus).map((s) => {
    const key = `${s.storeId}:${s.productId}`;
    const p = prevSku.get(key);
    return { s, key, prevRevenue: p?.revenueHt ?? 0, prevUnits: p?.units ?? 0 };
  });
  // Les SKU qui n'ont plus aucune vente (bloqués, en rupture) doivent pouvoir apparaître en flop
  for (const p of previous.skus) {
    const key = `${p.storeId}:${p.productId}`;
    if (!skuRows.some((r) => r.key === key)) skuRows.push({ s: { ...p, ...ZERO_TOTALS }, key, prevRevenue: p.revenueHt, prevUnits: p.units });
  }

  const toRow = (r: (typeof skuRows)[number]): SkuRow => ({
    key: r.key,
    sku: r.s.sku,
    title: r.s.title,
    storeLabel: storeLabel(r.s.marketplace, r.s.country, names),
    revenue: r.s.revenueHt,
    delta: deltaPercent(r.s.revenueHt, r.prevRevenue),
    margin: netMarginPercent(r.s),
  });

  const topSkus = [...skuRows]
    .filter((r) => r.s.revenueHt > 0)
    .sort((a, b) => b.s.revenueHt - a.s.revenueHt)
    .slice(0, 5)
    .map(toRow);

  const openAlerts = input.alerts.filter((a) => a.status !== "resolved");
  const stockoutSkus = new Set(openAlerts.filter((a) => a.category === "stockout").flatMap((a) => a.subjects));
  const accountAlerts = openAlerts.filter((a) => a.scope === "account");

  const flopSkus = skuRows
    .filter((r) => r.prevRevenue >= FLOP_MIN_PREVIOUS_CENTS && r.prevUnits >= FLOP_MIN_PREVIOUS_UNITS && r.s.revenueHt < r.prevRevenue)
    .map((r) => ({ r, delta: deltaPercent(r.s.revenueHt, r.prevRevenue) ?? 0 }))
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 5)
    .map(({ r }) => ({ ...toRow(r), cause: causeFor(r.s, r.key, input.blockedListings, stockoutSkus, accountAlerts, names) }));

  // Alertes : référence bloquée en tête (compareAlerts)
  const sorted = [...openAlerts].sort((a, b) =>
    compareAlerts(
      { ...a, createdAt: new Date(a.createdAt) },
      { ...b, createdAt: new Date(b.createdAt) },
    ),
  );

  // Piliers
  const scoreByPillar = new Map(input.pillarScores.map((p) => [p.pillar, p]));
  const pillarRows: PillarRow[] = PILLARS.flatMap((p) => {
    const s = scoreByPillar.get(p.number);
    return s ? [{ number: p.number, label: p.cardLabel, headline: s.headline, score: s.score, health: healthFromScore(s.score) }] : [];
  });
  const global = pillarRows.length ? Math.round(pillarRows.reduce((t, r) => t + r.score, 0) / pillarRows.length) : null;

  return {
    compareLabel: `vs ${formatRange(period.previous)}`,
    hasData: cur.revenueHt > 0 || prev.revenueHt > 0,
    profit: {
      value: netProfit(cur),
      delta: deltaPercent(netProfit(cur), netProfit(prev)),
      spark: series.map((d) => netProfit(d)),
    },
    revenue: { value: cur.revenueHt, delta: deltaPercent(cur.revenueHt, prev.revenueHt), spark: series.map((d) => d.revenueHt) },
    margin: {
      value: netMarginPercent(cur),
      delta: pointsDelta(cur, prev),
      spark: series.map((d) => netMarginPercent(d) ?? 0),
    },
    orders: {
      value: cur.orders,
      delta: deltaPercent(cur.orders, prev.orders),
      spark: series.map((d) => d.orders),
      basketCents: cur.orders > 0 ? Math.round(cur.revenueHt / cur.orders) : null,
    },
    daily,
    channels,
    alerts: {
      top: sorted.slice(0, 5),
      total: openAlerts.length,
      critical: openAlerts.filter((a) => a.severity === "critical").length,
      important: openAlerts.filter((a) => a.severity === "important").length,
      info: openAlerts.filter((a) => a.severity === "info").length,
    },
    pillars: { rows: pillarRows, global },
    topSkus,
    flopSkus,
  };
}

function mergeSkus(rows: SkuStoreRollup[]): SkuStoreRollup[] {
  const map = new Map<string, SkuStoreRollup>();
  for (const r of rows) {
    const key = `${r.storeId}:${r.productId}`;
    const existing = map.get(key);
    map.set(key, existing ? { ...existing, ...addTotals(existing, r) } : r);
  }
  return [...map.values()];
}

function causeFor(
  s: SkuStoreRollup,
  key: string,
  blocked: Set<string>,
  stockout: Set<string>,
  accountAlerts: DashboardAlert[],
  names: Record<string, string>,
): SkuCause {
  const name = names[s.marketplace] ?? s.marketplace;
  if (blocked.has(key)) return { label: `Bloqué ${s.marketplace.startsWith("amazon") ? "Amazon" : name}`, tone: "critique" };
  if (stockout.has(s.sku)) return { label: "Rupture", tone: "critique" };
  const account = accountAlerts.find((a) => a.subjects.some((x) => x.includes(name) && x.includes(s.country)));
  if (account) return { label: `Compte ${name}`, tone: "important" };
  return { label: "À analyser", tone: "neutre" };
}
