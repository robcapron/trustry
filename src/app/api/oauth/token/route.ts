import { exchangeCode, OAuthError, refreshTokens } from "@/server/mcp/auth";
import { CORS, jsonResponse } from "@/server/mcp/http";
import { createSupabaseAdminClient, hasAdminAccess } from "@/server/supabase/admin";

/** Point de jeton OAuth 2.1 : code d'autorisation + PKCE, ou rafraîchissement (rotation). */
export async function POST(req: Request) {
  if (!hasAdminAccess()) return jsonResponse({ error: "temporarily_unavailable" }, 503);
  const type = req.headers.get("content-type") ?? "";
  const raw = type.includes("application/json") ? await req.json().catch(() => ({})) : Object.fromEntries(await req.formData().catch(() => new FormData()));
  const p = raw as Record<string, string | undefined>;
  const supabase = createSupabaseAdminClient();
  try {
    if (p.grant_type === "authorization_code") {
      if (!p.code || !p.client_id || !p.redirect_uri || !p.code_verifier) throw new OAuthError("invalid_request", "Paramètres manquants");
      return jsonResponse(await exchangeCode(supabase, { code: p.code, clientId: p.client_id, redirectUri: p.redirect_uri, codeVerifier: p.code_verifier }));
    }
    if (p.grant_type === "refresh_token") {
      if (!p.refresh_token || !p.client_id) throw new OAuthError("invalid_request", "Paramètres manquants");
      return jsonResponse(await refreshTokens(supabase, { refreshToken: p.refresh_token, clientId: p.client_id }));
    }
    throw new OAuthError("unsupported_grant_type", "Type d'autorisation non géré");
  } catch (e) {
    if (e instanceof OAuthError) return jsonResponse({ error: e.code, error_description: e.message }, 400);
    return jsonResponse({ error: "server_error" }, 500);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
