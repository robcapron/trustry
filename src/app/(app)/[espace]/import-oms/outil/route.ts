import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { workspaceWithModule } from "@/server/access";
import { getCurrentUser } from "@/server/data";

let cachedHtml: string | null = null;

async function loadTool(): Promise<string> {
  if (!cachedHtml) {
    cachedHtml = await readFile(path.join(process.cwd(), "src/modules/import-oms/Import_Commandes_SDG.html"), "utf8");
  }
  return cachedHtml;
}

/** Sert l'outil HTML uniquement aux membres autorisés (jamais via /public). */
export async function GET(_request: NextRequest, { params }: RouteContext<"/[espace]/import-oms/outil">) {
  const { espace } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non connecté", { status: 401 });
  const workspace = await workspaceWithModule(espace, "import-oms");
  if (!workspace) return new NextResponse("Accès refusé", { status: 404 });

  return new NextResponse(await loadTool(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "same-origin",
    },
  });
}
