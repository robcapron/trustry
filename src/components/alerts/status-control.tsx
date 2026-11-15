"use client";

import { useActionState } from "react";
import { STATUS_LABEL, ALERT_STATUSES, type AlertStatus } from "@/domain/alerts";
import { cn } from "@/lib/utils";
import { updateAlertStatus, type AlertActionState } from "@/app/(app)/[espace]/alertes/actions";

/** Statut d'une alerte : 3 pilules (à traiter, en cours, résolu). */
export function StatusControl({ espace, alertId, status, readOnly }: { espace: string; alertId: string; status: AlertStatus; readOnly: boolean }) {
  const [state, action, pending] = useActionState<AlertActionState, FormData>(updateAlertStatus, {});
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="espace" value={espace} />
      <input type="hidden" name="alerte" value={alertId} />
      <div role="group" aria-label="Statut de l'alerte" className="flex rounded-full bg-surface p-1">
        {ALERT_STATUSES.map((s) => (
          <button
            key={s}
            type="submit"
            name="statut"
            value={s}
            disabled={readOnly || pending || s === status}
            aria-pressed={s === status}
            className={cn(
              "h-7 rounded-2xl px-2.5 text-caption whitespace-nowrap",
              s === status ? "bg-blanc font-semibold text-ink shadow-segment" : "text-muted enabled:cursor-pointer enabled:hover:text-ink",
              readOnly && s !== status && "opacity-50",
            )}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {state.error ? <p className="text-caption text-critique">{state.error}</p> : null}
    </form>
  );
}
