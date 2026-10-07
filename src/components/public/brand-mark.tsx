/**
 * The public wordmark — "LES VINS DE / Mélodia". Shared by the header
 * and footer (Phase 15 footer refinement) so the one real brand
 * treatment lives in a single place rather than being retyped.
 */
export function BrandMark() {
  return (
    <p className="font-display text-lg leading-none">
      <span className="text-accent block font-sans text-[10px] whitespace-nowrap tracking-[0.25em] uppercase">
        Les vins de
      </span>
      Mélodia
    </p>
  );
}
