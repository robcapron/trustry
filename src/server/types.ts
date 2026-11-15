import type { AlertCategory, AlertStatus, Severity } from "@/domain/alerts";
import type { Role } from "@/domain/access";

export type MarketplaceCode =
  | "amazon_eu"
  | "amazon_us"
  | "amazon_jp_au"
  | "decathlon"
  | "kaufland"
  | "bol"
  | "cdiscount"
  | "ebay"
  | "allegro"
  | "tiktok_shop"
  | "alltricks";

export type ConnectionStatus = "connected" | "syncing" | "error" | "not_connected";
export type ListingStatus = "active" | "blocked" | "deleted" | "inactive";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  firstName: string;
};

export type WorkspaceSummary = {
  id: string;
  slug: string;
  name: string;
  organizationId: string;
  organizationName: string;
  /** Nombre d'espaces clients de l'organisation accessibles à l'utilisateur */
  organizationWorkspaceCount: number;
  role: Role;
  enabledModules: string[];
  grantedModules: string[];
};

export type NavCounts = {
  openAlerts: number;
  blockedListings: number;
};

export type SyncSummary = {
  total: number;
  upToDate: number;
  syncing: number;
  errors: number;
  notConnected: number;
};

export type Connection = {
  id: string;
  workspaceId: string;
  marketplace: MarketplaceCode;
  status: ConnectionStatus;
  method: "api" | "mcp";
  lastSyncAt: string | null;
  tokenExpiresAt: string | null;
  syncProgress: number | null;
  lastError: string | null;
  syncFrequencyMinutes: 15 | 60 | 1440;
};

export type Store = {
  id: string;
  workspaceId: string;
  connectionId: string;
  marketplace: MarketplaceCode;
  country: string;
  currency: string;
};

export type Product = {
  id: string;
  workspaceId: string;
  sku: string;
  brand: string;
  title: string;
  priceHtCents: number;
  unitCostCents: number;
};

export type Listing = {
  id: string;
  workspaceId: string;
  productId: string;
  storeId: string;
  status: ListingStatus;
  blockReason: string | null;
  qualityScore: number;
};

/** Agrégat quotidien par boutique et SKU (montants en centimes d'euro HT). */
export type DailyMetric = {
  workspaceId: string;
  date: string; // YYYY-MM-DD
  storeId: string;
  productId: string;
  units: number;
  orders: number;
  revenueHt: number;
  commissions: number;
  ads: number;
  logistics: number;
  returns: number;
  cogs: number;
};

export type Alert = {
  id: string;
  workspaceId: string;
  severity: Severity;
  category: AlertCategory;
  pillar: number | null;
  title: string;
  detail: string;
  scope: "sku" | "account";
  subjects: string[];
  revenueAtRiskCents: number;
  suggestedAction: string | null;
  status: AlertStatus;
  createdAt: string;
};

export type PillarScore = {
  workspaceId: string;
  date: string;
  pillar: number;
  score: number;
  headline: string;
};

export type Member = {
  userId: string;
  fullName: string;
  email: string;
  role: Role;
  grantedModules: string[];
};

export type Invitation = {
  id: string;
  email: string;
  role: Role;
  grantedModules: string[];
  expiresAt: string;
};
