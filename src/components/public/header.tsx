import type { PublicCatalog } from "@/domain/catalog/public-catalog";
import { CartBadge } from "@/components/cart/cart-badge";

/**
 * Restrained public header. No admin-login CTA in the primary
 * navigation, no hamburger menu — a single-page campaign site doesn't
 * need one (docs/07-DESIGN-SYSTEM.md §40).
 *
 * Gate 2C: two real, functional anchor links ("Les vins" / "La vente")
 * added on wider screens, where the wordmark alone left the header
 * looking unbalanced — both point at real sections on this same page
 * (#selection, #vente), hidden below `sm` to keep mobile exactly as
 * minimal as before.
 *
 * Phase 6: `catalog` is threaded through from whichever Server
 * Component page rendered this (`/` or `/panier`, both already fetch
 * it) purely so `CartBadge` can compute a *purchasable* count without
 * running its own query — the header itself stays a Server Component,
 * only `CartBadge` is a client leaf.
 */
export function PublicHeader({ catalog }: { catalog: PublicCatalog }) {
  return (
    <header className="border-border bg-background/95 sticky top-0 z-10 border-b backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
        <p className="font-display text-lg leading-none">
          <span className="text-accent block font-sans text-[10px] tracking-[0.25em] uppercase">
            Les vins de
          </span>
          Mélodia
        </p>
        <div className="flex items-center gap-6">
          <nav className="hidden items-center gap-6 font-sans text-sm sm:flex" aria-label="Navigation principale">
            <a href="#selection" className="hover:text-accent transition-colors">
              Les vins
            </a>
            <a href="#vente" className="hover:text-accent transition-colors">
              La vente
            </a>
          </nav>
          <CartBadge catalog={catalog} />
        </div>
      </div>
    </header>
  );
}
