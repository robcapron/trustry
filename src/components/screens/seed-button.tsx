"use client";

import { useActionState } from "react";
import { Button } from "@/components/trustry/button";
import { loadDemoData, type SeedState } from "@/app/(app)/[espace]/parametres/[onglet]/actions";

export function SeedButton({ espace }: { espace: string }) {
  const [state, action, pending] = useActionState<SeedState, FormData>(loadDemoData, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="espace" value={espace} />
      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? "Chargement..." : "Charger les données d'exemple"}
      </Button>
      {state.ok ? <span className="text-meta text-bon">{state.ok}</span> : null}
      {state.error ? <span className="text-meta text-critique">{state.error}</span> : null}
    </form>
  );
}
