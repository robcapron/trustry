import type { Metadata } from "next";
import { EmptyState } from "@/components/trustry/states";
import { requireUser } from "@/server/data";

export const metadata: Metadata = { title: "Bienvenue" };

export default async function Bienvenue() {
  const user = await requireUser();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/trustry-logo.svg" alt="Trustry" width={140} height={44} className="h-auto w-[140px]" />
      <EmptyState
        icon="lock"
        title={`Bonjour ${user.firstName || ""}`.trim() + "."}
        description="Votre compte est créé mais vous n'avez encore accès à aucun espace client. Demandez une invitation à l'administrateur de votre organisation."
      />
    </main>
  );
}
