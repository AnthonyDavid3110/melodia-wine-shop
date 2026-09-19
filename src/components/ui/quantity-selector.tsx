"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantitySelectorProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  /**
   * `inverted` reads legibly on a dark/accent background (e.g. the
   * oxblood Discovery Box band) — same structure and behavior, just
   * light-on-dark instead of dark-on-light. Added for Phase 6 rather
   * than duplicating the whole component for one dark-background use.
   */
  tone?: "default" | "inverted";
}

const TONE_CLASSES: Record<"default" | "inverted", { container: string; button: string }> = {
  default: {
    container: "border-border",
    button: "text-foreground hover:bg-muted focus-visible:ring-ring",
  },
  inverted: {
    container: "border-primary-foreground/30",
    button:
      "text-primary-foreground hover:bg-primary-foreground/10 focus-visible:ring-primary-foreground/60",
  },
};

/**
 * Bottle/bundle quantity stepper. No business rule lives here (no minimum
 * order, no multiple-of-six requirement — docs/02-BUSINESS-RULES.md); the
 * min/max props are purely UI guard rails supplied by the caller.
 */
export function QuantitySelector({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
  className,
  tone = "default",
}: QuantitySelectorProps) {
  const decrement = () => onChange(Math.max(min, value - 1));
  const increment = () => onChange(Math.min(max, value + 1));
  const toneClasses = TONE_CLASSES[tone];

  return (
    <div
      role="group"
      aria-label={`Quantité — ${label}`}
      className={cn("inline-flex items-center border", toneClasses.container, className)}
    >
      <button
        type="button"
        onClick={decrement}
        disabled={value <= min}
        aria-label={`Diminuer la quantité de ${label}`}
        className={cn(
          "flex size-10 shrink-0 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-40",
          toneClasses.button,
        )}
      >
        <Minus className="size-3.5" aria-hidden="true" />
      </button>
      <span
        className="flex w-8 shrink-0 items-center justify-center text-sm tabular-nums"
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={increment}
        disabled={value >= max}
        aria-label={`Augmenter la quantité de ${label}`}
        className={cn(
          "flex size-10 shrink-0 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-40",
          toneClasses.button,
        )}
      >
        <Plus className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
