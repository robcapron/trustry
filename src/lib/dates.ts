import { formatLongDate } from "./format";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

/** "Dimanche 15 novembre - Novembre à J15/30" (en-tête du Dashboard). */
export function dashboardEyebrow(now: Date = new Date()): string {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
  const [y, m, d] = iso.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${formatLongDate(now)} - ${MONTHS[m - 1]} à J${d}/${daysInMonth}`;
}
