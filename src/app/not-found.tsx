import Link from "next/link";
import { Button } from "@/components/trustry/button";
import { EmptyState } from "@/components/trustry/states";

export default function RootNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/trustry-logo.svg" alt="Trustry" width={140} height={44} className="h-auto w-[140px]" />
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
    </main>
  );
}
