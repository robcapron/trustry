/**
 * Taux de change BCE (pur, testé). Le flux quotidien de la BCE donne "1 EUR = x devise" ;
 * Trustry stocke la valeur d'une unité de devise en EUR (eur_per_unit = 1 / x).
 */
import { CURRENCIES, type Currency } from "./money";

export const ECB_DAILY_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

export type FxDay = { date: string; rates: Partial<Record<Currency, number>> };

export function parseEcbDaily(xml: string): FxDay {
  const date = /time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1];
  if (!date) throw new Error("Flux BCE illisible : date absente");
  const rates: Partial<Record<Currency, number>> = {};
  for (const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) {
    const cur = m[1] as Currency;
    const perEur = Number(m[2]);
    if (CURRENCIES.includes(cur) && perEur > 0) rates[cur] = Math.round((1 / perEur) * 1e8) / 1e8;
  }
  return { date, rates };
}

/**
 * Taux applicable à une date : celui du jour, sinon le dernier publié avant
 * (week-ends et jours fériés BCE). Les taux doivent être triés par date croissante.
 */
export function rateAt(history: { date: string; eurPerUnit: number }[], date: string): number | null {
  let found: number | null = null;
  for (const r of history) {
    if (r.date > date) break;
    found = r.eurPerUnit;
  }
  return found ?? history[0]?.eurPerUnit ?? null;
}
