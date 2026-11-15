"use client";

import { Button } from "@/components/trustry/button";
import { EmptyState } from "@/components/trustry/states";

export default function WorkspaceError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <EmptyState
      icon="refresh"
      title="Impossible de charger cet écran"
      description={`Les données n'ont pas pu être récupérées. Réessayez dans un instant.${error.digest ? ` (réf. ${error.digest})` : ""}`}
      action={
        <Button variant="primary" onClick={() => retry()}>
          Réessayer
        </Button>
      }
    />
  );
}
