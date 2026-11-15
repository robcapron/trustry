"use client";

import { DropdownMenu } from "radix-ui";
import { usePathname, useRouter } from "next/navigation";
import { ROLE_LABEL, type Role } from "@/domain/access";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/trustry/icons";

export type SwitcherWorkspace = {
  slug: string;
  name: string;
  role: Role;
  organizationName: string;
  organizationWorkspaceCount: number;
};

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      className="grid flex-none place-items-center rounded-lg bg-carbone text-2xs font-bold text-fluo"
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </span>
  );
}

/** Sélecteur d'espace client (haut du menu). Garde la même page en changeant d'espace. */
export function WorkspaceSwitcher({
  current,
  workspaces,
  userEmail,
  compact = false,
}: {
  current: SwitcherWorkspace;
  workspaces: SwitcherWorkspace[];
  userEmail: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function go(slug: string) {
    const rest = pathname.split("/").slice(2).join("/") || "dashboard";
    router.push(`/${slug}/${rest}`);
  }

  const count = current.organizationWorkspaceCount;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Espace client : ${current.name}. Changer d'espace`}
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-item border border-line bg-blanc text-left text-ui text-ink outline-none hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-carbone",
            compact ? "max-w-[60vw] px-2 py-1.5" : "w-full px-2.5 py-2",
          )}
        >
          <Avatar name={current.name} />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-semibold">{current.name}</span>
            {!compact ? (
              <span className="truncate text-caption text-muted">
                {count} {count > 1 ? "espaces clients" : "espace client"}
              </span>
            ) : null}
          </span>
          <span className="ml-auto text-muted">
            <Icon name="chevronDown" size={15} strokeWidth={1.8} />
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[272px] rounded-item border border-line bg-blanc p-1.5 shadow-[0_8px_30px_rgba(17,18,20,0.12)]"
        >
          <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 text-caption font-semibold text-muted">
            {current.organizationName || "Espaces clients"}
          </DropdownMenu.Label>
          {workspaces.map((w) => (
            <DropdownMenu.Item
              key={w.slug}
              onSelect={() => go(w.slug)}
              className="flex cursor-pointer items-center gap-2.5 rounded-nav px-2.5 py-2 text-ui outline-none data-[highlighted]:bg-surface"
            >
              <Avatar name={w.name} size={26} />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-semibold">{w.name}</span>
                <span className="text-caption text-muted">{ROLE_LABEL[w.role]}</span>
              </span>
              {w.slug === current.slug ? (
                <span className="ml-auto text-ink" aria-label="Espace actuel">
                  <Icon name="check" size={16} strokeWidth={2} />
                </span>
              ) : null}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1.5 h-px bg-line" />
          <p className="truncate px-2.5 py-1 text-caption text-muted">{userEmail}</p>
          <form action="/auth/deconnexion" method="post">
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-nav px-2.5 py-2 text-ui text-ink-2 hover:bg-surface"
            >
              <Icon name="logout" size={16} />
              Se déconnecter
            </button>
          </form>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
