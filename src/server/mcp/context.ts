import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Contexte d'une requête MCP. Le jeton OAuth ou la clé API a déjà été vérifié et lié à un espace ;
 * les fonctions de données (src/server/data) utilisent alors ce client au lieu de la session
 * navigateur. Chaque outil ne passe QUE l'identifiant de l'espace autorisé.
 */
export type McpContext = { supabase: SupabaseClient; workspaceId: string; userId: string | null };

const storage = new AsyncLocalStorage<McpContext>();

export function runWithMcpContext<T>(ctx: McpContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function currentMcpContext(): McpContext | undefined {
  return storage.getStore();
}
