/**
 * Prévision d'atterrissage fin de mois (pur, testé).
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

export type Forecast = {
  month: string; // YYYY-MM
  monthEnd: string;
  daysInMonth: number;
  closedDays: number;
  remainingDays: number;
  /** réalisé depuis le 1er, jour en cours inclus (comme le Dashboard) */
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
  /** atterrissage / objectif, en % */
  targetProgress: number | null;
  /** CA journalier nécessaire sur les jours restants pour atteindre l'objectif */
  requiredDaily: number | null;
  confidence: Confidence;
};

export type ForecastInput = {
  today: string;
  /** jours du mois en cours, du 1er à aujourd'hui inclus */
  monthToDate: DailyRollup[];
  /** au moins les 14 jours clos précédant aujourd'hui */
  recent: DailyRollup[];
  /** jours de l'an dernier couvrant [aujourd'hui - 14 - 364 ; fin de mois - 364] (peut être vide) */
  lastYearDaily: DailyRollup[];
  previousMonthRevenue: number | null;
  lastYearMonthRevenue: number | null;
  target: number | null;
};

export function monthEnd(today: string): string {
  const [y, m] = today.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${today.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

export function buildForecast(input: ForecastInput): Forecast {
  const { today } = input;
  const end = monthEnd(today);
  const daysInMonth = Number(end.slice(8, 10));
  const closedDays = Number(today.slice(8, 10)) - 1;
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
    month: today.slice(0, 7),
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
export function forecastRanges(today: string) {
  const end = monthEnd(today);
  const [y, m] = today.split("-").map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  const prevMonthEnd = `${py}-${String(pm).padStart(2, "0")}-${String(new Date(Date.UTC(py, pm, 0)).getUTCDate()).padStart(2, "0")}`;
  const lyMonthStart = `${y - 1}-${today.slice(5, 7)}-01`;
  const lyMonthEnd = `${y - 1}-${end.slice(5, 7)}-${String(new Date(Date.UTC(y - 1, m, 0)).getUTCDate()).padStart(2, "0")}`;
  return {
    monthToDate: { from: `${today.slice(0, 7)}-01`, to: today },
    recent: { from: isoAddDays(today, -RECENT_DAYS), to: isoAddDays(today, -1) },
    lastYear: { from: isoAddDays(today, -RECENT_DAYS - YEAR_SHIFT_DAYS), to: isoAddDays(end, -YEAR_SHIFT_DAYS) },
    previousMonth: { from: `${py}-${String(pm).padStart(2, "0")}-01`, to: prevMonthEnd },
    lastYearMonth: { from: lyMonthStart, to: lyMonthEnd },
  };
}

