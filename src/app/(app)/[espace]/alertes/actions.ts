"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ALERT_STATUSES } from "@/domain/alerts";
import { canEdit } from "@/domain/access";
import { decideActionRequest, getWorkspace, setAlertStatus } from "@/server/data";

const schema = z.object({
  espace: z.string().min(1),
  alerte: z.uuid(),
  statut: z.enum(ALERT_STATUSES),
});

export type AlertActionState = { error?: string };

/** Change le statut d'une alerte (à traiter, en cours, résolu). Lecture seule : refusé. */
export async function updateAlertStatus(_prev: AlertActionState, formData: FormData): Promise<AlertActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Requête invalide." };
  const workspace = await getWorkspace(parsed.data.espace);
  if (!workspace) return { error: "Espace introuvable." };
  if (!canEdit(workspace.role)) return { error: "Votre rôle (lecture seule) ne permet pas de modifier les alertes." };
  try {
    await setAlertStatus(workspace.id, parsed.data.alerte, parsed.data.statut);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Mise à jour impossible." };
  }
  revalidatePath(`/${parsed.data.espace}`, "layout");
  return {};
}

const decisionSchema = z.object({ espace: z.string().min(1), demande: z.string().min(1), decision: z.enum(["approve", "reject", "done"]) });

/** Valide, refuse ou clôt une demande d'action de Claude (owner, admin, manager). */
export async function decideClaudeRequest(_prev: AlertActionState, formData: FormData): Promise<AlertActionState> {
  const parsed = decisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Requête invalide." };
  const workspace = await getWorkspace(parsed.data.espace);
  if (!workspace || !canEdit(workspace.role)) return { error: "Votre rôle ne permet pas de valider les demandes." };
  try {
    await decideActionRequest(workspace.id, parsed.data.demande, parsed.data.decision);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Validation impossible." };
  }
  revalidatePath(`/${parsed.data.espace}`, "layout");
  return {};
}
