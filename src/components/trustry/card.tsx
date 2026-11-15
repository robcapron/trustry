import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Carte arrondie 20 px sans bordure, fond #F5F5F7 (variante sombre pour le KPI principal). */
export function Card({
  className,
  tone = "surface",
  ...props
}: HTMLAttributes<HTMLElement> & { tone?: "surface" | "dark" | "white" }) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-card px-6 py-[22px]",
        tone === "surface" && "bg-surface",
        tone === "dark" && "bg-carbone text-blanc",
        tone === "white" && "bg-blanc",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3.5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-title font-semibold tracking-[-0.015em] text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-ui text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
