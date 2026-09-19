"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { purchasableCartCount } from "@/domain/cart/cart";
import type { PublicCatalog } from "@/domain/catalog/public-catalog";
import { useCart } from "./cart-context";

/**
 * Restrained header cart entry point (Phase 6 §8) — no drawer/dropdown
 * preview, just a link to `/panier` with a purchasable-only count.
 * Hydration-safe: before `hydrated`, this renders the exact same
 * "0 articles" state the server rendered (the server has no
 * `localStorage` to read), so there is nothing to mismatch — the count
 * only changes in a normal post-mount update once the real cart is
 * known, which React handles without complaint.
 */
export function CartBadge({ catalog }: { catalog: PublicCatalog }) {
  const { cart, hydrated } = useCart();
  const count = hydrated ? purchasableCartCount(cart, catalog) : 0;
  const label = `Panier, ${count} article${count === 1 ? "" : "s"}`;

  return (
    <Link
      href="/panier"
      aria-label={label}
      className="text-foreground hover:text-accent flex items-center gap-1.5 transition-colors"
    >
      <ShoppingBag className="size-5" aria-hidden="true" />
      <span aria-hidden="true" className="font-sans text-sm tabular-nums">
        {count > 0 ? count : ""}
      </span>
    </Link>
  );
}
