/**
 * Prévision d'atterrissage fin de mois ou fin de trimestre (pur, testé).
 *
 * Réalisé = jours clos du mois (le jour en cours, partiel, est projeté).
 * Deux méthodes pour les jours restants :
 *  - rythme : moyenne journalière des 14 derniers jours clos ;
 *  - saisonnalisé : ce même rythme corrigé par le profil de l'an dernier
 *    (jours alignés sur 364 jours pour garder les jours de semaine et le Black Friday).
 * La projection centrale est la méthode saisonnalisée quand l'historique N-1 existe.
 * Marge nette et TACoS projetés au niveau observé depuis le début du mois.
 */
import { sumTotals, type DailyRollup, type MetricTotals } from "./metrics";
import { deltaPercent, netMarginPercent, tacosPercent } from "./profit";
import { eachDay, isoAddDays } from "./period";

export const RECENT_DAYS = 14;
export const YEAR_SHIFT_DAYS = 364;

export type Confidence = "faible" | "moyenne" | "bonne";

export type ForecastScope = "mois" | "trimestre";

export type Forecast = {
  scope: ForecastScope;
  month: string; // YYYY-MM du jour
  start: string;
  /** dernier jour de la période projetée (fin de mois ou de trimestre) */
  monthEnd: string;
  daysInMonth: number;
  closedDays: number;
  remainingDays: number;
  /** réalisé depuis le début de la période, jour en cours inclus (comme le Dashboard) */
  realized: MetricTotals;
  realizedClosedRevenue: number;
  landing: number;
  low: number;
  high: number;
  method: "saisonnalise" | "rythme";
  runRateDaily: number;
  /** atterrissage si le rythme des 14 derniers jours se maintient, sans effet saisonnier */
  runRateLanding: number;
  /** atterrissage corrigé du profil N-1 (null sans historique) */
  seasonalLanding: number | null;
  netProfit: number;
  netMargin: number | null;
  tacos: number | null;
  previousMonth: number | null;
  deltaVsPreviousMonth: number | null;
  lastYear: number | null;
  deltaVsLastYear: number | null;
  target: number | null;
  /** atterrissage / objectif, en % (trimestre : somme des objectifs mensuels) */
  targetProgress: number | null;
  /** CA journalier nécessaire sur les jours restants pour atteindre l'objectif */
  requiredDaily: number | null;
  confidence: Confidence;
};

export type ForecastInput = {
  today: string;
  scope?: ForecastScope;
  /** jours de la période en cours, du premier jour à aujourd'hui inclus */
  monthToDate: DailyRollup[];
  /** au moins les 14 jours clos précédant aujourd'hui */
  recent: DailyRollup[];
  /** jours de l'an dernier couvrant [aujourd'hui - 14 - 364 ; fin de mois - 364] (peut être vide) */
  lastYearDaily: DailyRollup[];
  previousMonthRevenue: number | null;
  lastYearMonthRevenue: number | null;
  target: number | null;
};

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function monthEnd(today: string): string {
  const [y, m] = today.split("-").map(Number);
  return `${today.slice(0, 7)}-${pad(lastDay(y, m))}`;
}

/** Premier et dernier jour de la période (mois ou trimestre civil) contenant `today`. */
export function periodBounds(today: string, scope: ForecastScope): { start: string; end: string } {
  const [y, m] = today.split("-").map(Number);
  if (scope === "mois") return { start: `${today.slice(0, 7)}-01`, end: monthEnd(today) };
  const q = Math.floor((m - 1) / 3) * 3 + 1;
  return { start: `${y}-${pad(q)}-01`, end: `${y}-${pad(q + 2)}-${pad(lastDay(y, q + 2))}` };
}

/** Mois (YYYY-MM) couverts par la période, pour additionner les objectifs mensuels. */
export function periodMonths(today: string, scope: ForecastScope): string[] {
  const { start } = periodBounds(today, scope);
  const [y, m] = start.split("-").map(Number);
  return Array.from({ length: scope === "mois" ? 1 : 3 }, (_, i) => `${y}-${pad(m + i)}`);
}

