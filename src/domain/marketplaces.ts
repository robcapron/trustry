import type { MarketplaceCode } from "@/server/types";

/** Référentiel des marketplaces gérées (aligné sur la table public.marketplaces). */
export const MARKETPLACES: Record<MarketplaceCode, { name: string; api: string; countries: string[] }> = {
  amazon_eu: { name: "Amazon UE", api: "SP-API + Ads API", countries: ["FR", "DE", "IT", "ES", "NL", "BE", "PL", "SE"] },
  amazon_us: { name: "Amazon US", api: "SP-API + Ads API", countries: ["US"] },
  amazon_jp_au: { name: "Amazon JP / AU", api: "SP-API", countries: ["JP", "AU"] },
  decathlon: { name: "Décathlon", api: "API Mirakl", countries: ["FR", "DE", "ES", "IT", "BE"] },
  kaufland: { name: "Kaufland", api: "API Kaufland", countries: ["DE", "CZ", "SK"] },
  bol: { name: "Bol.com", api: "Retailer API", countries: ["NL", "BE"] },
  cdiscount: { name: "Cdiscount", api: "API Octopia", countries: ["FR"] },
  ebay: { name: "eBay", api: "OAuth eBay", countries: ["FR", "DE", "IT", "ES"] },
  allegro: { name: "Allegro", api: "REST API", countries: ["PL"] },
  tiktok_shop: { name: "TikTok Shop", api: "Partner API", countries: ["FR", "DE", "ES", "IT"] },
  alltricks: { name: "Alltricks", api: "API Mirakl", countries: ["FR"] },
};

export const MARKETPLACE_ORDER: MarketplaceCode[] = [
  "amazon_eu",
  "amazon_us",
  "amazon_jp_au",
  "decathlon",
  "kaufland",
  "bol",
  "cdiscount",
  "ebay",
  "allegro",
  "tiktok_shop",
  "alltricks",
];


export const MARKETPLACE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(MARKETPLACES).map(([k, v]) => [k, v.name]),
);
