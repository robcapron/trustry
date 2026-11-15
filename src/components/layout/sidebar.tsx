"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CountBadge } from "@/components/trustry/badge";
import { Icon } from "@/components/trustry/icons";
import type { NavCounts } from "@/server/types";
import { NAV_BOTTOM, NAV_PILLARS, NAV_TOP, isActive, type NavItem } from "./nav-config";
import { WorkspaceSwitcher, type SwitcherWorkspace } from "./workspace-switcher";

function NavLink({ item, slug, counts }: { item: NavItem; slug: string; counts: NavCounts }) {
  const pathname = usePathname();
  const active = isActive(pathname, slug, item);
  const count = item.badge === "alerts" ? counts.openAlerts : item.badge === "blocked" ? counts.blockedListings : 0;
  return (
    <Link
      href={`/${slug}${item.path}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-nav px-3 py-2 text-nav",
        active ? "bg-blanc font-semibold text-ink shadow-nav-active" : "font-medium text-ink-2 hover:bg-blanc/60",
      )}
    >
      <Icon name={item.icon} />
      <span className="min-w-0 flex-1">{item.label}</span>
      {item.badge ? <CountBadge count={count} /> : null}
    </Link>
  );
}

export function Sidebar({
  current,
  workspaces,
  counts,
  userEmail,
  modules,
}: {
  current: SwitcherWorkspace;
  workspaces: SwitcherWorkspace[];
  counts: NavCounts;
  userEmail: string;
  /** modules accessibles à l'utilisateur dans cet espace */
  modules: string[];
}) {
  const top = NAV_TOP.filter((i) => !i.module || modules.includes(i.module));
  return (
    <nav
      aria-label="Navigation principale"
      className="sticky top-0 hidden h-dvh w-[256px] flex-none flex-col gap-0.5 overflow-y-auto bg-surface px-4 py-[26px] lg:flex"
    >
      <Link href={`/${current.slug}/dashboard`} className="mx-2 mb-[22px] block w-[124px]" aria-label="Trustry - Dashboard">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/trustry-logo.svg" alt="Trustry" width={124} height={39} className="h-auto w-[124px]" />
      </Link>
      <div className="mb-3.5">
        <WorkspaceSwitcher current={current} workspaces={workspaces} userEmail={userEmail} />
      </div>
      {top.map((item) => (
        <NavLink key={item.key} item={item} slug={current.slug} counts={counts} />
      ))}
      <p className="mx-3 mt-[18px] mb-1.5 text-caption font-semibold text-muted">Les 7 piliers</p>
      {NAV_PILLARS.map((item) => (
        <NavLink key={item.key} item={item} slug={current.slug} counts={counts} />
      ))}
      <div className="mt-auto flex flex-col gap-0.5 pt-[18px]">
        {NAV_BOTTOM.map((item) => (
          <NavLink key={item.key} item={item} slug={current.slug} counts={counts} />
        ))}
      </div>
    </nav>
  );
}