export function buildForecast(input: ForecastInput): Forecast {
  const { today } = input;
  const scope = input.scope ?? "mois";
  const { start, end } = periodBounds(today, scope);
  const daysInMonth = eachDay({ from: start, to: end }).length;
  const closedDays = eachDay({ from: start, to: today }).length - 1;
  const remaining = eachDay({ from: today, to: end });

  const realized = sumTotals(input.monthToDate);
  const realizedClosedRevenue = input.monthToDate.filter((d) => d.date < today).reduce((t, d) => t + d.revenueHt, 0);

  // Rythme récent (jours clos uniquement)
  const recentFrom = isoAddDays(today, -RECENT_DAYS);
  const recentByDate = new Map(input.recent.map((d) => [d.date, d.revenueHt]));
  const recentDays = eachDay({ from: recentFrom, to: isoAddDays(today, -1) });
  const recentTotal = recentDays.reduce((t, d) => t + (recentByDate.get(d) ?? 0), 0);
  const runRateDaily = recentTotal / RECENT_DAYS;
  const runRateLanding = realizedClosedRevenue + runRateDaily * remaining.length;

  // Correction saisonnière par le profil N-1
  const ly = new Map(input.lastYearDaily.map((d) => [d.date, d.revenueHt]));
  const lyRecent = recentDays.reduce((t, d) => t + (ly.get(isoAddDays(d, -YEAR_SHIFT_DAYS)) ?? 0), 0);
  const lyRemaining = remaining.map((d) => ly.get(isoAddDays(d, -YEAR_SHIFT_DAYS)));
  const hasSeason = lyRecent > 0 && lyRemaining.every((v) => v !== undefined);
  const seasonalLanding = hasSeason
    ? realizedClosedRevenue + lyRemaining.reduce<number>((t, v) => t + (v ?? 0), 0) * (recentTotal / lyRecent)
    : null;

  const landing = Math.round(seasonalLanding ?? runRateLanding);
  // Fourchette : la moitié de l'écart entre les deux méthodes, bornée entre 5 % et 12 % de l'atterrissage
  const halfGap = Math.abs((seasonalLanding ?? runRateLanding) - runRateLanding) / 2;
  const spread = Math.min(Math.max(halfGap, landing * 0.05), landing * 0.12);
  const low = Math.round(Math.max(realized.revenueHt, landing - spread));
  const high = Math.round(landing + spread);

  const margin = netMarginPercent(realized);
  const projectedProfit = margin === null ? 0 : Math.round((landing * margin) / 100);
  const target = input.target && input.target > 0 ? input.target : null;

  return {
    scope,
    month: today.slice(0, 7),
    start,
    monthEnd: end,
    daysInMonth,
    closedDays,
    remainingDays: remaining.length,
    realized,
    realizedClosedRevenue,
    landing,
    low,
    high,
    method: seasonalLanding === null ? "rythme" : "saisonnalise",
    runRateDaily: Math.round(runRateDaily),
    runRateLanding: Math.round(runRateLanding),
    seasonalLanding: seasonalLanding === null ? null : Math.round(seasonalLanding),
    netProfit: projectedProfit,
    netMargin: margin,
    tacos: tacosPercent(realized.ads, realized.revenueHt),
    previousMonth: input.previousMonthRevenue,
    deltaVsPreviousMonth: input.previousMonthRevenue ? deltaPercent(landing, input.previousMonthRevenue) : null,
    lastYear: input.lastYearMonthRevenue,
    deltaVsLastYear: input.lastYearMonthRevenue ? deltaPercent(landing, input.lastYearMonthRevenue) : null,
    target,
    targetProgress: target ? (landing / target) * 100 : null,
    requiredDaily: target && remaining.length ? Math.max(0, Math.round((target - realizedClosedRevenue) / remaining.length)) : null,
    confidence: closedDays >= 14 ? "bonne" : closedDays >= 7 ? "moyenne" : "faible",
  };
}

/** Bornes de dates nécessaires au calcul, pour la couche données. */
export function forecastRanges(today: string, scope: ForecastScope = "mois") {
  const { start, end } = periodBounds(today, scope);
  const [y, m] = start.split("-").map(Number);
  const span = scope === "mois" ? 1 : 3;
  // Période précédente complète (mois ou trimestre)
  const pm = m - span < 1 ? m - span + 12 : m - span;
  const py = m - span < 1 ? y - 1 : y;
  const prevEndMonth = pm + span - 1;
  return {
    monthToDate: { from: start, to: today },
    recent: { from: isoAddDays(today, -RECENT_DAYS), to: isoAddDays(today, -1) },
    lastYear: { from: isoAddDays(today, -RECENT_DAYS - YEAR_SHIFT_DAYS), to: isoAddDays(end, -YEAR_SHIFT_DAYS) },
    previousMonth: { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(prevEndMonth)}-${pad(lastDay(py, prevEndMonth))}` },
    lastYearMonth: { from: `${y - 1}${start.slice(4)}`, to: `${y - 1}${end.slice(4, 8)}${pad(lastDay(y - 1, Number(end.slice(5, 7))))}` },
  };
}
