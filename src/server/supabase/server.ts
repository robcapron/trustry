import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import { currentMcpContext } from "@/server/mcp/context";

/** Client Supabase côté serveur, au nom de l'utilisateur connecté (RLS appliquée). */
export async function createSupabaseServerClient(): Promise<Awaited<ReturnType<typeof sessionClient>>> {
  // Requête MCP authentifiée par jeton : client lié à l'espace autorisé (voir src/server/mcp/context.ts)
  const mcp = currentMcpContext();
  if (mcp) return mcp.supabase as unknown as Awaited<ReturnType<typeof sessionClient>>;
  return sessionClient();
}

async function sessionClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Appelé depuis un Server Component : le proxy rafraîchit la session.
        }
      },
    },
  });
}
