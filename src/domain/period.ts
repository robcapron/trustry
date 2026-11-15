/** Périodes d'analyse : 7 jours, mois en cours, trimestre en cours, comparées à la période précédente équivalente. */

export const PERIOD_KEYS = ["7j", "mois", "trimestre"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export const PERIOD_LABEL: Record<PeriodKey, string> = { "7j": "7 jours", mois: "Mois", trimestre: "Trimestre" };

export type DateRange = { from: string; to: string };

export type Period = {
  key: PeriodKey;
  current: DateRange;
  previous: DateRange;
  /** nombre de jours de la période courante */
  days: number;
};

export function parsePeriod(value: unknown): PeriodKey {
  return PERIOD_KEYS.includes(value as PeriodKey) ? (value as PeriodKey) : "mois";
}

function toDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

export function isoAddDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000) + 1;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Construit la période à partir de la date du jour (YYYY-MM-DD, fuseau Paris). */
export function buildPeriod(key: PeriodKey, today: string): Period {
  const [y, m, d] = today.split("-").map(Number);
  if (key === "7j") {
    const from = isoAddDays(today, -6);
    return { key, current: { from, to: today }, previous: { from: isoAddDays(from, -7), to: isoAddDays(today, -7) }, days: 7 };
  }
  if (key === "mois") {
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    const prevTo = iso(py, pm, Math.min(d, daysInMonth(py, pm)));
    return { key, current: { from: iso(y, m, 1), to: today }, previous: { from: iso(py, pm, 1), to: prevTo }, days: d };
  }
  const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
  const from = iso(y, qStartMonth, 1);
  const offset = daysBetween(from, today) - 1;
  const pqMonth = qStartMonth === 1 ? 10 : qStartMonth - 3;
  const pqYear = qStartMonth === 1 ? y - 1 : y;
  const prevFrom = iso(pqYear, pqMonth, 1);
  const prevQuarterEnd = isoAddDays(from, -1);
  const prevTo = isoAddDays(prevFrom, offset) > prevQuarterEnd ? prevQuarterEnd : isoAddDays(prevFrom, offset);
  return { key, current: { from, to: today }, previous: { from: prevFrom, to: prevTo }, days: offset + 1 };
}

/** Liste des jours d'une plage. */
export function eachDay(range: DateRange): string[] {
  const out: string[] = [];
  for (let d = range.from; d <= range.to; d = isoAddDays(d, 1)) out.push(d);
  return out;
}

const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** "1-15 oct." ou "28 sept.-4 oct." */
export function formatRange(range: DateRange): string {
  const [, fm, fd] = range.from.split("-").map(Number);
  const [, tm, td] = range.to.split("-").map(Number);
  if (fm === tm) return fd === td ? `${fd} ${MONTHS_SHORT[tm - 1]}` : `${fd}-${td} ${MONTHS_SHORT[tm - 1]}`;
  return `${fd} ${MONTHS_SHORT[fm - 1]}-${td} ${MONTHS_SHORT[tm - 1]}`;
}

const MONTHS_LONG = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export function monthName(isoDate: string): string {
  return MONTHS_LONG[Number(isoDate.slice(5, 7)) - 1];
}
