import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";
import { updateSession } from "@/server/supabase/proxy-session";

export async function proxy(request: NextRequest) {
  if (isDemoMode()) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques et les icônes
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|icons/|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
