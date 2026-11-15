import "server-only";
import type { Role } from "@/domain/access";
import type { DashboardAlert } from "@/domain/dashboard";
import type { MetricTotals, Rollups } from "@/domain/metrics";
import type { DateRange } from "@/domain/period";
import { parisToday } from "@/lib/dates";
import { createSupabaseServerClient } from "../supabase/server";
import type { Connection, ConnectionStatus, MarketplaceCode, Member, NavCounts, PillarScore, SessionUser, SyncSummary, WorkspaceSummary } from "../types";
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

export async function getToday(): Promise<string> {
  return parisToday();
}

type TotalsRow = { revenue: number; commissions: number; ads: number; logistics: number; returns: number; cogs: number; units: number; orders: number };

function totals(r: TotalsRow): MetricTotals {
  return {
    revenueHt: Number(r.revenue),
    commissions: Number(r.commissions),
    ads: Number(r.ads),
    logistics: Number(r.logistics),
    returns: Number(r.returns),
    cogs: Number(r.cogs),
    units: Number(r.units),
    orders: Number(r.orders),
  };
}

export async function getRollups(workspaceId: string, range: DateRange): Promise<Rollups> {
  const supabase = await createSupabaseServerClient();
  const args = { ws: workspaceId, date_from: range.from, date_to: range.to };
  const [daily, channels, skus] = await Promise.all([
    supabase.rpc("metrics_daily", args),
    supabase.rpc("metrics_by_channel", args),
    supabase.rpc("metrics_by_sku_store", args),
  ]);
  const error = daily.error ?? channels.error ?? skus.error;
  if (error) throw new Error(`Agrégats indisponibles : ${error.message}`);
  return {
    daily: ((daily.data ?? []) as (TotalsRow & { metric_date: string })[]).map((r) => ({ ...totals(r), date: r.metric_date })),
    channels: ((channels.data ?? []) as (TotalsRow & { marketplace: string })[]).map((r) => ({ ...totals(r), marketplace: r.marketplace })),
    skus: ((skus.data ?? []) as (TotalsRow & { product_id: string; sku: string; title: string; store_id: string; marketplace: string; country: string })[]).map(
      (r) => ({
        ...totals(r),
        productId: r.product_id,
        sku: r.sku,
        title: r.title,
        storeId: r.store_id,
        marketplace: r.marketplace,
        country: r.country,
      }),
    ),
  };
}

export async function listAlerts(workspaceId: string): Promise<DashboardAlert[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("alerts")
    .select("id, severity, category, pillar, title, detail, scope, subjects, revenue_at_risk_eur_cents, suggested_action, status, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Lecture des alertes impossible : ${error.message}`);
  return (data ?? []).map((a) => ({
    id: a.id,
    severity: a.severity,
    category: a.category,
    pillar: a.pillar,
    title: a.title,
    detail: a.detail,
    scope: a.scope,
    subjects: a.subjects ?? [],
    revenueAtRiskCents: Number(a.revenue_at_risk_eur_cents),
    suggestedAction: a.suggested_action,
    status: a.status,
    createdAt: a.created_at,
  }));
}

export async function listPillarScores(workspaceId: string): Promise<PillarScore[]> {
  const supabase = await createSupabaseServerClient();
  const { data: latest } = await supabase
    .from("pillar_scores")
    .select("score_date")
    .eq("workspace_id", workspaceId)
    .order("score_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return [];
  const { data } = await supabase
    .from("pillar_scores")
    .select("pillar, score, headline, score_date")
    .eq("workspace_id", workspaceId)
    .eq("score_date", latest.score_date);
  return (data ?? []).map((p) => ({ workspaceId, date: p.score_date, pillar: p.pillar, score: p.score, headline: p.headline }));
}

export async function listBlockedListingKeys(workspaceId: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("listings").select("store_id, product_id").eq("workspace_id", workspaceId).eq("status", "blocked");
  return (data ?? []).map((l) => `${l.store_id}:${l.product_id}`);
}
