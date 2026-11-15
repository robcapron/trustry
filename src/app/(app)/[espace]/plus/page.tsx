import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/trustry/icons";
import { PageHeader } from "@/components/trustry/page-header";

export const metadata: Metadata = { title: "Plus" };

/** Menu "Plus" de la barre mobile. */
export default async function PlusPage({ params }: PageProps<"/[espace]/plus">) {
  const { espace } = await params;
  const links: { href: string; label: string; icon: IconName; hint?: string }[] = [
    { href: `/${espace}/revue-mensuelle`, label: "Revue mensuelle", icon: "calendar", hint: "Acquisition, retours, logistique" },
    { href: `/${espace}/parametres/connecteurs`, label: "Connecteurs", icon: "connecteurs", hint: "Statut et reconnexion" },
    { href: `/${espace}/parametres/espace`, label: "Paramètres", icon: "parametres" },
  ];
  return (
    <>
      <PageHeader title="Plus" />
      <ul className="flex flex-col gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex items-center gap-3 rounded-item bg-surface px-4 py-3.5">
              <Icon name={l.icon} />
              <span className="flex-1">
                <span className="block text-nav font-semibold">{l.label}</span>
                {l.hint ? <span className="block text-caption text-muted">{l.hint}</span> : null}
              </span>
              <Icon name="chevronRight" size={16} className="text-muted" />
            </Link>
          </li>
        ))}
        <li>
          <form action="/auth/deconnexion" method="post">
            <button type="submit" className="flex w-full items-center gap-3 rounded-item bg-surface px-4 py-3.5 text-left text-nav font-semibold text-critique">
              <Icon name="logout" />
              Se déconnecter
            </button>
          </form>
        </li>
      </ul>
    </>
  );
}
