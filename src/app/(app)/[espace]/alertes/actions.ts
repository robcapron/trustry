"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ALERT_STATUSES } from "@/domain/alerts";
import { canEdit } from "@/domain/access";
import { getWorkspace, setAlertStatus } from "@/server/data";

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
