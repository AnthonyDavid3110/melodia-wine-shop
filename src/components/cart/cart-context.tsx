"use client";

import * as React from "react";
import {
  addToCart,
  createEmptyCart,
  reconcileCartCampaign,
  removeFromCart,
  setQuantity,
  type Cart,
  type CartItemType,
} from "@/domain/cart/cart";
import { CART_STORAGE_KEY, parseStoredCart, serializeCart } from "@/domain/cart/cart-storage";

/**
 * Global cart state (Phase 6). Deliberately does NOT know the current
 * campaign at render time — the root layout that mounts this provider
 * has no reason to run a catalogue database query. `cart.campaignId`
 * starts as `""` (the domain's own "no campaign known yet" sentinel)
 * and is only ever corrected by `resetForCampaign`, called from
 * `CartCampaignSync` — a tiny component rendered by whichever Server
 * Component page already fetched the authoritative campaign identity
 * (`/` or `/panier`). This keeps the DB-aware "what campaign is this"
 * question entirely out of the provider (Gate 1 architecture
 * correction).
 *
 * Hydration sequencing (must hold, and is unit/e2e-tested):
 * 1. First client render uses the exact same initial state the server
 *    rendered (`{ campaignId: "", items: [] }`, `hydrated: false`) — no
 *    `localStorage` read happens during render, so there is nothing to
 *    mismatch.
 * 2. A mount-only effect reads `localStorage` once, and — in the same
 *    batch — replaces `cart` (if a valid stored cart was found) and
 *    flips `hydrated` to `true`.
 * 3. A separate effect persists `cart` to `localStorage`, but exits
 *    immediately while `hydrated` is still `false`. Because effects
 *    within one commit see that commit's own closed-over state, this
 *    effect's first run (in the same commit as step 2) still sees the
 *    *pre*-hydration `hydrated === false` and does nothing — only the
 *    *next* commit (triggered by step 2's state update) sees
 *    `hydrated === true` and writes. The read in step 2 is therefore
 *    guaranteed to happen before the first real write.
 */
interface CartContextValue {
  cart: Cart;
  hydrated: boolean;
  addItem: (type: CartItemType, id: string, quantity: number) => void;
  setItemQuantity: (type: CartItemType, id: string, quantity: number) => void;
  removeItem: (type: CartItemType, id: string) => void;
  resetForCampaign: (campaignId: string) => void;
}

const CartContext = React.createContext<CartContextValue | null>(null);

function safeReadStorage(): string | null {
  try {
    return window.localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    // Storage unavailable (private browsing, disabled site data, etc.) —
    // the in-memory cart still works for the rest of this session.
    return null;
  }
}

function safeWriteStorage(value: string): void {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, value);
  } catch {
    // Ignored for the same reason as above.
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = React.useState<Cart>(() => createEmptyCart(""));
  const [hydrated, setHydrated] = React.useState(false);

  // Step 2 above: read once, on mount, before anything ever persists.
  // This is the textbook justified case for setState-in-effect (React's
  // own docs list "synchronize with an external system" as the reason
  // effects exist) — `localStorage` cannot be read during a `useState`
  // lazy initializer without reintroducing the exact hydration mismatch
  // this whole sequencing exists to avoid: an initializer runs on the
  // server (where `window` doesn't exist) and again on the client's
  // first render (where it does), so a server/client-branching
  // initializer would compute two different initial values — precisely
  // what must not happen. Deferring the read into a mount-only effect
  // keeps the very first client render identical to the server's.
  React.useEffect(() => {
    const stored = parseStoredCart(safeReadStorage());
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above: reading localStorage cannot safely happen anywhere but here
      setCart(stored);
    }
    setHydrated(true);
  }, []);

  // Step 3 above: persist, but never before hydration has completed.
  React.useEffect(() => {
    if (!hydrated) {
      return;
    }
    safeWriteStorage(serializeCart(cart));
  }, [cart, hydrated]);

  const addItem = React.useCallback((type: CartItemType, id: string, quantity: number) => {
    setCart((current) => addToCart(current, type, id, quantity));
  }, []);

  const setItemQuantity = React.useCallback((type: CartItemType, id: string, quantity: number) => {
    setCart((current) => setQuantity(current, type, id, quantity));
  }, []);

  const removeItem = React.useCallback((type: CartItemType, id: string) => {
    setCart((current) => removeFromCart(current, type, id));
  }, []);

  /**
   * `CartCampaignSync` waits for `hydrated` before comparing, but that
   * still leaves a window — between `hydrated` flipping `true` and this
   * function actually being called on the *next* commit — during which
   * the user can already interact with a cart whose `campaignId` is
   * still the `""` placeholder. `reconcileCartCampaign` (unit-tested)
   * is what makes that safe: reconciling *from* the empty sentinel
   * keeps whatever was just added instead of discarding it (confirmed
   * necessary while testing — a same-session click was silently lost
   * without this).
   */
  const resetForCampaign = React.useCallback((campaignId: string) => {
    setCart((current) => reconcileCartCampaign(current, campaignId));
  }, []);

  const value = React.useMemo<CartContextValue>(
    () => ({ cart, hydrated, addItem, setItemQuantity, removeItem, resetForCampaign }),
    [cart, hydrated, addItem, setItemQuantity, removeItem, resetForCampaign],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = React.useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider.");
  }
  return context;
}
