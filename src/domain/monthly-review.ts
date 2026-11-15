/**
 * Revue mensuelle par pôle, reprise du suivi "Mensu | Analyse" de SDG :
 * résultats opérationnels sur 13 mois, puis 4 pôles à améliorer chaque mois
 * (acquisition, retours, logistique, frais internes) avec cible, évolution et leviers.
 * Montants en centimes d'euro HT, taux et marges en %.
 */
import { deltaPercent } from "./profit";

export type MonthlyRow = {
  month: string; // YYYY-MM
  marketplace: string;
  brand: string;
  revenueHt: number;
  commissions: number;
  ads: number;
  logistics: number;
  returns: number;
  cogs: number;
  units: number;
  orders: number;
  returnUnits: number;
};

export type PoleTargets = { tacos: number; returnRate: number; logisticsRate: number; opexRate: number };

export const DEFAULT_TARGETS: PoleTargets = { tacos: 10, returnRate: 6, logisticsRate: 12, opexRate: 1.5 };

export type MonthSummary = {
  month: string;
  label: string;
  partial: boolean;
  units: number;
  revenue: number;
  revenueDelta: number | null;
  grossMargin: number | null; // (CA - coût d'achat) / CA
  commissions: number;
  commissionRate: number | null;
  ads: number;
  tacos: number | null;
  returnUnits: number;
  returnRate: number | null; // retours / unités vendues
  returnsValue: number;
  logistics: number;
  logisticsRate: number | null;
  opex: number;
  opexRate: number | null;
  netProfit: number;
  netMargin: number | null;
};

export type PoleKey = "acquisition" | "retours" | "logistique" | "frais";
export type PoleStatus = "good" | "watch" | "critical";

export type Pole = {
  key: PoleKey;
  label: string;
  metricLabel: string;
  value: number | null;
  target: number;
  previous: number | null;
  /** évolution en points vs mois précédent */
  deltaPoints: number | null;
  amount: number;
  status: PoleStatus;
  series: number[];
  levers: string[];
};

export type BreakdownRow = {
  key: string;
  label: string;
  revenue: number;
  share: number;
  revenueDelta: number | null;
  grossMargin: number | null;
  commissionRate: number | null;
  ads: number;
  tacos: number | null;
  returnRate: number | null;
  logisticsRate: number | null;
  netMargin: number | null;
};

export type MonthlyReview = {
  selected: MonthSummary | null;
  previous: MonthSummary | null;
  months: MonthSummary[]; // du plus récent au plus ancien
  poles: Pole[];
  byMarketplace: BreakdownRow[];
  byBrand: BreakdownRow[];
};

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Dernier mois clos par rapport à aujourd'hui (YYYY-MM-DD). */
export function lastClosedMonth(today: string): string {
  return previousMonth(today.slice(0, 7));
}

type Acc = Omit<MonthlyRow, "month" | "marketplace" | "brand">;
const zero = (): Acc => ({ revenueHt: 0, commissions: 0, ads: 0, logistics: 0, returns: 0, cogs: 0, units: 0, orders: 0, returnUnits: 0 });
function add(a: Acc, r: Acc) {
  a.revenueHt += r.revenueHt;
  a.commissions += r.commissions;
  a.ads += r.ads;
  a.logistics += r.logistics;
  a.returns += r.returns;
  a.cogs += r.cogs;
  a.units += r.units;
  a.orders += r.orders;
  a.returnUnits += r.returnUnits;
}
const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : null);
const net = (a: Acc, opex = 0) => a.revenueHt - a.commissions - a.ads - a.logistics - a.returns - a.cogs - opex;

function summarize(month: string, a: Acc, opex: number, prevRevenue: number | null, partial: boolean): MonthSummary {
  const netProfit = net(a, opex);
  return {
    month,
    label: monthLabel(month),
    partial,
    units: a.units,
    revenue: a.revenueHt,
    revenueDelta: prevRevenue === null ? null : deltaPercent(a.revenueHt, prevRevenue),
    grossMargin: pct(a.revenueHt - a.cogs, a.revenueHt),
    commissions: a.commissions,
    commissionRate: pct(a.commissions, a.revenueHt),
    ads: a.ads,
    tacos: pct(a.ads, a.revenueHt),
    returnUnits: a.returnUnits,
    returnRate: pct(a.returnUnits, a.units),
    returnsValue: a.returns,
    logistics: a.logistics,
    logisticsRate: pct(a.logistics, a.revenueHt),
    opex,
    opexRate: pct(opex, a.revenueHt),
    netProfit,
    netMargin: pct(netProfit, a.revenueHt),
  };
}

/** Statut d'un taux "plus bas = mieux" : bon sous la cible, à surveiller jusqu'à +15 %, critique au-delà. */
export function poleStatus(value: number | null, target: number): PoleStatus {
  if (value === null) return "good";
  if (value <= target) return "good";
  if (value <= target * 1.15) return "watch";
  return "critical";
}

function groupBy(rows: MonthlyRow[], key: (r: MonthlyRow) => string): Map<string, Acc> {
  const m = new Map<string, Acc>();
  for (const r of rows) {
    const k = key(r);
    let a = m.get(k);
    if (!a) m.set(k, (a = zero()));
    add(a, r);
  }
  return m;
}

