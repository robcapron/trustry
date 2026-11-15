import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/domain/access";
import { ACCESS_TTL_SECONDS, CODE_TTL_SECONDS, REFRESH_TTL_DAYS, sha256Hex, verifyPkce } from "@/domain/oauth";
import type { McpPermission } from "@/server/types";

export type McpPrincipal = {
  userId: string | null;
  workspace: { id: string; slug: string; name: string; mcpPermission: McpPermission };
  role: Role;
  via: "oauth" | "api_key";
};

async function workspaceById(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from("workspaces").select("id, slug, name, mcp_permission").eq("id", id).maybeSingle();
  return data ? { id: data.id as string, slug: data.slug as string, name: data.name as string, mcpPermission: data.mcp_permission as McpPermission } : null;
}

/**
 * Vérifie un jeton Bearer : jeton OAuth (lié à un utilisateur et un espace, rôle relu à chaque appel)
 * ou clé API Trustry (droits d'admin de l'espace, pour les outils internes).
 */
export async function authenticate(supabase: SupabaseClient, token: string): Promise<McpPrincipal | null> {
  if (!token || token.length > 512) return null;
  const hash = sha256Hex(token);
  const now = new Date().toISOString();

  if (token.startsWith("trs_live_")) {
    const { data: key } = await supabase.from("api_keys").select("id, workspace_id").eq("key_hash", hash).is("revoked_at", null).maybeSingle();
    if (!key) return null;
    const workspace = await workspaceById(supabase, key.workspace_id);
    if (!workspace) return null;
    await supabase.from("api_keys").update({ last_used_at: now }).eq("id", key.id);
    return { userId: null, workspace, role: "admin", via: "api_key" };
  }

  const { data: t } = await supabase
    .from("mcp_tokens")
    .select("id, user_id, workspace_id, expires_at")
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .maybeSingle();
  if (!t) return null;
  // L'accès suit le rôle actuel : un membre retiré de l'espace perd l'accès immédiatement
  const { data: member } = await supabase.from("workspace_members").select("role").eq("workspace_id", t.workspace_id).eq("user_id", t.user_id).maybeSingle();
  if (!member) return null;
  const workspace = await workspaceById(supabase, t.workspace_id);
  if (!workspace) return null;
  await supabase.from("mcp_tokens").update({ last_used_at: now }).eq("id", t.id);
  return { userId: t.user_id, workspace, role: member.role as Role, via: "oauth" };
}

const token = (prefix: string) => `${prefix}_${randomBytes(32).toString("base64url")}`;

export async function registerClient(supabase: SupabaseClient, input: { clientName: string; redirectUris: string[] }) {
  const clientId = `trustry-${randomBytes(12).toString("hex")}`;
  const { error } = await supabase.from("oauth_clients").insert({ client_id: clientId, client_name: input.clientName.slice(0, 120), redirect_uris: input.redirectUris });
  if (error) throw new Error(error.message);
  return clientId;
}

export async function getClient(supabase: SupabaseClient, clientId: string) {
  const { data } = await supabase.from("oauth_clients").select("client_id, client_name, redirect_uris").eq("client_id", clientId).maybeSingle();
  return data as { client_id: string; client_name: string; redirect_uris: string[] } | null;
}

export async function createAuthorizationCode(
  supabase: SupabaseClient,
  input: { clientId: string; userId: string; workspaceId: string; redirectUri: string; codeChallenge: string },
) {
  const code = token("trc");
  const { error } = await supabase.from("oauth_codes").insert({
    code_hash: sha256Hex(code),
    client_id: input.clientId,
    user_id: input.userId,
    workspace_id: input.workspaceId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    expires_at: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return code;
}

export type TokenResponse = { access_token: string; token_type: "Bearer"; expires_in: number; refresh_token: string; scope: string };
export class OAuthError extends Error {
  constructor(
    readonly code: "invalid_request" | "invalid_grant" | "invalid_client" | "unsupported_grant_type",
    message: string,
  ) {
    super(message);
  }
}

async function issueTokens(supabase: SupabaseClient, input: { clientId: string; userId: string; workspaceId: string }): Promise<TokenResponse> {
  const access = token("trs_mcp");
  const refresh = token("trs_ref");
  const { error } = await supabase.from("mcp_tokens").insert({
    workspace_id: input.workspaceId,
    user_id: input.userId,
    client_id: input.clientId,
    token_hash: sha256Hex(access),
    refresh_hash: sha256Hex(refresh),
    expires_at: new Date(Date.now() + ACCESS_TTL_SECONDS * 1000).toISOString(),
    refresh_expires_at: new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_SECONDS, refresh_token: refresh, scope: "trustry" };
}

export async function exchangeCode(supabase: SupabaseClient, input: { code: string; clientId: string; redirectUri: string; codeVerifier: string }) {
  const { data: c } = await supabase.from("oauth_codes").select("*").eq("code_hash", sha256Hex(input.code)).maybeSingle();
  if (!c || c.used_at || new Date(c.expires_at) < new Date()) throw new OAuthError("invalid_grant", "Code invalide ou expiré");
  if (c.client_id !== input.clientId || c.redirect_uri !== input.redirectUri) throw new OAuthError("invalid_grant", "Client ou redirect_uri différent");
  if (!verifyPkce(input.codeVerifier, c.code_challenge)) throw new OAuthError("invalid_grant", "PKCE invalide");
  // Usage unique : marqué avant d'émettre les jetons
  const { data: used } = await supabase.from("oauth_codes").update({ used_at: new Date().toISOString() }).eq("code_hash", c.code_hash).is("used_at", null).select("code_hash");
  if (!used?.length) throw new OAuthError("invalid_grant", "Code déjà utilisé");
  return issueTokens(supabase, { clientId: c.client_id, userId: c.user_id, workspaceId: c.workspace_id });
}

/** Rotation : l'ancien jeton est révoqué à chaque rafraîchissement. */
export async function refreshTokens(supabase: SupabaseClient, input: { refreshToken: string; clientId: string }) {
  const { data: t } = await supabase
    .from("mcp_tokens")
    .select("id, client_id, user_id, workspace_id, refresh_expires_at, revoked_at")
    .eq("refresh_hash", sha256Hex(input.refreshToken))
    .maybeSingle();
  if (!t || t.revoked_at || new Date(t.refresh_expires_at) < new Date() || t.client_id !== input.clientId) {
    throw new OAuthError("invalid_grant", "Jeton de rafraîchissement invalide");
  }
  await supabase.from("mcp_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", t.id);
  return issueTokens(supabase, { clientId: t.client_id, userId: t.user_id, workspaceId: t.workspace_id });
}
