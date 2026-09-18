import { Body, Display } from "@/components/ui/typography";

/**
 * ECM identity / trust context. Gate 2C rework from a centered
 * heading + two lines into an asymmetric two-column composition
 * (large typographic device left, factual copy right on desktop;
 * stacked on mobile) — reuses the exact wording already used in Phase
 * 1's approved exploration pages ("formation de catégorie Excellence")
 * plus only the "in support of ECM" fundraising framing explicitly
 * approved for Phase 4. Does not claim what the money specifically
 * finances, and adds no invented detail beyond what was already
 * approved copy.
 */
export function EcmSection() {
  return (
    <section className="border-border mx-auto max-w-5xl border-t px-5 py-16 sm:px-8">
      <div className="grid gap-6 md:grid-cols-[1fr_1.2fr] md:items-center md:gap-14">
        <Display as="h2" className="text-h1">
          Mélodia
        </Display>
        <div>
          <Body className="text-foreground/75 max-w-md">
            L&apos;Ensemble de Cuivres Mélodia est une formation de cuivres suisse, membre de la
            catégorie Excellence.
          </Body>
          <Body className="text-foreground/75 mt-3 max-w-md">
            Cette vente de vins est organisée au profit de l&apos;ensemble.
          </Body>
        </div>
      </div>
    </section>
  );
}
