import {
  Display,
  H1,
  H2,
  H3,
  BodyLarge,
  Body,
  BodySmall,
  FieldLabel,
  Price,
  Metadata,
  Eyebrow,
} from "@/components/ui/typography";

const rows: Array<{ role: string; sample: React.ReactNode }> = [
  { role: "display", sample: <Display as="p">Les vins de Mélodia</Display> },
  { role: "h1", sample: <H1 as="p">La sélection 2026</H1> },
  { role: "h2", sample: <H2 as="p">Carton découverte</H2> },
  { role: "h3", sample: <H3 as="p">Chasselas</H3> },
  {
    role: "body-large",
    sample: (
      <BodyLarge>
        Découvrez notre sélection de vins et soutenez l&apos;Ensemble de Cuivres Mélodia.
      </BodyLarge>
    ),
  },
  {
    role: "body",
    sample: (
      <Body>
        Chaque bouteille achetée finance les répétitions, les concerts et les déplacements.
      </Body>
    ),
  },
  {
    role: "body-small",
    sample: <BodySmall>Livraison assurée par les membres de Mélodia dès fin novembre.</BodySmall>,
  },
  { role: "label", sample: <FieldLabel>Membre Mélodia (optionnel)</FieldLabel> },
  { role: "price", sample: <Price>CHF 18.–</Price> },
  { role: "metadata", sample: <Metadata>Domaine des Coteaux · Vaud · 2025</Metadata> },
  {
    role: "caption / eyebrow",
    sample: <Eyebrow>Vente 2026 · Ensemble de Cuivres Mélodia</Eyebrow>,
  },
];

export function TypeScale() {
  return (
    <div className="divide-border flex flex-col divide-y">
      {rows.map((row) => (
        <div
          key={row.role}
          className="grid grid-cols-1 gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6"
        >
          <p className="text-muted-foreground font-mono text-xs uppercase">{row.role}</p>
          <div>{row.sample}</div>
        </div>
      ))}
    </div>
  );
}
