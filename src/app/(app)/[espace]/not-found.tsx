import Link from "next/link";
import { Button } from "@/components/trustry/button";
import { EmptyState } from "@/components/trustry/states";

export default function NotFound() {
  return (
    <EmptyState
      icon="lock"
      title="Espace ou page introuvable"
      description="Cet espace client n'existe pas ou vous n'y avez pas accès."
      action={
        <Button asChild variant="primary">
          <Link href="/">Revenir à mon espace</Link>
        </Button>
      }
    />
  );
}
