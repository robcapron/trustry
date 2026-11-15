import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/trustry/icons";
import { PageHeader } from "@/components/trustry/page-header";
import { CountBadge } from "@/components/trustry/badge";
import { PILLARS } from "@/domain/pillars";
import { getNavCounts, getWorkspace } from "@/server/data";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Les 7 piliers" };

/** Liste des 7 piliers (point d'entrée mobile). */
export default async function PiliersPage({ params }: PageProps<"/[espace]/piliers">) {
  const { espace } = await params;
  const workspace = await getWorkspace(espace);
  if (!workspace) notFound();
  const counts = await getNavCounts(workspace.id);
  return (
    <>
      <PageHeader title="Les 7 piliers" description="La santé de chaque pilier de la gestion marketplace." />
      <ul className="flex flex-col gap-2">
        {PILLARS.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/${espace}/piliers/${p.slug}`}
              className="flex items-center gap-3 rounded-item bg-surface px-4 py-3.5 hover:brightness-[0.98]"
            >
              <span className="grid size-[22px] flex-none place-items-center rounded-md bg-carbone text-2xs font-bold text-fluo">
                {p.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-nav font-semibold">{p.navLabel}</span>
                <span className="block truncate text-caption text-muted">{p.description}</span>
              </span>
              {p.number === 4 ? <CountBadge count={counts.blockedListings} /> : null}
              <span className="text-muted">
                <Icon name="chevronRight" size={16} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
