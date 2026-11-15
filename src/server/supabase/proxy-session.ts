import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

// /api/inngest et /api/mcp ont leur propre authentification (signature Inngest, jeton OAuth)
const PUBLIC_PATHS = ["/connexion", "/auth", "/invitation", "/manifest.webmanifest", "/api/inngest", "/api/mcp", "/.well-known"];

/** Rafraîchit la session Supabase et redirige vers /connexion si besoin (vérification optimiste). */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    // On garde la requête complète (ex. paramètres OAuth de /oauth/autoriser) pour y revenir après connexion
    url.search = "";
    url.searchParams.set("suite", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  return response;
}
