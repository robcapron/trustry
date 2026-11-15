/**
 * Données normalisées renvoyées par les connecteurs (interface commune à toutes les marketplaces)
 * et calcul des métriques journalières par SKU et boutique (pur, testé).
 *
 * Règles :
 *  - CA HT converti en EUR au taux BCE du jour de la commande ; commandes annulées exclues.
 *  - Commissions, pub et logistique rattachées au SKU quand il est connu, sinon réparties au prorata
 *    du CA (commande, puis jour et pays, puis pays sur la période).
 *  - Coût de retour = remboursement HT + frais de retour - valeur restockée (jour du retour).
 *  - Coût d'achat = unités x coût unitaire valable au jour de la commande.
 */
import { toEurCents, type Currency } from "./money";

export type FeeType = "commission" | "advertising" | "logistics" | "return" | "other";

export type NormalizedOrderItem = { sku: string; quantity: number; revenueHtCents: number };
export type NormalizedOrder = {
  externalId: string;
  country: string;
  orderedAt: string; // ISO
  status: "pending" | "shipped" | "delivered" | "cancelled" | "refunded";
  currency: Currency;
  items: NormalizedOrderItem[];
};
export type NormalizedFee = {
  date: string;
  country: string;
  type: FeeType;
  amountCents: number;
  currency: Currency;
  orderExternalId?: string | null;
  sku?: string | null;
};
export type NormalizedAdSpend = {
  date: string;
  country: string;
  campaignExternalId: string;
  campaignName: string;
  sku?: string | null;
  spendCents: number;
  currency: Currency;
  attributedSalesCents: number;
};
export type NormalizedReturn = {
  date: string;
  country: string;
  sku: string;
  quantity: number;
  refundHtCents: number;
  returnFeesCents: number;
  restockedValueCents: number;
  currency: Currency;
  orderExternalId?: string | null;
  reason?: string | null;
};
export type NormalizedListing = {
  sku: string;
  country: string;
  externalId: string | null;
  status: "active" | "blocked" | "deleted" | "inactive";
  blockReason: string | null;
  priceCents: number | null;
  currency: Currency;
  title?: string;
  brand?: string;
  ean?: string | null;
};
export type NormalizedInventory = { sku: string; quantity: number };
/** Coût logistique réel par commande (ex. contrôle des frais de transport Google Drive), en EUR */
export type OrderLogisticsCost = { orderExternalId: string; country: string; costEurCents: number; date: string };

export type MetricRow = {
  date: string;
  country: string;
  sku: string;
  units: number;
  orders: number;
  revenueHt: number;
  commissions: number;
  ads: number;
  logistics: number;
  returns: number;
  cogs: number;
  returnUnits: number;
};

export type BuildMetricsInput = {
  orders: NormalizedOrder[];
  fees: NormalizedFee[];
  ads: NormalizedAdSpend[];
  returns: NormalizedReturn[];
  logistics?: OrderLogisticsCost[];
  /** coût unitaire HT en centimes d'euro valable à la date, null si inconnu */
  unitCost: (sku: string, date: string) => number | null;
  /** valeur d'une unité de devise en EUR au jour donné (taux BCE) */
  eurPerUnit: (currency: Currency, date: string) => number;
};

export type BuildMetricsResult = {
  rows: MetricRow[];
  /** montants qui n'ont pu être rattachés à aucune vente (ex. pub sans vente dans le pays) */
  unallocated: { ads: number; commissions: number; logistics: number; returns: number };
  /** SKU vendus sans coût d'achat connu (marge surestimée) */
  missingCosts: string[];
};

type Bucket = "commissions" | "ads" | "logistics" | "returns";

