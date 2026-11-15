"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/trustry/icons";
import type { NavCounts } from "@/server/types";
import { NAV_MOBILE, isActive } from "./nav-config";
import { WorkspaceSwitcher, type SwitcherWorkspace } from "./workspace-switcher";

/** Barre du haut sur iPhone : logo + sélecteur d'espace. */
export function MobileTopBar({
  current,
  workspaces,
  userEmail,
}: {
  current: SwitcherWorkspace;
  workspaces: SwitcherWorkspace[];
  userEmail: string;
}) {
  return (
    <header className="safe-top sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-blanc/90 px-4 py-2.5 backdrop-blur lg:hidden">
      <Link href={`/${current.slug}/dashboard`} aria-label="Trustry - Dashboard" className="flex-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/trustry-logo.svg" alt="Trustry" width={96} height={30} className="h-auto w-24" />
      </Link>
      <WorkspaceSwitcher current={current} workspaces={workspaces} userEmail={userEmail} compact />
    </header>
  );
}

/** Barre d'onglets en bas sur iPhone. */
export function MobileTabBar({ slug, counts }: { slug: string; counts: NavCounts }) {
  const pathname = usePathname();
  const onPillar = pathname.startsWith(`/${slug}/piliers`);
  const onMore = pathname.startsWith(`/${slug}/plus`) || pathname.startsWith(`/${slug}/parametres`);
  return (
    <nav
      aria-label="Navigation mobile"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-blanc/95 backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {NAV_MOBILE.map((item) => {
          const active =
            item.key === "piliers" ? onPillar : item.key === "plus" ? onMore : isActive(pathname, slug, item);
          const count = item.badge === "alerts" ? counts.openAlerts : 0;
          return (
            <li key={item.key}>
              <Link
                href={`/${slug}${item.path}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-2xs",
                  active ? "font-semibold text-ink" : "font-medium text-muted",
                )}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full", active && "bg-fluo text-carbone")}>
                  <Icon name={item.icon} size={20} />
                </span>
                {item.label}
                {count > 0 ? (
                  <span className="absolute top-1.5 left-[calc(50%+6px)] grid h-4 min-w-4 place-items-center rounded-full bg-carbone px-1 text-[10px] font-semibold text-fluo">
                    {count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
