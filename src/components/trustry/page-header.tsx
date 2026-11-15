import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3.5">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-ui font-medium text-muted">{eyebrow}</p> : null}
        <h1 className="text-[28px] leading-[1.1] font-bold tracking-[-0.03em] lg:text-display">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
