"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import type { CartItemType } from "@/domain/cart/cart";
import { useCart } from "./cart-context";

const FEEDBACK_DURATION_MS = 1500;

/**
 * The restrained add-to-cart interaction (Phase 6 §6/§7) shared by
 * `WineRow` and `DiscoveryBoxSection`. Quantity defaults to 1 (not 0)
 * so the common case — "add one" — is a single click on "Ajouter",
 * never an extra click to first raise the stepper off zero. Feedback
 * is the button's own label flipping to "Ajouté" briefly, plus the
 * header count updating — no toast infrastructure for one phase's one
 * interaction.
 */
export function AddToCartControl({
  type,
  id,
  label,
  tone = "default",
}: {
  type: CartItemType;
  id: string;
  label: string;
  tone?: "default" | "inverted";
}) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = React.useState(1);
  const [justAdded, setJustAdded] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function handleAdd() {
    addItem(type, id, quantity);
    setQuantity(1);
    setJustAdded(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => setJustAdded(false), FEEDBACK_DURATION_MS);
  }

  return (
    <div className="flex items-center gap-3">
      <QuantitySelector
        label={label}
        value={quantity}
        onChange={setQuantity}
        min={1}
        max={99}
        tone={tone}
      />
      <Button
        type="button"
        variant={tone === "inverted" ? "outline" : "default"}
        onClick={handleAdd}
        className={
          tone === "inverted"
            ? "border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent"
            : undefined
        }
      >
        {justAdded ? "Ajouté ✓" : "Ajouter"}
      </Button>
    </div>
  );
}
