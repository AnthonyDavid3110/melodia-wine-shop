import Link from "next/link";
import { Body, BodySmall, Eyebrow, H1, H3, Metadata, Price } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import type { CheckoutConfirmation } from "./actions";

/**
 * The Phase 7 confirmation experience (docs/03-USER-FLOWS.md §18,
 * approved security model). Rendered entirely from the Server Action's
 * own return value, held in the parent's React state — never fetched
 * from a route addressable by the order number, so there is nothing to
 * enumerate (docs/09-SECURITY.md §22/§23). A refresh loses this view;
 * that is an accepted V1 tradeoff (no email exists yet to re-deliver
 * it, and no durable customer-facing order lookup is in scope).
 */
export function ConfirmationView({ confirmation }: { confirmation: CheckoutConfirmation }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 py-8 text-center">
      <div>
        <Eyebrow className="justify-center">Commande confirmée</Eyebrow>
        <H1 className="mt-2 text-3xl">{confirmation.orderNumber}</H1>
        <Body className="text-foreground/70 mt-3">
          Merci {confirmation.customerName}, votre commande a bien été enregistrée.
        </Body>
      </div>

      <div className="border-border border-t border-b py-6 text-left">
        <ul>
          {confirmation.items.map((item, index) => (
            <li
              key={index}
              className="border-border flex items-center justify-between border-b py-3 last:border-b-0"
            >
              <Body className="font-medium">
                {item.quantity} × {item.name}
              </Body>
              <Price>{item.lineTotal}</Price>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between">
          <H3 className="text-lg">Total</H3>
          <Price className="text-lg">{confirmation.total}</Price>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-left">
        <Metadata as="p">Mode de paiement</Metadata>
        <Body>Paiement au membre lors de la livraison</Body>
      </div>

      {confirmation.sellerName ? (
        <div className="flex flex-col gap-1 text-left">
          <Metadata as="p">Membre de Mélodia</Metadata>
          <Body>{confirmation.sellerName}</Body>
        </div>
      ) : null}

      <BodySmall className="text-foreground/60">
        Un membre de l&rsquo;Ensemble de Cuivres Mélodia vous contactera pour organiser la
        livraison.
      </BodySmall>

      <Button asChild className="mx-auto">
        <Link href="/">Retour à l&rsquo;accueil</Link>
      </Button>
    </div>
  );
}
