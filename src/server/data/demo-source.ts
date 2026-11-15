import "server-only";
import { connection } from "next/server";
import { DEMO_USER, MARKETPLACE_ORDER } from "../demo/seed";
import { getDemoDataset } from "../demo/store";
import type { Connection, Member, NavCounts, SessionUser, SyncSummary, WorkspaceSummary } from "../types";
import { summarizeConnections } from "./summaries";

export async function getCurrentUser(): Promise<SessionUser> {
  // Rendu à la demande (les données de démo dépendent de la date du jour)
  await connection();
  return { id: DEMO_USER.id, email: DEMO_USER.email, fullName: DEMO_USER.fullName, firstName: DEMO_USER.fullName.split(" ")[0] };
}

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  const ds = getDemoDataset();
  const mine = ds.members.filter((m) => m.userId === DEMO_USER.id);
  return mine.map((m) => {
    const w = ds.workspaces.find((x) => x.id === m.workspaceId)!;
    return {
      id: w.id,
      slug: w.slug,
      name: w.name,
      organizationId: ds.organization.id,
      organizationName: ds.organization.name,
      organizationWorkspaceCount: mine.length,
      role: m.role,
      enabledModules: w.enabledModules,
      grantedModules: m.grantedModules,
    };
  });
}

export async function getNavCounts(workspaceId: string): Promise<NavCounts> {
  const ds = getDemoDataset();
  return {
    openAlerts: ds.alerts.filter((a) => a.workspaceId === workspaceId && a.status !== "resolved").length,
    blockedListings: ds.listings.filter((l) => l.workspaceId === workspaceId && l.status === "blocked").length,
  };
}

export async function getSyncSummary(workspaceId: string): Promise<SyncSummary> {
  const ds = getDemoDataset();
  return summarizeConnections(ds.connections.filter((c) => c.workspaceId === workspaceId).map((c) => c.status));
}

export async function listConnections(workspaceId: string): Promise<Connection[]> {
  const ds = getDemoDataset();
  return ds.connections
    .filter((c) => c.workspaceId === workspaceId)
    .sort((a, b) => MARKETPLACE_ORDER.indexOf(a.marketplace) - MARKETPLACE_ORDER.indexOf(b.marketplace));
}

export async function listMembers(workspaceId: string): Promise<Member[]> {
  const ds = getDemoDataset();
  return ds.members
    .filter((m) => m.workspaceId === workspaceId)
    .map((m) => {
      const u = ds.users.find((x) => x.id === m.userId)!;
      return { userId: u.id, fullName: u.fullName, email: u.email, role: m.role, grantedModules: m.grantedModules };
    });
}
