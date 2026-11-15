import { authorizationServerMetadata, jsonResponse, publicOrigin } from "@/server/mcp/http";

/** RFC 8414 : métadonnées du serveur d'autorisation OAuth 2.1 de Trustry. */
export function GET(req: Request) {
  return jsonResponse(authorizationServerMetadata(publicOrigin(req)));
}
