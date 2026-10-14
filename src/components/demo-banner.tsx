/**
 * Demo-showcase banner (DEMO_MODE=true, never set in Production) —
 * purely a Server Component: `process.env.DEMO_MODE` is read where
 * this is rendered (root layout), never exposed to the browser as a
 * `NEXT_PUBLIC_*` variable. The actual order-creation block is
 * server-side in `submitCheckoutAction()`; this is only the visible
 * explanation, not the security boundary.
 */
export function DemoBanner() {
  return (
    <div className="bg-accent/10 border-accent/20 border-b px-4 py-2 text-center font-sans text-sm">
      Version de démonstration — aucune commande possible
    </div>
  );
}
