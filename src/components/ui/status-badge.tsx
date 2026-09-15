import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "accent";

const dotTone: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  accent: "bg-accent",
};

/**
 * Order/payment/settlement status chip (docs/07-DESIGN-SYSTEM.md §46):
 * colour + text, never colour alone. The label always renders in
 * `--foreground`, not the tone colour — only the dot carries the status
 * colour, which sidesteps the contrast issues coloured text has on
 * tinted/muted admin surfaces (see docs/07-DESIGN-SYSTEM.md contrast
 * notes for --warning).
 */
export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "border-border bg-surface text-foreground inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs font-medium",
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", dotTone[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}
