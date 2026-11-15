/**
 * Moteur d'alertes (pur, testé). Détecte à partir des données synchronisées :
 *  - références bloquées (priorité absolue, toujours critiques) ;
 *  - ruptures et couverture de stock insuffisante ;
 *  - chutes de ventes par boutique, en identifiant les SKU responsables
 *    ou en concluant à une baisse liée au compte ;
 *  - TACoS au-dessus de la cible ;
 *  - connecteurs en erreur, en retard ou dont l'accès expire.
 * Chaque alerte porte une clé de dédoublonnage stable : une alerte encore ouverte
 * n'est jamais recréée, et elle se résout seule quand la cause disparaît.
 * Montants en centimes d'euro HT.
 */
import { formatDeltaPercent, formatEur, formatNumber, formatPercent } from "@/lib/format";
import type { AlertCategory, Severity } from "./alerts";

export type AlertRules = {
  salesDropPercent: number;
  salesDropWindowDays: number;
  stockCoverDays: number;
  tacosTargetPercent: number;
};

export const DEFAULT_RULES: AlertRules = { salesDropPercent: 20, salesDropWindowDays: 7, stockCoverDays: 7, tacosTargetPercent: 10 };

export type DetectedAlert = {
  dedupeKey: string;
  severity: Severity;
  category: AlertCategory;
  pillar: number | null;
  title: string;
  detail: string;
  scope: "sku" | "account";
  subjects: string[];
  revenueAtRiskCents: number;
  suggestedAction: string | null;
};

export type ListingInput = {
  sku: string;
  storeKey: string; // ex. amazon_eu:DE
  storeLabel: string; // ex. Amazon DE
  brand: string;
  status: "active" | "blocked" | "deleted" | "inactive";
  blockReason: string | null;
  /** CA HT moyen par jour sur la période de référence (avant blocage) */
  dailyRevenueCents: number;
};

export type StockInput = {
  sku: string;
  quantity: number;
  /** unités vendues par jour (moyenne 14 jours, tous canaux) */
  dailyUnits: number;
  dailyRevenueCents: number;
  channels: number;
};

export type StoreSalesInput = {
  storeKey: string;
  storeLabel: string;
  /** CA par SKU sur la fenêtre courante et la fenêtre précédente de même durée */
  current: Record<string, number>;
  previous: Record<string, number>;
};

export type AdsInput = { marketplace: string; label: string; adsCents: number; revenueCents: number };

export type ConnectionInput = {
  marketplace: string;
  label: string;
  status: "connected" | "syncing" | "error" | "not_connected";
  lastSyncAt: string | null;
  syncFrequencyMinutes: number;
  tokenExpiresAt: string | null;
  lastError: string | null;
};

export type AlertEngineInput = {
  now: string; // ISO
  rules: AlertRules;
  listings: ListingInput[];
  stock: StockInput[];
  sales: StoreSalesInput[];
  ads: AdsInput[];
  connections: ConnectionInput[];
};

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

/** Part de la baisse expliquée par les SKU qui baissent le plus au-delà de laquelle la cause est "SKU". */
export const SKU_EXPLAINED_SHARE = 0.6;
/** Nombre maximum de SKU cités ; au-delà, la baisse est diffuse donc liée au compte. */
export const MAX_DRIVER_SKUS = 5;

