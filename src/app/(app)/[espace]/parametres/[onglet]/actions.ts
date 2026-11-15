"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { canManageMembers } from "@/domain/access";
import { isDemoMode } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { getCurrentUser, getWorkspace, listMembers, members } from "@/server/data";
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

// Membres et accès -------------------------------------------------------------

const ASSIGNABLE_ROLES = ["admin", "manager", "viewer"] as const;

export type MemberActionState = { error?: string; ok?: string; link?: string };

async function adminContext(slug: string) {
  const [workspace, user] = await Promise.all([getWorkspace(slug), getCurrentUser()]);
  if (!workspace || !user) return { error: "Espace introuvable." } as const;
  if (!canManageMembers(workspace.role)) return { error: "Réservé au propriétaire ou à un admin de l'espace." } as const;
  return { workspace, user } as const;
}

const memberSchema = z.object({
  espace: z.string().min(1),
  membre: z.string().min(1),
  intent: z.enum(["role", "module", "retirer"]),
  role: z.enum(ASSIGNABLE_ROLES).optional(),
  acces: z.enum(["oui", "non"]).optional(),
});

/** Change le rôle, l'accès Import OMS ou retire un membre (jamais le propriétaire, jamais soi-même). */
export async function updateMember(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Requête invalide." };
  const ctx = await adminContext(parsed.data.espace);
  if ("error" in ctx) return { error: ctx.error };
  const { workspace, user } = ctx;
  const { membre, intent } = parsed.data;
  if (membre === user.id) return { error: "Vous ne pouvez pas modifier votre propre accès." };
  const target = (await listMembers(workspace.id)).find((m) => m.userId === membre);
  if (!target) return { error: "Membre introuvable." };
  if (target.role === "owner") return { error: "Le propriétaire de l'espace ne peut pas être modifié." };

  try {
    if (intent === "role" && parsed.data.role) await members.setRole(workspace.id, membre, parsed.data.role);
    if (intent === "module") {
      const next = parsed.data.acces === "oui"
        ? [...new Set([...target.grantedModules, "import-oms"])]
        : target.grantedModules.filter((m) => m !== "import-oms");
      await members.setModules(workspace.id, membre, next);
    }
    if (intent === "retirer") await members.remove(workspace.id, membre);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Modification impossible." };
  }
  revalidatePath(`/${parsed.data.espace}`, "layout");
  return { ok: "Modification enregistrée." };
}

const inviteSchema = z.object({
  espace: z.string().min(1),
  email: z.email({ error: "Adresse email invalide." }),
  role: z.enum(ASSIGNABLE_ROLES),
  oms: z.literal("oui").optional(),
});

/** Crée une invitation et renvoie le lien à transmettre (valable 7 jours, usage unique). */
export async function inviteMember(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const ctx = await adminContext(parsed.data.espace);
  if ("error" in ctx) return { error: ctx.error };
  try {
    const modules = parsed.data.oms && ctx.workspace.enabledModules.includes("import-oms") ? ["import-oms"] : [];
    const token = await members.invite(ctx.workspace.id, parsed.data.email, parsed.data.role, modules);
    const origin = (await headers()).get("origin") ?? "";
    revalidatePath(`/${parsed.data.espace}/parametres/utilisateurs`);
    return { ok: `Invitation créée pour ${parsed.data.email}.`, link: `${origin}/invitation/${token}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invitation impossible." };
  }
}
