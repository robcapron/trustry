import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/trustry/page-header";
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
      <PageHeader
        eyebrow={`Module réservé - ${workspace.name}`}
        title="Import OMS"
        description="Exports CSV des marketplaces > res_partner (Odoo) > contact_ID > ExportOMS. Tout est traité dans votre navigateur."
      />
      <iframe
        src={`/${espace}/import-oms/outil`}
        title="Outil Import Commandes SDG"
        className="hidden h-[calc(100dvh-210px)] min-h-[640px] w-full rounded-card border-0 bg-asphalte lg:block"
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