export function detectBlocked(listings: ListingInput[]): DetectedAlert[] {
  const groups = new Map<string, ListingInput[]>();
  for (const l of listings) {
    if (l.status !== "blocked") continue;
    const key = `${l.storeKey}|${l.blockReason ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  return [...groups.entries()].map(([key, rows]) => {
    const weekly = rows.reduce((t, r) => t + r.dailyRevenueCents, 0) * 7;
    const brands = [...new Set(rows.map((r) => r.brand).filter(Boolean))];
    const brand = brands.length === 1 ? ` ${brands[0]}` : "";
    const n = rows.length;
    return {
      dedupeKey: `blocked:${key}`,
      severity: "critical" as const,
      category: "blocked_listing" as const,
      pillar: 4,
      title: `${n} référence${n > 1 ? "s" : ""}${brand} bloquée${n > 1 ? "s" : ""} sur ${rows[0].storeLabel}`,
      detail: `Intégration produits - ${rows[0].blockReason ?? "Motif non communiqué"} - ${formatEur(weekly)} HT de CA à risque par semaine`,
      scope: "sku" as const,
      subjects: rows.sort((a, b) => b.dailyRevenueCents - a.dailyRevenueCents).map((r) => r.sku),
      revenueAtRiskCents: weekly,
      suggestedAction: "Débloquer",
    };
  });
}

export function detectStock(stock: StockInput[], rules: AlertRules): DetectedAlert[] {
  const out: DetectedAlert[] = [];
  for (const s of stock) {
    if (s.dailyUnits <= 0) continue; // sans ventes récentes, pas de risque de rupture à signaler
    const cover = s.quantity / s.dailyUnits;
    if (cover >= rules.stockCoverDays) continue;
    const out0 = s.quantity <= 0;
    const lostWeek = Math.round(s.dailyRevenueCents * Math.max(0, 7 - Math.max(0, cover)));
    out.push({
      dedupeKey: `stock:${s.sku}`,
      severity: out0 ? "critical" : "important",
      category: "stockout",
      pillar: 2,
      title: out0
        ? `Rupture${s.channels > 1 ? ` sur ${s.channels} canaux` : ""}`
        : `Stock bas : ${Math.floor(cover)} jour${Math.floor(cover) > 1 ? "s" : ""} de couverture`,
      detail: `Catalogue produits - ${s.quantity} en stock pour ${formatNumber(s.dailyUnits, 1)} ventes par jour - ${formatEur(lostWeek)} HT de CA à risque sur 7 jours`,
      scope: "sku",
      subjects: [s.sku],
      revenueAtRiskCents: lostWeek,
      suggestedAction: "Lancer le réassort",
    });
  }
  return out;
}

/**
 * Chute de ventes d'une boutique : si les SKU qui baissent le plus (5 au maximum) expliquent
 * au moins 60 % de la baisse, l'alerte les cite ; sinon la baisse est diffuse, donc liée au compte
 * (Buy Box, suspension, visibilité, prix concurrents...).
 */
export function detectSalesDrops(sales: StoreSalesInput[], rules: AlertRules): DetectedAlert[] {
  const out: DetectedAlert[] = [];
  for (const s of sales) {
    const cur = sum(s.current);
    const prev = sum(s.previous);
    if (prev <= 0) continue;
    const drop = ((cur - prev) / prev) * 100;
    if (drop > -rules.salesDropPercent) continue;
    const lost = prev - cur;
    const skuDrops = Object.keys({ ...s.previous, ...s.current })
      .map((sku) => ({ sku, lost: (s.previous[sku] ?? 0) - (s.current[sku] ?? 0) }))
      .filter((d) => d.lost > 0)
      .sort((a, b) => b.lost - a.lost);
    const drivers: string[] = [];
    let explained = 0;
    for (const d of skuDrops) {
      if (explained >= lost * SKU_EXPLAINED_SHARE || drivers.length >= MAX_DRIVER_SKUS) break;
      drivers.push(d.sku);
      explained += d.lost;
    }
    const bySku = explained >= lost * SKU_EXPLAINED_SHARE;
    const days = rules.salesDropWindowDays;
    out.push({
      dedupeKey: `drop:${s.storeKey}`,
      severity: drop <= -rules.salesDropPercent * 1.5 ? "important" : "info",
      category: "sales_drop",
      pillar: bySku ? 2 : 6,
      title: `${s.storeLabel} : ventes ${formatDeltaPercent(drop, 0)} vs ${days} jours précédents`,
      detail: bySku
        ? `${drivers.length} SKU expliquent ${Math.round((explained / lost) * 100)} % de la baisse (${formatEur(lost)} HT) : vérifier stock, prix et Buy Box`
        : `Baisse liée au compte : diffuse sur ${skuDrops.length} SKU (${formatEur(lost)} HT) - vérifier Buy Box, santé du compte et visibilité`,
      scope: bySku ? "sku" : "account",
      subjects: bySku ? drivers : [`Compte ${s.storeLabel}`],
      revenueAtRiskCents: lost,
      suggestedAction: "Voir les SKU",
    });
  }
  return out;
}

export function detectTacos(ads: AdsInput[], rules: AlertRules): DetectedAlert[] {
  return ads
    .filter((a) => a.revenueCents > 0 && (a.adsCents / a.revenueCents) * 100 > rules.tacosTargetPercent * 1.1)
    .map((a) => {
      const tacos = (a.adsCents / a.revenueCents) * 100;
      const excess = Math.round(a.adsCents - (a.revenueCents * rules.tacosTargetPercent) / 100);
      return {
        dedupeKey: `tacos:${a.marketplace}`,
        severity: tacos > rules.tacosTargetPercent * 1.3 ? ("important" as const) : ("info" as const),
        category: "tacos" as const,
        pillar: 5,
        title: `TACoS ${a.label} à ${formatPercent(tacos)} (cible ${formatPercent(rules.tacosTargetPercent)})`,
        detail: `Publicité et deals - ${formatEur(excess)} HT de dépenses au-dessus de la cible sur 7 jours`,
        scope: "account" as const,
        subjects: [`Campagnes ${a.label}`],
        revenueAtRiskCents: excess,
        suggestedAction: "Ajuster",
      };
    });
}

export function detectConnections(connections: ConnectionInput[], now: string): DetectedAlert[] {
  const out: DetectedAlert[] = [];
  const t = new Date(now).getTime();
  for (const c of connections) {
    if (c.status === "not_connected") continue;
    if (c.tokenExpiresAt) {
      const days = (new Date(c.tokenExpiresAt).getTime() - t) / 86_400_000;
      if (days < 7) {
        out.push({
          dedupeKey: `token:${c.marketplace}`,
          severity: days < 2 ? "critical" : "important",
          category: "sync",
          pillar: 6,
          title: days <= 0 ? `Accès ${c.label} expiré` : `Accès ${c.label} expire dans ${Math.max(1, Math.ceil(days))} jour${Math.ceil(days) > 1 ? "s" : ""}`,
          detail: "Connecteurs - Reconnecter le compte pour ne pas interrompre la remontée des commandes",
          scope: "account",
          subjects: [c.label],
          revenueAtRiskCents: 0,
          suggestedAction: "Reconnecter",
        });
      }
    }
    if (c.status === "error") {
      out.push({
        dedupeKey: `sync-error:${c.marketplace}`,
        severity: "important",
        category: "sync",
        pillar: 6,
        title: `Synchro ${c.label} en erreur`,
        detail: `Connecteurs - ${c.lastError ?? "Erreur inconnue"}`,
        scope: "account",
        subjects: [c.label],
        revenueAtRiskCents: 0,
        suggestedAction: "Relancer",
      });
    } else if (c.lastSyncAt) {
      const lateMin = (t - new Date(c.lastSyncAt).getTime()) / 60_000;
      if (lateMin > Math.max(3 * c.syncFrequencyMinutes, 120)) {
        const h = Math.round(lateMin / 60);
        out.push({
          dedupeKey: `sync-late:${c.marketplace}`,
          severity: "info",
          category: "sync",
          pillar: null,
          title: `Synchro ${c.label} en retard`,
          detail: `Connecteurs - Dernière mise à jour il y a ${h} h`,
          scope: "account",
          subjects: [c.label],
          revenueAtRiskCents: 0,
          suggestedAction: "Relancer",
        });
      }
    }
  }
  return out;
}

export function evaluateAlerts(input: AlertEngineInput): DetectedAlert[] {
  return [
    ...detectBlocked(input.listings),
    ...detectStock(input.stock, input.rules),
    ...detectSalesDrops(input.sales, input.rules),
    ...detectTacos(input.ads, input.rules),
    ...detectConnections(input.connections, input.now),
  ];
}

/** Catégories gérées par le moteur : seules celles-ci sont résolues automatiquement. */
export const ENGINE_CATEGORIES: AlertCategory[] = ["blocked_listing", "stockout", "sales_drop", "tacos", "sync"];
