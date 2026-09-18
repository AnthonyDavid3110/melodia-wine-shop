/**
 * Restrained public header. No cart icon (nothing to count yet — Phase
 * 4 has no cart), no admin-login CTA in the primary navigation, no
 * hamburger menu — a single-page campaign site doesn't need one
 * (docs/07-DESIGN-SYSTEM.md §40).
 *
 * Gate 2C: two real, functional anchor links ("Les vins" / "La vente")
 * added on wider screens, where the wordmark alone left the header
 * looking unbalanced — both point at real sections on this same page
 * (#selection, #vente), hidden below `sm` to keep mobile exactly as
 * minimal as before.
 */
export function PublicHeader() {
  return (
    <header className="border-border bg-background/95 sticky top-0 z-10 border-b backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
        <p className="font-display text-lg leading-none">
          <span className="text-accent block font-sans text-[10px] tracking-[0.25em] uppercase">
            Les vins de
          </span>
          Mélodia
        </p>
        <nav className="hidden items-center gap-6 font-sans text-sm sm:flex" aria-label="Navigation principale">
          <a href="#selection" className="hover:text-accent transition-colors">
            Les vins
          </a>
          <a href="#vente" className="hover:text-accent transition-colors">
            La vente
          </a>
        </nav>
      </div>
    </header>
  );
}