export function buildDailyMetrics(input: BuildMetricsInput): BuildMetricsResult {
  const rows = new Map<string, MetricRow>();
  const key = (date: string, country: string, sku: string) => `${date}|${country}|${sku}`;
  const row = (date: string, country: string, sku: string) => {
    const k = key(date, country, sku);
    let r = rows.get(k);
    if (!r) {
      r = { date, country, sku, units: 0, orders: 0, revenueHt: 0, commissions: 0, ads: 0, logistics: 0, returns: 0, cogs: 0, returnUnits: 0 };
      rows.set(k, r);
    }
    return r;
  };
  const eur = (cents: number, currency: Currency, date: string) => toEurCents(cents, currency, currency === "EUR" ? 1 : input.eurPerUnit(currency, date));
  const missing = new Set<string>();
  const unallocated = { ads: 0, commissions: 0, logistics: 0, returns: 0 };

  // 1) Ventes, coût d'achat ; mémorise la ventilation de chaque commande
  const orderLines = new Map<string, { row: MetricRow; revenue: number }[]>();
  for (const o of input.orders) {
    if (o.status === "cancelled") continue;
    const date = o.orderedAt.slice(0, 10);
    const lines: { row: MetricRow; revenue: number }[] = [];
    const skus = new Set<string>();
    for (const it of o.items) {
      const r = row(date, o.country, it.sku);
      const revenue = eur(it.revenueHtCents, o.currency, date);
      r.revenueHt += revenue;
      r.units += it.quantity;
      if (!skus.has(it.sku)) r.orders += 1;
      skus.add(it.sku);
      const cost = input.unitCost(it.sku, date);
      if (cost === null) missing.add(it.sku);
      else r.cogs += cost * it.quantity;
      lines.push({ row: r, revenue });
    }
    orderLines.set(`${o.country}|${o.externalId}`, lines);
  }

  // Répartition au prorata du CA, avec repli jour+pays puis pays
  const spread = (amount: number, bucket: Bucket, targets: { row: MetricRow; revenue: number }[]) => {
    const total = targets.reduce((t, x) => t + x.revenue, 0);
    if (!targets.length) return false;
    let left = amount;
    targets.forEach((x, i) => {
      const part = i === targets.length - 1 ? left : Math.round((amount * (total > 0 ? x.revenue : 1)) / (total > 0 ? total : targets.length));
      x.row[bucket] += part;
      left -= part;
    });
    return true;
  };
  const salesRows = () => [...rows.values()].filter((r) => r.revenueHt > 0);
  const allocate = (amount: number, bucket: Bucket, date: string, country: string, sku?: string | null, orderId?: string | null) => {
    if (amount === 0) return;
    if (sku) {
      row(date, country, sku)[bucket] += amount;
      return;
    }
    const lines = orderId ? orderLines.get(`${country}|${orderId}`) : undefined;
    if (lines && spread(amount, bucket, lines)) return;
    const sameDay = salesRows().filter((r) => r.date === date && r.country === country).map((r) => ({ row: r, revenue: r.revenueHt }));
    if (spread(amount, bucket, sameDay)) return;
    const sameCountry = salesRows().filter((r) => r.country === country).map((r) => ({ row: r, revenue: r.revenueHt }));
    if (spread(amount, bucket, sameCountry)) return;
    unallocated[bucket] += amount;
  };

  // 2) Frais marketplace
  for (const f of input.fees) {
    const amount = eur(f.amountCents, f.currency, f.date);
    const bucket: Bucket =
      f.type === "advertising" ? "ads" : f.type === "logistics" ? "logistics" : f.type === "return" ? "returns" : "commissions";
    allocate(amount, bucket, f.date, f.country, f.sku, f.orderExternalId);
  }

  // 3) Publicité
  for (const a of input.ads) allocate(eur(a.spendCents, a.currency, a.date), "ads", a.date, a.country, a.sku);

  // 4) Logistique réelle par commande
  for (const l of input.logistics ?? []) allocate(l.costEurCents, "logistics", l.date, l.country, null, l.orderExternalId);

  // 5) Retours
  for (const r of input.returns) {
    const m = row(r.date, r.country, r.sku);
    m.returns += eur(r.refundHtCents + r.returnFeesCents - r.restockedValueCents, r.currency, r.date);
    m.returnUnits += r.quantity;
  }

  return {
    rows: [...rows.values()].sort((a, b) => a.date.localeCompare(b.date) || a.country.localeCompare(b.country) || a.sku.localeCompare(b.sku)),
    unallocated,
    missingCosts: [...missing].sort(),
  };
}
