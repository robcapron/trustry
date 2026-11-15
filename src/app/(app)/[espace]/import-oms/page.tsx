import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/trustry/states";
import { workspaceWithModule } from "@/server/access";

export const metadata: Metadata = { title: "Import OMS" };

/**
 * Module Import OMS : l'outil HTML existant de SDG, intégré tel quel.
 * Accès : module activé sur l'espace + owner/admin ou accès accordé au membre.
 */
export default async function ImportOmsPage({ params }: PageProps<"/[espace]/import-oms">) {
  const { espace } = await params;
  const workspace = await workspaceWithModule(espace, "import-oms");
  if (!workspace) notFound();

  return (
    <>
      <h1 className="sr-only">Import OMS - {workspace.name}</h1>
      <iframe
        src={`/${espace}/import-oms/outil`}
        title="Outil Import Commandes SDG"
        className="hidden h-[calc(100dvh-72px)] min-h-[640px] w-full rounded-card border-0 bg-asphalte lg:block"
      />
      <div className="lg:hidden">
        <EmptyState
          icon="monitor"
          title="Disponible sur ordinateur"
          description="L'Import OMS fonctionne par glisser-déposer de fichiers CSV et Excel : ouvrez Trustry sur votre ordinateur pour l'utiliser."
        />
      </div>
    </>
  );
}
