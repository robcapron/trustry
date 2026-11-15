"use server";

import { revalidatePath } from "next/cache";
import { canManageMembers } from "@/domain/access";
import { isDemoMode } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { getWorkspace } from "@/server/data";
import { seedWorkspaceFromDemo } from "@/server/demo/seed-supabase";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type SeedState = { ok?: string; error?: string };

/** Charge les données d'exemple dans un espace vide (environnement de développement uniquement). */
export async function loadDemoData(_prev: SeedState, formData: FormData): Promise<SeedState> {
  if (isDemoMode() || process.env.TRUSTRY_ALLOW_DEMO_SEED !== "1") return { error: "Action désactivée sur cet environnement." };
  const slug = String(formData.get("espace") ?? "");
  const workspace = await getWorkspace(slug);
  if (!workspace || !canManageMembers(workspace.role)) return { error: "Réservé au propriétaire ou à un admin de l'espace." };
  try {
    const supabase = await createSupabaseServerClient();
    const { rows } = await seedWorkspaceFromDemo(supabase, { id: workspace.id, slug: workspace.slug });
    revalidatePath(`/${slug}`, "layout");
    return { ok: `${formatNumber(rows)} lignes chargées.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Chargement impossible." };
  }
}
