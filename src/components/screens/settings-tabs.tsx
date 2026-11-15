import Link from "next/link";
import { cn } from "@/lib/utils";

export const SETTINGS_TABS = [
  { slug: "connecteurs", label: "Connecteurs" },
  { slug: "espace", label: "Espace client" },
  { slug: "utilisateurs", label: "Utilisateurs et rôles" },
  { slug: "alertes", label: "Alertes et notifications" },
  { slug: "facturation", label: "Facturation" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["slug"];

export function SettingsTabs({ espace, active }: { espace: string; active: SettingsTab }) {
  return (
    <nav aria-label="Paramètres" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-7 border-b border-line">
        {SETTINGS_TABS.map((t) => (
          <li key={t.slug}>
            <Link
              href={`/${espace}/parametres/${t.slug}`}
              aria-current={t.slug === active ? "page" : undefined}
              className={cn(
                "-mb-px block border-b-2 px-0.5 py-2.5 text-sm whitespace-nowrap",
                t.slug === active ? "border-carbone font-semibold text-ink" : "border-transparent font-medium text-muted hover:text-ink",
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
