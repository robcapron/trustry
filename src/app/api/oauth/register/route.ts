import { isAllowedRedirectUri } from "@/domain/oauth";
import { registerClient } from "@/server/mcp/auth";
import { CORS, jsonResponse } from "@/server/mcp/http";
import { createSupabaseAdminClient, hasAdminAccess } from "@/server/supabase/admin";

/** RFC 7591 : enregistrement dynamique d'un client MCP public (PKCE obligatoire, pas de secret). */
export async function POST(req: Request) {
  if (!hasAdminAccess()) return jsonResponse({ error: "temporarily_unavailable" }, 503);
  const body = (await req.json().catch(() => null)) as { client_name?: string; redirect_uris?: unknown } | null;
  const uris = Array.isArray(body?.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (!uris.length || uris.length > 10 || !uris.every(isAllowedRedirectUri)) {
    return jsonResponse({ error: "invalid_redirect_uri", error_description: "URI de retour https (ou localhost) obligatoire" }, 400);
  }
  const clientName = typeof body?.client_name === "string" && body.client_name.trim() ? body.client_name.trim() : "Client MCP";
  const clientId = await registerClient(createSupabaseAdminClient(), { clientName, redirectUris: uris });
  return jsonResponse(
    {
      client_id: clientId,
      client_name: clientName,
      redirect_uris: uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    201,
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
