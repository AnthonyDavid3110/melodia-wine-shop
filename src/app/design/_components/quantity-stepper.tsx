"use client";

import { useState } from "react";

/**
 * Behaviour-only control sample for comparing form/control treatment across
 * the three directions. Visual appearance is fully controlled by the
 * className props passed from each concept page — intentionally not a
 * finished production QuantitySelector component.
 */
export function QuantityStepper({
  label,
  wrapperClassName,
  buttonClassName,
  valueClassName,
}: {
  label: string;
  wrapperClassName?: string;
  buttonClassName?: string;
  valueClassName?: string;
}) {
  const [quantity, setQuantity] = useState(1);

  return (
    <div className={wrapperClassName} role="group" aria-label={`Quantité — ${label}`}>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => setQuantity((current) => Math.max(0, current - 1))}
        aria-label={`Diminuer la quantité de ${label}`}
      >
        −
      </button>
      <span className={valueClassName} aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => setQuantity((current) => Math.min(99, current + 1))}
        aria-label={`Augmenter la quantité de ${label}`}
      >
        +
      </button>
    </div>
  );
}
