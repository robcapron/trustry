/**
 * Interface commune des connecteurs marketplaces. Chaque marketplace a son implémentation
 * (Amazon SP-API, Mirakl, Kaufland...), le MockAdapter sert aux tests et à la démo.
 * Les données renvoyées sont normalisées (src/domain/sync-metrics.ts) ; le calcul du profit
 * est le même pour toutes les marketplaces.
 */
import type {
  NormalizedAdSpend,
  NormalizedFee,
  NormalizedInventory,
  NormalizedListing,
  NormalizedOrder,
  NormalizedReturn,
} from "@/domain/sync-metrics";
import type { DateRange } from "@/domain/period";
import type { MarketplaceCode } from "@/server/types";

export type NormalizedMessage = { externalId: string; country: string; receivedAt: string; orderExternalId: string | null; subject: string; answered: boolean };

export type AdapterContext = {
  workspaceId: string;
  connectionId: string;
  marketplace: MarketplaceCode;
  countries: string[];
  /** catalogue connu de l'espace (SKU, titre, marque, prix HT indicatif) */
  catalogue: { sku: string; title: string; brand: string; priceHtCents: number }[];
  /** identifiants déchiffrés depuis Vault (jamais journalisés) */
  credentials: Record<string, string> | null;
  today: string;
};

export type DataScope = "orders" | "catalog" | "inventory" | "prices" | "ads" | "finances" | "returns" | "messages";

export type QuotaInfo = { remaining: number | null; resetAt: string | null };

export class AdapterError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "rate_limited" | "unavailable" | "invalid",
  ) {
    super(message);
  }
}

export interface MarketplaceAdapter {
  readonly code: MarketplaceCode;
  /** jeu de données que cette marketplace sait fournir */
  readonly scopes: DataScope[];
  orders(range: DateRange): Promise<NormalizedOrder[]>;
  listings(): Promise<NormalizedListing[]>;
  inventory(): Promise<NormalizedInventory[]>;
  ads(range: DateRange): Promise<NormalizedAdSpend[]>;
  finances(range: DateRange): Promise<NormalizedFee[]>;
  returns(range: DateRange): Promise<NormalizedReturn[]>;
  messages(range: DateRange): Promise<NormalizedMessage[]>;
  /** date d'expiration de l'accès (jeton OAuth), si connue */
  tokenExpiresAt(): Promise<string | null>;
  quota(): QuotaInfo;
}
