import type { ReactNode } from "react";

/**
 * Restrained admin page-header composition (Phase 5 Gate 2C §2) — an
 * eyebrow, an editorial title, short explanatory text, and an optional
 * primary action, never wrapped in a Card. Used consistently across
 * every top-level admin page and create/edit form so page hierarchy
 * comes from typography and spacing, not chrome.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-border flex flex-col gap-3 border-b pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="flex flex-col gap-1.5">
        {eyebrow ? (
          <p className="text-accent text-caption font-sans tracking-widest uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-h2">{title}</h1>
        {description ? (
          <p className="text-muted-foreground text-body-sm max-w-xl font-sans">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
