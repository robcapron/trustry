import "server-only";
import { connection } from "next/server";
import { DEMO_USER, MARKETPLACE_ORDER } from "../demo/seed";
import { getDemoDataset } from "../demo/store";
import { randomBytes } from "node:crypto";
import type { DashboardAlert } from "@/domain/dashboard";
import { ZERO_TOTALS, type DailyRollup, type Rollups } from "@/domain/metrics";
import { DEFAULT_TARGETS, type MonthlyRow, type PoleTargets } from "@/domain/monthly-review";
import type { DateRange } from "@/domain/period";
import type { Role } from "@/domain/access";
import type {
  ConnectInput,
  Connection,
  ConnectorsOverview,
  Invitation,
  McpPermission,
  Member,
  NavCounts,
  PillarScore,
  SessionUser,
  SyncRun,
  SyncSummary,
  WorkspaceSummary,
} from "../types";
import { rollupInMemory } from "./rollups";
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

export async function getToday(): Promise<string> {
  return getDemoDataset().today;
}

export async function getRollups(workspaceId: string, range: DateRange): Promise<Rollups> {
  const ds = getDemoDataset();
  return rollupInMemory(
    ds.metrics.filter((m) => m.workspaceId === workspaceId),
    ds.stores.filter((s) => s.workspaceId === workspaceId),
    ds.products.filter((p) => p.workspaceId === workspaceId),
    range,
  );
}

export async function listAlerts(workspaceId: string): Promise<DashboardAlert[]> {
  return getDemoDataset().alerts.filter((a) => a.workspaceId === workspaceId);
}

export async function listPillarScores(workspaceId: string): Promise<PillarScore[]> {
  return getDemoDataset().pillarScores.filter((p) => p.workspaceId === workspaceId);
}

export async function listBlockedListingKeys(workspaceId: string): Promise<string[]> {
  return getDemoDataset()
    .listings.filter((l) => l.workspaceId === workspaceId && l.status === "blocked")
    .map((l) => `${l.storeId}:${l.productId}`);
}

export async function setAlertStatus(workspaceId: string, alertId: string, status: "todo" | "in_progress" | "resolved"): Promise<void> {
  // Mode démo : modification en mémoire (perdue au redémarrage)
  const alert = getDemoDataset().alerts.find((a) => a.workspaceId === workspaceId && a.id === alertId);
  if (!alert) throw new Error("Alerte introuvable.");
  alert.status = status;
}

function demoMember(workspaceId: string, userId: string) {
  const m = getDemoDataset().members.find((x) => x.workspaceId === workspaceId && x.userId === userId);
  if (!m) throw new Error("Membre introuvable.");
  return m;
}

export async function setMemberRole(workspaceId: string, userId: string, role: Role): Promise<void> {
  demoMember(workspaceId, userId).role = role;
}

export async function setMemberModules(workspaceId: string, userId: string, modules: string[]): Promise<void> {
  demoMember(workspaceId, userId).grantedModules = modules;
}

export async function removeMember(workspaceId: string, userId: string): Promise<void> {
  const ds = getDemoDataset();
  ds.members = ds.members.filter((m) => !(m.workspaceId === workspaceId && m.userId === userId));
}

export async function createInvitation(): Promise<string> {
  throw new Error("Les invitations nécessitent Supabase : indisponibles en mode démo.");
}

export async function listInvitations(): Promise<Invitation[]> {
  return [];
}

export async function getMonthlyRows(workspaceId: string, range: DateRange): Promise<MonthlyRow[]> {
  const ds = getDemoDataset();
  const storeById = new Map(ds.stores.map((st) => [st.id, st]));
  const productById = new Map(ds.products.map((p) => [p.id, p]));
  const map = new Map<string, MonthlyRow>();
  for (const m of ds.metrics) {
    if (m.workspaceId !== workspaceId || m.date < range.from || m.date > range.to) continue;
    const marketplace = storeById.get(m.storeId)?.marketplace ?? "?";
    const brand = productById.get(m.productId)?.brand ?? "";
    const month = m.date.slice(0, 7);
    const key = `${month}|${marketplace}|${brand}`;
    let r = map.get(key);
    if (!r) {
      r = { month, marketplace, brand, revenueHt: 0, commissions: 0, ads: 0, logistics: 0, returns: 0, cogs: 0, units: 0, orders: 0, returnUnits: 0 };
      map.set(key, r);
    }
    r.revenueHt += m.revenueHt;
    r.commissions += m.commissions;
    r.ads += m.ads;
    r.logistics += m.logistics;
    r.returns += m.returns;
    r.cogs += m.cogs;
    r.units += m.units;
    r.orders += m.orders;
    r.returnUnits += m.returnUnits;
  }
  return [...map.values()];
}

export async function getOpex(workspaceId: string): Promise<Record<string, number>> {
  const ds = getDemoDataset();
  return Object.fromEntries(
    Object.entries(ds.opex)
      .filter(([k]) => k.startsWith(`${workspaceId}:`))
      .map(([k, v]) => [k.split(":")[1], v]),
  );
}

const demoPoleTargets = new Map<string, PoleTargets>();

