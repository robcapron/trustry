import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isDemoMode } from "@/lib/env";
import { authenticate } from "@/server/mcp/auth";
import { runWithMcpContext } from "@/server/mcp/context";
import { CORS, jsonResponse, publicOrigin } from "@/server/mcp/http";
import { createTrustryMcpServer } from "@/server/mcp/server";
import { createSupabaseAdminClient, hasAdminAccess } from "@/server/supabase/admin";

export const maxDuration = 120;

/**
 * Serveur MCP d'un espace (Streamable HTTP, sans session). Authentification par jeton Bearer :
 * jeton OAuth obtenu via /oauth/autoriser, ou clé API Trustry de l'espace.
 */
async function handle(req: Request, ctx: RouteContext<"/api/mcp/[espace]">) {
  const { espace } = await ctx.params;
  const origin = publicOrigin(req);
  const resourceMetadata = `${origin}/.well-known/oauth-protected-resource/api/mcp/${espace}`;
  if (isDemoMode() || !hasAdminAccess()) return jsonResponse({ error: "Serveur MCP indisponible en mode démo" }, 503);

  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const unauthorized = (description: string) =>
    jsonResponse({ error: "invalid_token", error_description: description }, 401, {
      "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadata}", error="invalid_token", error_description="${description}"`,
    });
  if (!token) return unauthorized("Authentification requise");

  const supabase = createSupabaseAdminClient();
  const principal = await authenticate(supabase, token);
  if (!principal) return unauthorized("Jeton invalide, expiré ou accès retiré");
  if (principal.workspace.slug !== espace) return jsonResponse({ error: "Ce jeton donne accès à un autre espace" }, 403);

  const server = createTrustryMcpServer(principal);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  const response = await runWithMcpContext({ supabase, workspaceId: principal.workspace.id, userId: principal.userId }, () =>
    transport.handleRequest(req, { authInfo: { token, clientId: principal.via, scopes: ["trustry"], extra: { workspaceId: principal.workspace.id } } }),
  );
  for (const [k, v] of Object.entries(CORS)) response.headers.set(k, v);
  return response;
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
