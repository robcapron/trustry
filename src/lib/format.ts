/**
 * Formatage FR de toute l'interface : 1 234,56 €, 21,4 %, -0,6 pt.
 *
 * Règles non négociables (voir CLAUDE.md) :
 * - montants en € HT, marges en %, jamais de marge en €
 * - aucun tiret long, demi-cadratin ou signe moins typographique : toujours "-"
 */

const NBSP = String.fromCharCode(0xa0);

/** Tirets longs, demi-cadratins, signes moins typographiques (codes Unicode, jamais en clair dans le source). */
const LONG_DASHES = new RegExp(
  `[${[0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2212, 0xfe58, 0xfe63, 0xff0d].map((c) => String.fromCharCode(c)).join("")}]`,
  "g",
);
const NARROW_SPACES = new RegExp(`[${String.fromCharCode(0x202f, 0x2009)}]`, "g");

/** Remplace tous les tirets longs, demi-cadratins et signes moins par un tiret court. */
export function sanitizeDashes(input: string): string {
  return input.replace(LONG_DASHES, "-");
}

/** Normalise la sortie Intl : espaces fines insécables -> insécables, tirets -> tiret court. */
function clean(input: string): string {
  return sanitizeDashes(input.replace(NARROW_SPACES, NBSP));
}

const intCache = new Map<string, Intl.NumberFormat>();
function nf(minFrac: number, maxFrac: number): Intl.NumberFormat {
  const key = `${minFrac}-${maxFrac}`;
  let f = intCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: minFrac, maximumFractionDigits: maxFrac });
    intCache.set(key, f);
  }
  return f;
}

/** Nombre entier ou décimal au format FR : 2 846 / 50,03 */
export function formatNumber(value: number, decimals = 0): string {
  return clean(nf(decimals, decimals).format(normalizeZero(value)));
}

/** Montant en euros à partir de centimes : 14238000 -> "142 380 €" */
export function formatEur(cents: number, decimals: 0 | 2 = 0): string {
  return `${formatNumber(cents / 100, decimals)}${NBSP}€`;
}

/** Montant compact pour les axes de graphiques : 12000 € -> "12 k€" */
export function formatEurCompact(euros: number): string {
  if (Math.abs(euros) >= 1_000_000) return `${formatNumber(euros / 1_000_000, 1)}${NBSP}M€`;
  if (Math.abs(euros) >= 1_000) return `${formatNumber(euros / 1_000, 0)}${NBSP}k€`;
  return formatNumber(euros, 0);
}

/** Pourcentage (valeur déjà en %) : 21.4 -> "21,4 %" */
export function formatPercent(percent: number, decimals = 1): string {
  return `${formatNumber(percent, decimals)}${NBSP}%`;
}

/** Évolution signée en % : 12.4 -> "+12,4 %", -21.3 -> "-21,3 %" */
export function formatDeltaPercent(percent: number, decimals = 1): string {
  return `${signed(percent, decimals)}${NBSP}%`;
}

/** Évolution signée en points de % : -0.6 -> "-0,6 pt" */
export function formatDeltaPoints(points: number, decimals = 1): string {
  return `${signed(points, decimals)}${NBSP}pt`;
}

function signed(value: number, decimals: number): string {
  const rounded = roundTo(value, decimals);
  const body = formatNumber(Math.abs(rounded), decimals);
  if (rounded > 0) return `+${body}`;
  if (rounded < 0) return `-${body}`;
  return body;
}

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return normalizeZero(Math.round(value * f) / f);
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

const longDate = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });

/** "Dimanche 15 novembre" */
export function formatLongDate(date: Date): string {
  const s = clean(longDate.format(date));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "3 nov." */
export function formatShortDate(date: Date): string {
  return clean(shortDate.format(date));
}

/** "il y a 4 min", "il y a 1 h", "il y a 2 j" (format des maquettes) */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes}${NBSP}min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours}${NBSP}h`;
  const days = Math.round(hours / 24);
  return `il y a ${days}${NBSP}j`;
}

/** Initiales d'un espace pour l'avatar : "SDG Distribution" -> "SD" */
export function initials(name: string): string {
  const letters = name.replace(/[^\p{L}\p{N} ]/gu, "").trim();
  const words = letters.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const isAcronym = /^\p{Lu}{2,}$/u.test(words[0]);
  if (words.length === 1 || isAcronym) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