export async function getPoleTargets(workspaceId: string): Promise<PoleTargets> {
  return demoPoleTargets.get(workspaceId) ?? DEFAULT_TARGETS;
}

export async function setPoleTargets(workspaceId: string, targets: PoleTargets): Promise<void> {
  demoPoleTargets.set(workspaceId, targets);
}

export async function setMonthlyPlan(workspaceId: string, month: string, plan: { revenueTarget: number | null; opex: number }) {
  const ds = getDemoDataset();
  const key = `${workspaceId}:${month}`;
  if (plan.revenueTarget === null) delete ds.revenueTargets[key];
  else ds.revenueTargets[key] = plan.revenueTarget;
  ds.opex[key] = plan.opex;
}

export async function getDaily(workspaceId: string, range: DateRange): Promise<DailyRollup[]> {
  const map = new Map<string, DailyRollup>();
  for (const m of getDemoDataset().metrics) {
    if (m.workspaceId !== workspaceId || m.date < range.from || m.date > range.to) continue;
    let d = map.get(m.date);
    if (!d) map.set(m.date, (d = { ...ZERO_TOTALS, date: m.date }));
    d.revenueHt += m.revenueHt;
    d.commissions += m.commissions;
    d.ads += m.ads;
    d.logistics += m.logistics;
    d.returns += m.returns;
    d.cogs += m.cogs;
    d.units += m.units;
    d.orders += m.orders;
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function getRevenueTarget(workspaceId: string, month: string): Promise<number | null> {
  return getDemoDataset().revenueTargets[`${workspaceId}:${month}`] ?? null;
}

// Connecteurs (démo : état en mémoire) ---------------------------------------------

const demoMcp = new Map<string, McpPermission>();
const demoKeys = new Map<string, { prefix: string; createdAt: string; createdBy: string }>();

export async function getConnectorsOverview(workspaceId: string): Promise<ConnectorsOverview> {
  const ds = getDemoDataset();
  const conns = ds.connections.filter((c) => c.workspaceId === workspaceId);
  const runs: SyncRun[] = conns
    .filter((c) => c.lastSyncAt)
    .map((c): SyncRun => ({
      id: `run-${c.id}`,
      marketplace: c.marketplace,
      job: "full",
      status: c.status === "error" ? "error" : c.status === "syncing" ? "running" : "success",
      startedAt: c.lastSyncAt!,
      finishedAt: c.status === "syncing" ? null : c.lastSyncAt,
      rows: c.status === "error" ? 0 : 1_200,
      error: c.lastError,
    }))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return {
    rows: MARKETPLACE_ORDER.map((m) => ({ marketplace: m, connection: conns.find((c) => c.marketplace === m) ?? null })),
    apiKey: demoKeys.get(workspaceId) ?? { prefix: "trs_live_4f2a", createdAt: "2026-11-03T10:00:00Z", createdBy: "Robin Capron" },
    mcpPermission: demoMcp.get(workspaceId) ?? "actions_with_approval",
    mcpUsers: 2,
    frequency: conns[0]?.syncFrequencyMinutes ?? 15,
    runs,
  };
}

export async function setMcpPermission(workspaceId: string, level: McpPermission) {
  demoMcp.set(workspaceId, level);
}

export async function setSyncFrequency(workspaceId: string, minutes: 15 | 60 | 1440) {
  for (const c of getDemoDataset().connections) if (c.workspaceId === workspaceId) c.syncFrequencyMinutes = minutes;
}

export async function createApiKey(workspaceId: string, createdBy: string): Promise<{ key: string; prefix: string }> {
  const key = `trs_live_${randomBytes(24).toString("base64url")}`;
  const prefix = `trs_live_${key.slice(-4)}`;
  demoKeys.set(workspaceId, { prefix, createdAt: new Date().toISOString(), createdBy });
  return { key, prefix };
}

export async function connectMarketplace(workspaceId: string, input: ConnectInput): Promise<{ connectionId: string; adapter: string }> {
  const ds = getDemoDataset();
  let c = ds.connections.find((x) => x.workspaceId === workspaceId && x.marketplace === input.marketplace);
  if (!c) {
    c = { id: `demo-${input.marketplace}`, workspaceId, marketplace: input.marketplace, status: "not_connected", method: "api", lastSyncAt: null, tokenExpiresAt: null, syncProgress: null, lastError: null, syncFrequencyMinutes: 15 };
    ds.connections.push(c);
  }
  c.method = input.method === "mcp" ? "mcp" : "api";
  c.status = input.method === "mcp" ? "connected" : "syncing";
  c.syncProgress = input.method === "mcp" ? null : 0;
  c.lastError = null;
  c.tokenExpiresAt = null;
  return { connectionId: c.id, adapter: input.method === "test" ? "mock" : "native" };
}

export async function disconnectMarketplace(workspaceId: string, connectionId: string) {
  const c = getDemoDataset().connections.find((x) => x.workspaceId === workspaceId && x.id === connectionId);
  if (c) Object.assign(c, { status: "not_connected", syncProgress: null, lastError: null, tokenExpiresAt: null });
}
