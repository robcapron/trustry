/**
 * Alertes. Règle non négociable : une référence bloquée passe TOUJOURS
 * avant tout le reste (y compris un réassort), quelle que soit la sévérité.
 */

export const SEVERITIES = ["critical", "important", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ALERT_CATEGORIES = [
  "blocked_listing",
  "stockout",
  "sales_drop",
  "tacos",
  "sync",
  "catalog_error",
  "order_anomaly",
  "customer_service",
  "other",
] as const;
export type AlertCategory = (typeof ALERT_CATEGORIES)[number];

export const ALERT_STATUSES = ["todo", "in_progress", "resolved"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critique",
  important: "Important",
  info: "Info",
};

export const STATUS_LABEL: Record<AlertStatus, string> = {
  todo: "À traiter",
  in_progress: "En cours",
  resolved: "Résolu",
};

export type AlertForSort = {
  severity: Severity;
  category: AlertCategory;
  revenueAtRiskCents: number;
  createdAt: Date;
};

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, important: 1, info: 2 };

/** Tri : 1) référence bloquée en tête, 2) sévérité, 3) CA HT à risque, 4) plus récente. */
export function compareAlerts(a: AlertForSort, b: AlertForSort): number {
  const blockedA = a.category === "blocked_listing" ? 0 : 1;
  const blockedB = b.category === "blocked_listing" ? 0 : 1;
  if (blockedA !== blockedB) return blockedA - blockedB;
  const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (sev !== 0) return sev;
  if (a.revenueAtRiskCents !== b.revenueAtRiskCents) return b.revenueAtRiskCents - a.revenueAtRiskCents;
  return b.createdAt.getTime() - a.createdAt.getTime();
}

export function sortAlerts<T extends AlertForSort>(alerts: T[]): T[] {
  return [...alerts].sort(compareAlerts);
}

export const CATEGORY_LABEL: Record<AlertCategory, string> = {
  blocked_listing: "Référence bloquée",
  stockout: "Rupture",
  sales_drop: "Chute de ventes",
  tacos: "TACoS",
  sync: "Synchronisation",
  catalog_error: "Erreur catalogue",
  order_anomaly: "Anomalie commande",
  customer_service: "Service client",
  other: "Autre",
};

/** Où mener l'action suggérée (chemin relatif à l'espace). */
export function alertActionPath(category: AlertCategory): string {
  switch (category) {
    case "blocked_listing":
    case "catalog_error":
      return "/piliers/integration";
    case "stockout":
      return "/piliers/catalogue";
    case "sales_drop":
      return "/pnl";
    case "tacos":
      return "/piliers/publicite-deals";
    case "sync":
      return "/parametres/connecteurs";
    case "order_anomaly":
      return "/piliers/commandes";
    case "customer_service":
      return "/piliers/service-apres-vente";
    default:
      return "/alertes";
  }
}
