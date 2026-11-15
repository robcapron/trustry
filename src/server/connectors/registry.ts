import type { AdapterContext, MarketplaceAdapter } from "./types";
import { MockAdapter } from "./mock-adapter";

/**
 * Choix de l'implémentation d'une connexion. Les connecteurs natifs arrivent marketplace
 * par marketplace (Amazon SP-API, Mirakl, Kaufland...) ; d'ici là, seule la connexion
 * de test est synchronisée automatiquement, les autres passent par Claude (MCP).
 */
export function getAdapter(adapter: string, ctx: AdapterContext): MarketplaceAdapter | null {
  if (adapter === "mock") return new MockAdapter(ctx);
  return null;
}
