import { jsonResponse, publicOrigin } from "@/server/mcp/http";

/** RFC 9728 : métadonnées de la ressource protégée (serveur MCP d'un espace). */
export async function GET(req: Request, ctx: RouteContext<"/.well-known/oauth-protected-resource/[[...ressource]]">) {
  const { ressource } = await ctx.params;
  const origin = publicOrigin(req);
  return jsonResponse({
    resource: `${origin}/${(ressource ?? ["api", "mcp"]).join("/")}`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: ["trustry"],
    resource_name: "Trustry",
  });
}
