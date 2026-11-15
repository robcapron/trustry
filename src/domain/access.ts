/**
 * Rôles et accès. Les rôles s'appliquent par espace client.
 * Certains modules (ex. Import OMS) sont activés par espace puis accordés membre par membre.
 */

export const ROLES = ["owner", "admin", "manager", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Propriétaire",
  admin: "Admin",
  manager: "Manager",
  viewer: "Lecture seule",
};

export const MODULES = ["import-oms"] as const;
export type ModuleKey = (typeof MODULES)[number];

export const MODULE_LABEL: Record<ModuleKey, string> = {
  "import-oms": "Import OMS",
};

export function canEdit(role: Role): boolean {
  return role !== "viewer";
}

export function canManageMembers(role: Role): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Accès à un module : le module doit être activé sur l'espace,
 * puis propriétaire et admin y ont accès d'office, les autres seulement sur accord explicite.
 */
export function canUseModule(params: {
  module: ModuleKey;
  role: Role;
  enabledModules: readonly string[];
  grantedModules: readonly string[];
}): boolean {
  const { module, role, enabledModules, grantedModules } = params;
  if (!enabledModules.includes(module)) return false;
  if (role === "owner" || role === "admin") return true;
  return grantedModules.includes(module);
}
