import { PILLARS } from "@/domain/pillars";
import type { IconName } from "@/components/trustry/icons";

export type NavBadge = "alerts" | "blocked";

export type NavItem = {
  key: string;
  label: string;
  icon: IconName;
  /** chemin relatif à l'espace : /{espace}{path} */
  path: string;
  badge?: NavBadge;
  /** module requis (ex: import-oms) */
  module?: string;
};

export const NAV_TOP: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard", path: "/dashboard" },
  { key: "alertes", label: "Alertes", icon: "alertes", path: "/alertes", badge: "alerts" },
  { key: "pnl", label: "P&L détaillé", icon: "pnl", path: "/pnl" },
  { key: "import-oms", label: "Import OMS", icon: "importOms", path: "/import-oms", module: "import-oms" },
];

export const NAV_PILLARS: NavItem[] = PILLARS.map((p) => ({
  key: `pilier-${p.number}`,
  label: p.navLabel,
  icon: p.icon,
  path: `/piliers/${p.slug}`,
  badge: p.number === 4 ? "blocked" : undefined,
}));

export const NAV_BOTTOM: NavItem[] = [
  { key: "connecteurs", label: "Connecteurs", icon: "connecteurs", path: "/parametres/connecteurs" },
  { key: "parametres", label: "Paramètres", icon: "parametres", path: "/parametres" },
];

/** Onglets de la barre mobile (iPhone) */
export const NAV_MOBILE: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard", path: "/dashboard" },
  { key: "alertes", label: "Alertes", icon: "alertes", path: "/alertes", badge: "alerts" },
  { key: "pnl", label: "P&L", icon: "pnl", path: "/pnl" },
  { key: "piliers", label: "Piliers", icon: "piliers", path: "/piliers" },
  { key: "plus", label: "Plus", icon: "plus", path: "/plus" },
];

/** Un lien est actif si le chemin courant correspond, sans que "Paramètres" capte "Connecteurs". */
export function isActive(pathname: string, workspaceSlug: string, item: NavItem): boolean {
  const base = `/${workspaceSlug}${item.path}`;
  if (item.key === "parametres") {
    return pathname.startsWith(base) && !pathname.startsWith(`/${workspaceSlug}/parametres/connecteurs`);
  }
  if (item.key === "piliers") return pathname === base || pathname.startsWith(`${base}/`);
  return pathname === base || pathname.startsWith(`${base}/`);
}
