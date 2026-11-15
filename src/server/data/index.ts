import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@/domain/access";
import { buildDashboard, type DashboardView } from "@/domain/dashboard";
import { buildPeriod, type PeriodKey } from "@/domain/period";
import { buildPnl, type PnlFilters, type PnlView } from "@/domain/pnl";
import { isDemoMode } from "@/lib/env";
import { MARKETPLACE_NAMES } from "@/domain/marketplaces";
import type { Connection, Member, NavCounts, SessionUser, SyncSummary, WorkspaceSummary } from "../types";
import * as demo from "./demo-source";
import * as supa from "./supabase-source";

/**
 * Couche d'accès aux données (Data Access Layer). Les pages n'appellent que ces fonctions.
 * En production : Supabase avec la session de l'utilisateur (RLS). Sinon : mode démo.
 */
const source = () => (isDemoMode() ? demo : supa);

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => source().getCurrentUser());

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

export const listWorkspaces = cache(async (): Promise<WorkspaceSummary[]> => source().listWorkspaces());

/** Espace demandé dans l'URL, ou 404 si l'utilisateur n'y a pas accès. */
export const getWorkspace = cache(async (slug: string): Promise<WorkspaceSummary | null> => {
  const all = await listWorkspaces();
  return all.find((w) => w.slug === slug) ?? null;
});

export const getNavCounts = cache(async (workspaceId: string): Promise<NavCounts> => source().getNavCounts(workspaceId));

export const getSyncSummary = cache(async (workspaceId: string): Promise<SyncSummary> =>
  source().getSyncSummary(workspaceId),
);

export const listConnections = cache(async (workspaceId: string): Promise<Connection[]> =>
  source().listConnections(workspaceId),
);

export const listMembers = cache(async (workspaceId: string): Promise<Member[]> => source().listMembers(workspaceId));

export const getToday = cache(async (): Promise<string> => source().getToday());

export const listAlerts = cache(async (workspaceId: string) => source().listAlerts(workspaceId));

/** Données complètes du Dashboard global pour une période. */
export const getDashboard = cache(async (workspaceId: string, periodKey: PeriodKey): Promise<DashboardView> => {
  const src = source();
  const today = await src.getToday();
  const period = buildPeriod(periodKey, today);
  const [current, previous, alerts, pillarScores, blocked] = await Promise.all([
    src.getRollups(workspaceId, period.current),
    src.getRollups(workspaceId, period.previous),
    src.listAlerts(workspaceId),
    src.listPillarScores(workspaceId),
    src.listBlockedListingKeys(workspaceId),
  ]);
  return buildDashboard({
    period,
    today,
    current,
    previous,
    alerts,
    pillarScores,
    blockedListings: new Set(blocked),
    marketplaceNames: MARKETPLACE_NAMES,
  });
});

/** P&L détaillé (canal > pays > SKU) pour une période et des filtres. */
export const getPnl = cache(async (workspaceId: string, periodKey: PeriodKey, filters: PnlFilters): Promise<PnlView> => {
  const src = source();
  const period = buildPeriod(periodKey, await src.getToday());
  const [current, previous] = await Promise.all([
    src.getRollups(workspaceId, period.current),
    src.getRollups(workspaceId, period.previous),
  ]);
  return buildPnl({ current: current.skus, previous: previous.skus, names: MARKETPLACE_NAMES, filters });
});

export async function setAlertStatus(workspaceId: string, alertId: string, status: "todo" | "in_progress" | "resolved") {
  return source().setAlertStatus(workspaceId, alertId, status);
}

export const listInvitations = cache(async (workspaceId: string) => source().listInvitations(workspaceId));

export const members = {
  setRole: (workspaceId: string, userId: string, role: Role) => source().setMemberRole(workspaceId, userId, role),
  setModules: (workspaceId: string, userId: string, modules: string[]) => source().setMemberModules(workspaceId, userId, modules),
  remove: (workspaceId: string, userId: string) => source().removeMember(workspaceId, userId),
  invite: (workspaceId: string, email: string, role: Role, modules: string[]) => source().createInvitation(workspaceId, email, role, modules),
};
