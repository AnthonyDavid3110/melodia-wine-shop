/**
 * The public text wordmark — "LES VINS DE / Mélodia". Used in the
 * footer. The header uses the image `BrandLogo` instead (see
 * `brand-logo.tsx`); this component is kept for the footer's own
 * treatment, not retyped there.
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
