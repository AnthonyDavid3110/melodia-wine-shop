import { Body, Display } from "@/components/ui/typography";

/**
 * ECM identity / trust context. Gate 2C rework from a centered
 * heading + two lines into an asymmetric two-column composition
 * (large typographic device left, factual copy right on desktop;
 * stacked on mobile). History paragraph updated (CORR-004) to the
 * committee-provided founding narrative (1960, La Côte Vaudoise,
 * Brass Band transition in the 1970s), replacing the earlier
 * "catégorie Excellence" copy. The second paragraph's "in support of
 * ECM" fundraising framing is unchanged. Does not claim what the
 * money specifically finances, and adds no invented detail beyond
 * what was supplied.
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
            L&rsquo;Ensemble de Cuivres Mélodia a été créé en 1960 par un groupe d&rsquo;amis de
            La Côte Vaudoise, pratiquant tous un instrument de cuivre. Dans les années 70, Mélodia
            se transforme et devient un Brass Band ou Ensemble de Cuivres.
          </Body>
          <Body className="text-foreground/75 mt-3 max-w-md">
            Cette vente de vins est organisée au profit de l&apos;ensemble.
          </Body>
        </div>
      </div>
    </section>
  );
}
