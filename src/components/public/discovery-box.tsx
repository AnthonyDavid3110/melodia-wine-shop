import Image from "next/image";
import type { PublicBundle } from "@/domain/catalog/public-catalog";
import { formatCHF } from "@/domain/money";
import { Display } from "@/components/ui/typography";
import { AddToCartControl } from "@/components/cart/add-to-cart-control";
import { PlaceholderBottle } from "./placeholder-bottle";

/**
 * The established oxblood "programme interlude" treatment
 * (docs/07-DESIGN-SYSTEM.md §32) — visually distinct from a wine row,
 * never presented as just another product card. Renders every valid
 * bundle from `PublicCatalog.bundles`; does not assume there is
 * exactly one, even though that's the current business expectation.
 * No discount/savings figure is computed or shown anywhere here.
 */
export function DiscoveryBoxSection({ bundles }: { bundles: PublicBundle[] }) {
  if (bundles.length === 0) {
    return null;
  }

  return (
    <section aria-label="Cartons découverte" className="flex flex-col gap-px">
      {bundles.map((bundle) => (
        <div key={bundle.id} className="bg-accent relative py-16">
          <div className="text-primary-foreground mx-auto max-w-5xl px-5 sm:px-8">
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                <p className="text-primary-foreground/80 font-sans text-caption uppercase">
                  Offre spéciale
                </p>
                <Display as="h2" className="mt-3">
                  {bundle.name}
                </Display>
                {bundle.shortDescription || bundle.description ? (
                  <p className="text-primary-foreground/85 mt-3 max-w-sm font-sans text-sm">
                    {bundle.shortDescription ?? bundle.description}
                  </p>
                ) : null}

                {bundle.items.length > 0 ? (
                  <ul className="border-primary-foreground/30 mt-6 max-w-sm border-t">
                    {bundle.items.map((item) => (
                      <li
                        key={item.productId}
                        className="border-primary-foreground/20 flex items-center justify-between border-b py-2 font-sans text-sm"
                      >
                        <span>{item.name}</span>
                        <span className="text-primary-foreground/70">× {item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-2">
                  <p className="font-sans text-3xl font-medium tabular-nums">
                    {formatCHF(bundle.price)}
                  </p>
                  <p className="text-primary-foreground/80 font-sans text-sm">
                    {bundle.bottleCount} {bundle.bottleCount > 1 ? "bouteilles" : "bouteille"}
                  </p>
                </div>

                <div className="mt-6">
                  <AddToCartControl type="BUNDLE" id={bundle.id} label={bundle.name} tone="inverted" />
                </div>
              </div>

              <div className="flex items-end justify-center gap-3">
                {bundle.imageUrl ? (
                  <div className="relative h-40 w-full sm:h-52">
                    <Image
                      src={bundle.imageUrl}
                      alt={bundle.name}
                      fill
                      sizes="(min-width: 768px) 40vw, 80vw"
                      className="object-contain"
                    />
                  </div>
                ) : (
                  bundle.items.map((item) => (
                    <PlaceholderBottle
                      key={item.productId}
                      label={item.name}
                      className="text-primary-foreground/60 h-28 w-10 sm:h-36 sm:w-12"
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
