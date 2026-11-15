/**
 * Identifiants demandés à la connexion de chaque marketplace (pur).
 * OAuth (Amazon, eBay, TikTok Shop, Allegro) : autorisation sur le site de la marketplace,
 * disponible avec les connecteurs natifs ; en attendant, connexion via Claude (MCP).
 */
import type { MarketplaceCode } from "@/server/types";

export type CredentialField = { name: string; label: string; placeholder: string; hint?: string; secret?: boolean; defaultValue?: string; pattern?: string };

export type ConnectorSpec = { family: "mirakl" | "kaufland" | "bol" | "octopia" | "oauth"; label: string; fields: CredentialField[] };

const mirakl = (defaultUrl: string, accountPath: string): ConnectorSpec => ({
  family: "mirakl",
  label: "API Mirakl",
  fields: [
    { name: "url", label: "URL de l'instance Mirakl", placeholder: defaultUrl, defaultValue: defaultUrl, pattern: "^https://.+" },
    { name: "shop_id", label: "Shop ID", placeholder: "Ex : 4821", pattern: "^[0-9]+$" },
    { name: "api_key", label: "Clé API vendeur", placeholder: "Collez la clé de votre compte Mirakl", hint: `${accountPath}. Stockée chiffrée.`, secret: true },
  ],
});

const pair = (family: ConnectorSpec["family"], label: string, id: string, secret: string, hint: string): ConnectorSpec => ({
  family,
  label,
  fields: [
    { name: "client_id", label: id, placeholder: id },
    { name: "client_secret", label: secret, placeholder: secret, hint: `${hint}. Stockée chiffrée.`, secret: true },
  ],
});

const oauth: ConnectorSpec = { family: "oauth", label: "OAuth", fields: [] };

export const CONNECTOR_SPECS: Record<MarketplaceCode, ConnectorSpec> = {
  amazon_eu: oauth,
  amazon_us: oauth,
  amazon_jp_au: oauth,
  decathlon: mirakl("https://marketplace-decathlon-eu.mirakl.net", "Mirakl > Mon compte > Clé API"),
  alltricks: mirakl("https://alltricks.mirakl.net", "Mirakl > Mon compte > Clé API"),
  kaufland: pair("kaufland", "API Kaufland", "Client Key", "Secret Key", "Kaufland Seller Portal > Paramètres > API"),
  bol: pair("bol", "Retailer API", "Client ID", "Client Secret", "bol.com Partner Platform > Paramètres > Services API"),
  cdiscount: pair("octopia", "API Octopia", "Client ID", "Client Secret", "Octopia Seller Portal > Intégration > API"),
  ebay: oauth,
  allegro: oauth,
  tiktok_shop: oauth,
};

export const DATA_SCOPES = [
  { key: "orders", label: "Commandes" },
  { key: "catalog", label: "Catalogue et offres" },
  { key: "inventory", label: "Stocks" },
  { key: "returns", label: "Retours et messages" },
  { key: "finances", label: "Finances" },
  { key: "ads", label: "Publicité" },
] as const;

/** Vérifie les identifiants saisis ; renvoie le message d'erreur à afficher, ou null. */
export function validateCredentials(spec: ConnectorSpec, values: Record<string, string>): string | null {
  for (const f of spec.fields) {
    const v = (values[f.name] ?? "").trim();
    if (!v) return `${f.label} : champ obligatoire.`;
    if (f.pattern && !new RegExp(f.pattern).test(v)) return `${f.label} : format invalide.`;
  }
  return null;
}
