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
}

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
}: QuantitySelectorProps) {
  const decrement = () => onChange(Math.max(min, value - 1));
  const increment = () => onChange(Math.min(max, value + 1));

  return (
    <div
      role="group"
      aria-label={`Quantité — ${label}`}
      className={cn("border-border inline-flex items-center border", className)}
    >
      <button
        type="button"
        onClick={decrement}
        disabled={value <= min}
        aria-label={`Diminuer la quantité de ${label}`}
        className="text-foreground hover:bg-muted focus-visible:ring-ring flex size-10 shrink-0 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-40"
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
        className="text-foreground hover:bg-muted focus-visible:ring-ring flex size-10 shrink-0 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-40"
      >
        <Plus className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