function breakdown(
  current: MonthlyRow[],
  previous: MonthlyRow[],
  key: (r: MonthlyRow) => string,
  label: (k: string) => string,
): BreakdownRow[] {
  const cur = groupBy(current, key);
  const prev = groupBy(previous, key);
  const total = [...cur.values()].reduce((t, a) => t + a.revenueHt, 0);
  return [...cur.entries()]
    .map(([k, a]) => ({
      key: k,
      label: label(k),
      revenue: a.revenueHt,
      share: total > 0 ? (a.revenueHt / total) * 100 : 0,
      revenueDelta: prev.has(k) ? deltaPercent(a.revenueHt, prev.get(k)!.revenueHt) : null,
      grossMargin: pct(a.revenueHt - a.cogs, a.revenueHt),
      commissionRate: pct(a.commissions, a.revenueHt),
      ads: a.ads,
      tacos: pct(a.ads, a.revenueHt),
      returnRate: pct(a.returnUnits, a.units),
      logisticsRate: pct(a.logistics, a.revenueHt),
      netMargin: pct(net(a), a.revenueHt),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

const fmt1 = (v: number) => v.toFixed(1).replace(".", ",");

export function buildMonthlyReview(input: {
  rows: MonthlyRow[];
  opex: Record<string, number>; // YYYY-MM -> centimes
  today: string;
  selectedMonth: string;
  targets: PoleTargets;
  names: Record<string, string>;
  monthsBack?: number;
}): MonthlyReview {
  const { rows, opex, today, selectedMonth, targets, names } = input;
  const currentMonth = today.slice(0, 7);
  const byMonth = groupBy(rows, (r) => r.month);

  // 13 mois glissants se terminant au mois sélectionné
  const span: string[] = [];
  for (let m = selectedMonth, i = 0; i < (input.monthsBack ?? 13); i++, m = previousMonth(m)) span.push(m);
  const months = span
    .filter((m) => byMonth.has(m))
    .map((m) => {
      const p = byMonth.get(previousMonth(m));
      return summarize(m, byMonth.get(m)!, opex[m] ?? 0, p ? p.revenueHt : null, m === currentMonth);
    });

  const selected = months.find((m) => m.month === selectedMonth) ?? null;
  const previous = months.find((m) => m.month === previousMonth(selectedMonth)) ?? null;
  const chrono = [...months].reverse();

  const curRows = rows.filter((r) => r.month === selectedMonth);
  const prevRows = rows.filter((r) => r.month === previousMonth(selectedMonth));
  const byMarketplace = breakdown(curRows, prevRows, (r) => r.marketplace, (k) => names[k] ?? k);
  const byBrand = breakdown(curRows, prevRows, (r) => r.brand || "Sans marque", (k) => k);

  const delta = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);
  const meaningful = (r: BreakdownRow) => r.share >= 2;

  // Leviers : les canaux / marques qui tirent le taux au-dessus de la cible
  const acquisitionLevers = byMarketplace
    .filter((r) => meaningful(r) && r.tacos !== null && r.tacos > targets.tacos)
    .sort((a, b) => b.ads - a.ads)
    .slice(0, 3)
    .map((r) => `${r.label} : TACoS ${fmt1(r.tacos!)} % (cible ${fmt1(targets.tacos)} %), revoir les campagnes au-dessus du seuil`);
  const returnLevers = [...byMarketplace, ...byBrand]
    .filter((r) => meaningful(r) && r.returnRate !== null && r.returnRate > targets.returnRate)
    .sort((a, b) => (b.returnRate ?? 0) - (a.returnRate ?? 0))
    .slice(0, 3)
    .map((r) => `${r.label} : ${fmt1(r.returnRate!)} % de retours, analyser les motifs (taille, qualité, fiche)`);
  const logisticsLevers = byMarketplace
    .filter((r) => meaningful(r) && r.logisticsRate !== null && r.logisticsRate > targets.logisticsRate)
    .sort((a, b) => (b.logisticsRate ?? 0) - (a.logisticsRate ?? 0))
    .slice(0, 3)
    .map((r) => `${r.label} : logistique à ${fmt1(r.logisticsRate!)} % du CA, comparer transporteurs et frais de port facturés`);

  const pole = (
    key: PoleKey,
    label: string,
    metricLabel: string,
    get: (m: MonthSummary) => number | null,
    amount: (m: MonthSummary) => number,
    target: number,
    levers: string[],
  ): Pole => {
    const value = selected ? get(selected) : null;
    const prev = previous ? get(previous) : null;
    const status = poleStatus(value, target);
    return {
      key,
      label,
      metricLabel,
      value,
      target,
      previous: prev,
      deltaPoints: delta(value, prev),
      amount: selected ? amount(selected) : 0,
      status,
      series: chrono.map((m) => get(m) ?? 0),
      levers: levers.length ? levers : status === "good" ? ["Sous la cible : maintenir le niveau actuel"] : [],
    };
  };

  return {
    selected,
    previous,
    months,
    poles: [
      pole("acquisition", "Acquisition", "TACoS", (m) => m.tacos, (m) => m.ads, targets.tacos, acquisitionLevers),
      pole("retours", "Retours", "Taux de retour", (m) => m.returnRate, (m) => m.returnsValue, targets.returnRate, returnLevers),
      pole("logistique", "Logistique", "Logistique / CA", (m) => m.logisticsRate, (m) => m.logistics, targets.logisticsRate, logisticsLevers),
      pole("frais", "Frais internes", "OpEx / CA", (m) => m.opexRate, (m) => m.opex, targets.opexRate, []),
    ],
    byMarketplace,
    byBrand,
  };
}
