import { Body, Eyebrow, H2, H3 } from "@/components/ui/typography";

/**
 * "How the sale works" — Gate 2C rework from a single sentence into a
 * restrained three-step editorial explanation (numbers + fine rules,
 * Programme V2 language, no icon grid). Static process copy, not
 * campaign data — deliberately generic about ordering/payment (Phase 5
 * doesn't exist yet, so this describes the intended flow without
 * presenting any control as currently usable) and never invents dates,
 * delivery geography, or a carrier service. Only step 3's line is the
 * literally approved copy.
 */
const STEPS = [
  {
    number: "01",
    title: "Choisissez vos vins",
    description: "Parcourez la sélection et composez votre commande.",
  },
  {
    number: "02",
    title: "Passez votre commande",
    description: "Indiquez vos coordonnées et choisissez votre mode de paiement.",
  },
  {
    number: "03",
    title: "Nous vous livrons",
    description: "Livraison offerte par les musiciens de l'Ensemble de Cuivres Mélodia.",
  },
];

export function DeliverySection() {
  return (
    <section id="vente" className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
      <H2 className="text-center">Comment se déroule la vente</H2>
      <div className="border-border mt-10 grid gap-8 md:grid-cols-3 md:divide-x md:divide-border md:gap-0">
        {STEPS.map((step, index) => (
          <div
            key={step.number}
            className={`border-border md:px-8 md:first:pl-0 md:last:pr-0 ${
              index > 0 ? "border-t pt-8 md:border-t-0 md:pt-0" : ""
            }`}
          >
            <Eyebrow>{step.number}</Eyebrow>
            <H3 className="mt-2">{step.title}</H3>
            <Body className="text-foreground/70 mt-2 text-sm">{step.description}</Body>
          </div>
        ))}
      </div>
    </section>
  );
}
