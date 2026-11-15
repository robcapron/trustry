import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "critique" | "important" | "bon" | "info" | "neutre";

const TONES: Record<Tone, { bg: string; fg: string; dot: string }> = {
  critique: { bg: "bg-critique-soft", fg: "text-critique", dot: "bg-critique" },
  important: { bg: "bg-important-soft", fg: "text-important", dot: "bg-important" },
  bon: { bg: "bg-bon-soft", fg: "text-bon", dot: "bg-bon" },
  info: { bg: "bg-info-soft", fg: "text-info", dot: "bg-info" },
  neutre: { bg: "bg-asphalte", fg: "text-ink-2", dot: "bg-muted" },
};

/** Pastille de statut : toujours un libellé, jamais la couleur seule. */
export function StatusBadge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  const t = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-[9px] py-[3px] text-caption font-semibold",
        t.bg,
        t.fg,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", t.dot)} />
      {children}
    </span>
  );
}

/** Évolution (+12,4 %) : vert si favorable, rouge sinon. Variante fluo sur fond carbone. */
export function DeltaBadge({
  children,
  positive,
  onDark = false,
}: {
  children: ReactNode;
  positive: boolean;
  onDark?: boolean;
}) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold",
        onDark ? "bg-fluo text-carbone" : positive ? "bg-bon-soft text-bon" : "bg-critique-soft text-critique",
      )}
    >
      {children}
    </span>
  );
}

/** Compteur de navigation (fond carbone, texte fluo). */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "grid h-5 min-w-5 place-items-center rounded-[10px] bg-carbone px-1.5 text-2xs font-semibold text-fluo",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Code SKU / identifiant en police mono sur fond gris. */
export function Code({ children, className }: { children: ReactNode; className?: string }) {
  return <code className={cn("inline-block rounded-chip bg-surface px-[7px] py-px font-mono text-2xs", className)}>{children}</code>;
}
