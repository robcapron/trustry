import type { ReactNode } from "react";
import { Card } from "@/components/trustry/card";
import { Icon, type IconName } from "@/components/trustry/icons";
import { PageHeader } from "@/components/trustry/page-header";

/** Écran prévu dans une phase ultérieure : en-tête définitif + contenu annoncé. */
export function UpcomingScreen({
  eyebrow,
  title,
  description,
  phase,
  icon,
  features,
  children,
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  phase: string;
  icon: IconName;
  features: string[];
  children?: ReactNode;
}) {
  return (
    <>
      {title ? <PageHeader eyebrow={eyebrow} title={title} description={description} /> : null}
      {children}
      <Card className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <span className="grid size-12 flex-none place-items-center rounded-item bg-carbone text-fluo">
          <Icon name={icon} size={22} />
        </span>
        <div className="min-w-0">
          <p className="text-caption font-semibold text-muted">Arrive en {phase}</p>
          <h2 className="mt-0.5 text-title font-semibold tracking-[-0.015em]">Ce que contiendra cet écran</h2>
          <ul className="mt-3 grid gap-2 text-ui text-ink-2 sm:grid-cols-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span className="mt-0.5 text-bon">
                  <Icon name="check" size={16} strokeWidth={2} />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </>
  );
}
