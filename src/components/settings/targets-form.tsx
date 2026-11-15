"use client";

import { useActionState } from "react";
import { saveTargets, type PlanState } from "@/app/(app)/[espace]/parametres/[onglet]/actions";
import { Button } from "@/components/trustry/button";

type Field = { name: string; label: string; suffix: string; value: string; hint?: string };

function Input({ field, disabled }: { field: Field; disabled: boolean }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-meta font-medium text-ink-2">{field.label}</span>
      <span className="flex h-10 items-center rounded-full bg-blanc px-4 focus-within:ring-2 focus-within:ring-carbone">
        <input
          name={field.name}
          defaultValue={field.value}
          inputMode="decimal"
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent text-ui tabular outline-none disabled:text-muted"
        />
        <span className="text-ui text-muted">{field.suffix}</span>
      </span>
      {field.hint ? <span className="text-caption text-muted">{field.hint}</span> : null}
    </label>
  );
}

export function TargetsForm({
  espace,
  monthLabel,
  money,
  rates,
  canEdit,
}: {
  espace: string;
  monthLabel: string;
  money: Field[];
  rates: Field[];
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<PlanState, FormData>(saveTargets, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="espace" value={espace} />
      <div>
        <h3 className="mb-2.5 text-ui font-semibold capitalize">{monthLabel}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {money.map((f) => (
            <Input key={f.name} field={f} disabled={!canEdit} />
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-2.5 text-ui font-semibold">Cibles par pôle (revue mensuelle)</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rates.map((f) => (
            <Input key={f.name} field={f} disabled={!canEdit} />
          ))}
        </div>
      </div>
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" size="sm" disabled={pending}>
            {pending ? "Enregistrement..." : "Enregistrer"}
          </Button>
          {state.ok ? <span className="text-meta text-bon">{state.ok}</span> : null}
          {state.error ? <span className="text-meta text-critique">{state.error}</span> : null}
        </div>
      ) : (
        <p className="text-meta text-muted">Modifiable par le propriétaire ou un admin de l&apos;espace.</p>
      )}
    </form>
  );
}
