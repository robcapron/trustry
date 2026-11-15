/** Devises gérées. Les totaux sont toujours convertis en EUR. */
export const CURRENCIES = ["EUR", "CHF", "GBP", "PLN", "SEK", "USD", "JPY", "AUD", "CZK"] as const;
export type Currency = (typeof CURRENCIES)[number];

/**
 * Convertit un montant (centimes de la devise d'origine) en centimes d'euro.
 * `eurPerUnit` = valeur d'une unité de devise en EUR (taux BCE inversé), au jour de la commande.
 */
export function toEurCents(amountCents: number, currency: Currency, eurPerUnit: number): number {
  if (currency === "EUR") return amountCents;
  if (!(eurPerUnit > 0)) throw new Error(`Taux de change invalide pour ${currency}`);
  return Math.round(amountCents * eurPerUnit);
}

const COUNTRY_CURRENCY: Record<string, Currency> = { PL: "PLN", SE: "SEK", CZ: "CZK", US: "USD", JP: "JPY", AU: "AUD", CH: "CHF", GB: "GBP" };

/** Devise de vente d'une boutique selon son pays (EUR par défaut). */
export function currencyForCountry(country: string): Currency {
  return COUNTRY_CURRENCY[country] ?? "EUR";
}
