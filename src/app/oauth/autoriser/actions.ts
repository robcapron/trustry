"use server";

import { redirect } from "next/navigation";
import { isAllowedRedirectUri } from "@/domain/oauth";
import { getCurrentUser, getWorkspace } from "@/server/data";
import { createAuthorizationCode, getClient } from "@/server/mcp/auth";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

function back(redirectUri: string, params: Record<string, string>) {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  redirect(url.toString());
}

/** Accord de l'utilisateur : code d'autorisation à usage unique (10 min), lié à l'espace choisi. */
export async function decide(formData: FormData) {
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = String(formData.get("state") ?? "");
  const challenge = String(formData.get("code_challenge") ?? "");
  const slug = String(formData.get("espace") ?? "");
  const supabase = createSupabaseAdminClient();
  const client = await getClient(supabase, clientId);
  if (!client || !client.redirect_uris.includes(redirectUri) || !isAllowedRedirectUri(redirectUri)) throw new Error("Client OAuth invalide");
  if (formData.get("decision") !== "autoriser") back(redirectUri, { error: "access_denied", state });
  const [user, workspace] = await Promise.all([getCurrentUser(), getWorkspace(slug)]);
  if (!user || !workspace) back(redirectUri, { error: "access_denied", state });
  const code = await createAuthorizationCode(supabase, { clientId, userId: user!.id, workspaceId: workspace!.id, redirectUri, codeChallenge: challenge });
  back(redirectUri, { code, state });
}
