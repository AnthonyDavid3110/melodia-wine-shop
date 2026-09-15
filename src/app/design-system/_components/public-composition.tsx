import { Button } from "@/components/ui/button";
import { Display, Eyebrow, Body, H3, Metadata, Price } from "@/components/ui/typography";
import { PlaceholderBottle } from "./placeholder-bottle";
import { demoWines } from "../_data";

/**
 * Representative public composition — the visual principles carried over
 * from the approved Programme V2 direction (warm paper, oxblood accent,
 * sand photography surface, numbered editorial wine entries, restrained
 * CTAs), rebuilt on the production tokens/primitives rather than copied
 * from /design/programme-v2's markup.
 */
export function PublicComposition() {
  return (
    <div className="flex flex-col gap-10">
      <div className="border-border bg-sand relative overflow-hidden border p-6 sm:p-10">
        <Eyebrow>Vente 2026 · Ensemble de Cuivres Mélodia</Eyebrow>
        <Display className="mt-3 max-w-md">Les vins de Mélodia</Display>
        <Body className="text-foreground/75 mt-4 max-w-sm">
          Découvrez notre sélection de vins et soutenez l&apos;Ensemble de Cuivres Mélodia,
          formation de catégorie Excellence.
        </Body>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button size="lg">Découvrir les vins</Button>
          <Button variant="link">Soutenir Mélodia</Button>
        </div>
      </div>

      <div className="divide-border flex flex-col divide-y">
        {demoWines.map((wine, index) => {
          const imageFirst = index % 2 === 0;
          return (
            <div
              key={wine.id}
              className="grid items-center gap-6 py-8 first:pt-0 md:grid-cols-2 md:gap-12"
            >
              <div className={imageFirst ? "order-1" : "order-1 md:order-2"}>
                <div className="bg-sand relative flex h-48 items-center justify-center sm:h-56">
                  <PlaceholderBottle
                    label={wine.name}
                    className="text-foreground h-36 w-14 sm:h-44 sm:w-16"
                  />
                </div>
                <Metadata as="p" className="mt-2">
                  Pl. {wine.number} — photo provisoire
                </Metadata>
              </div>
              <div className={imageFirst ? "order-2" : "order-2 md:order-1"}>
                <Metadata as="p">
                  N°{wine.number} · {wine.color}
                </Metadata>
                <H3 className="mt-1">{wine.name}</H3>
                <Metadata as="p" className="mt-1 uppercase">
                  {wine.producer} · {wine.region} · {wine.vintage}
                </Metadata>
                <Body className="text-foreground/70 mt-3 max-w-sm text-sm italic">
                  {wine.description}
                </Body>
                <div className="mt-4 flex items-center gap-4">
                  <Price>{wine.priceLabel}</Price>
                  <Button size="sm">Ajouter</Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
