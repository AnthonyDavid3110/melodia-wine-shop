import { Body, Display, Eyebrow } from "@/components/ui/typography";

/**
 * The expected-business-state page for DRAFT/CLOSED/ARCHIVED/no
 * campaign (Gate 1 decision 3/5, Gate 2 §8) — NOT an error. Never
 * exposes the internal campaign status to the visitor.
 */
export function NoActiveCampaignNotice() {
  return (
    <section className="flex flex-1 items-center justify-center px-5 py-24 text-center sm:px-8">
      <div>
        <Eyebrow>Ensemble de Cuivres Mélodia</Eyebrow>
        <Display as="h1" className="mt-3">
          Les vins de Mélodia
        </Display>
        <Body className="text-foreground/75 mx-auto mt-5 max-w-sm">
          La vente de vins n&apos;est actuellement pas ouverte.
        </Body>
      </div>
    </section>
  );
}
