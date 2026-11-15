import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/env";
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
