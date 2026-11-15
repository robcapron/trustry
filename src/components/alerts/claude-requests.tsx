"use client";

import { useActionState } from "react";
import { decideClaudeRequest, type AlertActionState } from "@/app/(app)/[espace]/alertes/actions";
import { StatusBadge } from "@/components/trustry/badge";
import { Button } from "@/components/trustry/button";
import { Card, CardHeader } from "@/components/trustry/card";
import { formatRelative } from "@/lib/format";
import type { ActionRequest } from "@/server/types";

function Row({ espace, request, canEdit }: { espace: string; request: ActionRequest; canEdit: boolean }) {
  const [state, action, pending] = useActionState<AlertActionState, FormData>(decideClaudeRequest, {});
  const detail = typeof request.payload.detail === "string" ? request.payload.detail : null;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-0">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-ui font-semibold">
          {request.title}
          <StatusBadge tone={request.status === "pending" ? "important" : "info"}>{request.status === "pending" ? "À valider" : "Validée - à exécuter"}</StatusBadge>
        </p>
        {detail ? <p className="mt-0.5 text-meta text-ink-2">{detail}</p> : null}
        <p className="mt-0.5 text-caption text-muted">
          Demandée par Claude {formatRelative(new Date(request.createdAt))}
          {request.via === "api_key" ? " (clé API)" : ""}
        </p>
        {state.error ? <p className="text-meta text-critique">{state.error}</p> : null}
      </div>
      {canEdit ? (
        <form action={action} className="flex gap-2">
          <input type="hidden" name="espace" value={espace} />
          <input type="hidden" name="demande" value={request.id} />
          {request.status === "pending" ? (
            <>
              <Button type="submit" name="decision" value="approve" size="sm" variant="primary" disabled={pending}>
                Valider
              </Button>
              <Button type="submit" name="decision" value="reject" size="sm" variant="secondary" disabled={pending}>
                Refuser
              </Button>
            </>
          ) : (
            <Button type="submit" name="decision" value="done" size="sm" variant="secondary" disabled={pending}>
              Marquer comme fait
            </Button>
          )}
        </form>
      ) : null}
    </li>
  );
}

export function ClaudeRequests({ espace, requests, canEdit }: { espace: string; requests: ActionRequest[]; canEdit: boolean }) {
  if (!requests.length) return null;
  const waiting = requests.filter((r) => r.status === "pending").length;
  return (
    <Card>
      <CardHeader
        title="Demandes de Claude"
        subtitle="Actions préparées par Claude via le serveur MCP : rien n'est fait sans votre validation."
        action={waiting ? <StatusBadge tone="important">{`${waiting} à valider`}</StatusBadge> : undefined}
      />
      <ul>
        {requests.map((r) => (
          <Row key={r.id} espace={espace} request={r} canEdit={canEdit} />
        ))}
      </ul>
    </Card>
  );
}
