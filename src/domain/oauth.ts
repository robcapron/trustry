/** Règles OAuth 2.1 du serveur MCP (pur, testé). */
import { createHash } from "node:crypto";

export const ACCESS_TTL_SECONDS = 3600;
export const REFRESH_TTL_DAYS = 60;
export const CODE_TTL_SECONDS = 600;

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** PKCE S256 : BASE64URL(SHA256(verifier)) doit égaler le challenge. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

/** URI de retour acceptées : https, ou http sur la machine locale (clients de bureau, Claude Code). */
export function isAllowedRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}

/** Ressource MCP visée par le client : /api/mcp/<espace> -> slug de l'espace. */
export function workspaceFromResource(resource: string | null): string | null {
  if (!resource) return null;
  try {
    return /\/api\/mcp\/([a-z0-9-]+)\/?$/.exec(new URL(resource).pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}
