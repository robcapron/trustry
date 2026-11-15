import "server-only";
import type { Role } from "@/domain/access";
import { createSupabaseServerClient } from "../supabase/server";
import type { Connection, ConnectionStatus, MarketplaceCode, Member, NavCounts, SessionUser, SyncSummary, WorkspaceSummary } from "../types";
import { summarizeConnections } from "./summaries";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", claims.sub).maybeSingle();
  const fullName = (profile?.full_name as string | undefined) || (claims.email as string | undefined) || "";
  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? "",
    fullName,
    firstName: fullName.split(/[\s@]/)[0] ?? "",
  };
}

type WorkspaceRow = {
  id: string;
  slug: string;
  name: string;
  organization_id: string;
  enabled_modules: string[];
  organizations: { name: string } | null;
};

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return [];

  const [{ data: workspaces, error }, { data: memberships }, { data: orgRoles }] = await Promise.all([
    supabase.from("workspaces").select("id, slug, name, organization_id, enabled_modules, organizations(name)").order("name"),
    supabase.from("workspace_members").select("workspace_id, role, granted_modules").eq("user_id", userId),
    supabase.from("organization_members").select("organization_id, role").eq("user_id", userId),
  ]);
  if (error) throw new Error(`Lecture des espaces impossible : ${error.message}`);

  const rows = (workspaces ?? []) as unknown as WorkspaceRow[];
  const countByOrg = new Map<string, number>();
  rows.forEach((w) => countByOrg.set(w.organization_id, (countByOrg.get(w.organization_id) ?? 0) + 1));

  return rows.map((w) => {
    const m = memberships?.find((x) => x.workspace_id === w.id);
    const org = orgRoles?.find((x) => x.organization_id === w.organization_id);
    const role = (m?.role ?? org?.role ?? "viewer") as Role;
    return {
      id: w.id,
      slug: w.slug,
      name: w.name,
      organizationId: w.organization_id,
      organizationName: w.organizations?.name ?? "",
      organizationWorkspaceCount: countByOrg.get(w.organization_id) ?? 1,
      role,
      enabledModules: w.enabled_modules ?? [],
      grantedModules: (m?.granted_modules as string[] | undefined) ?? [],
    };
  });
}

export async function getNavCounts(workspaceId: string): Promise<NavCounts> {
  const supabase = await createSupabaseServerClient();
  const [alerts, blocked] = await Promise.all([
    supabase.from("alerts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).neq("status", "resolved"),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "blocked"),
  ]);
  return { openAlerts: alerts.count ?? 0, blockedListings: blocked.count ?? 0 };
}

export async function getSyncSummary(workspaceId: string): Promise<SyncSummary> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("connections").select("status").eq("workspace_id", workspaceId);
  return summarizeConnections((data ?? []).map((r) => r.status as ConnectionStatus));
}

export async function listConnections(workspaceId: string): Promise<Connection[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("connections")
    .select("id, workspace_id, marketplace_code, status, method, last_sync_at, token_expires_at, sync_progress, last_error, sync_frequency_minutes, marketplaces(sort_order)")
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(`Lecture des connecteurs impossible : ${error.message}`);
  type Row = {
    id: string; workspace_id: string; marketplace_code: string; status: ConnectionStatus; method: "api" | "mcp";
    last_sync_at: string | null; token_expires_at: string | null; sync_progress: number | null; last_error: string | null;
    sync_frequency_minutes: 15 | 60 | 1440; marketplaces: { sort_order: number } | null;
  };
  return ((data ?? []) as unknown as Row[])
    .sort((a, b) => (a.marketplaces?.sort_order ?? 99) - (b.marketplaces?.sort_order ?? 99))
    .map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      marketplace: r.marketplace_code as MarketplaceCode,
      status: r.status,
      method: r.method,
      lastSyncAt: r.last_sync_at,
      tokenExpiresAt: r.token_expires_at,
      syncProgress: r.sync_progress,
      lastError: r.last_error,
      syncFrequencyMinutes: r.sync_frequency_minutes,
    }));
}

export async function listMembers(workspaceId: string): Promise<Member[]> {
  const supabase = await createSupabaseServerClient();
  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, granted_modules")
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(`Lecture des membres impossible : ${error.message}`);
  const ids = (members ?? []).map((m) => m.user_id as string);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] as { id: string; full_name: string }[] };
  return (members ?? []).map((m) => ({
    userId: m.user_id as string,
    fullName: profiles?.find((p) => p.id === m.user_id)?.full_name || "Membre",
    email: "",
    role: m.role as Role,
    grantedModules: (m.granted_modules as string[]) ?? [],
  }));
}
