import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";

/** État vide : explique ce qui manque et quoi faire. */
export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className,
}: {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-card bg-surface px-6 py-14 text-center", className)}>
      <span className="mb-4 grid size-12 place-items-center rounded-item bg-blanc text-ink-2">
        <Icon name={icon} size={22} />
      </span>
      <h2 className="text-title font-semibold tracking-[-0.015em]">{title}</h2>
      {description ? <p className="mt-1.5 max-w-md text-ui text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Squelette de chargement aux dimensions des cartes. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-card bg-surface", className)} />;
}

export function LoadingState({ label = "Chargement des données" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-16 w-72 rounded-item" />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-[136px] bg-asphalte" />
        <Skeleton className="h-[136px]" />
        <Skeleton className="h-[136px]" />
        <Skeleton className="h-[136px]" />
      </div>
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[3fr_2fr]">
        <Skeleton className="h-[360px]" />
        <Skeleton className="h-[360px]" />
      </div>
    </div>
  );
}

/** Erreur de synchronisation d'un connecteur (bandeau rouge des maquettes). */
export function SyncErrorState({
  title = "Erreur de synchro :",
  message,
  action,
}: {
  title?: string;
  message: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-item bg-critique-soft px-3.5 py-3 text-meta text-critique">
      <p>
        <strong className="font-semibold">{title}</strong> {message}
      </p>
      {action}
    </div>
  );
}
