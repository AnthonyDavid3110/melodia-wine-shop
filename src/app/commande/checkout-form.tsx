"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Body, BodySmall, FieldLabel, H2, H3, Price } from "@/components/ui/typography";
import { useCart } from "@/components/cart/cart-context";
import { cartSubtotal, resolveCartAgainstCatalog } from "@/domain/cart/cart";
import { formatCHF } from "@/domain/money";
import type { PublicCatalog } from "@/domain/catalog/public-catalog";
import { submitCheckoutAction, type CheckoutConfirmation } from "./actions";
import { ConfirmationView } from "./confirmation-view";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p role="alert" className="text-danger text-body-sm mt-1 font-sans">
      {messages[0]}
    </p>
  );
}

const FIELD_ORDER = [
  "customerFirstName",
  "customerLastName",
  "customerAddress",
  "customerPostalCode",
  "customerCity",
  "customerEmail",
  "customerPhone",
] as const;

export function CheckoutForm({
  catalog,
  sellerOptions,
}: {
  catalog: Extract<PublicCatalog, { state: "active" }>;
  sellerOptions: { value: string; label: string }[];
}) {
  const { cart, hydrated, clearCart } = useCart();
  const idempotencyKeyRef = React.useRef<string>(crypto.randomUUID());
  const fieldRefs = React.useRef<Partial<Record<string, HTMLInputElement>>>({});

  const [sellerId, setSellerId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<string, string[]>>>({});
  const [cartError, setCartError] = React.useState<string | null>(null);
  const [confirmation, setConfirmation] = React.useState<CheckoutConfirmation | null>(null);

  const lines = hydrated ? resolveCartAgainstCatalog(cart, catalog) : [];
  const availableLines = lines.filter((line) => line.available);
  const unavailableCount = lines.length - availableLines.length;
  const subtotal = cartSubtotal(lines);
  const canSubmit = hydrated && availableLines.length > 0 && unavailableCount === 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    const formData = new FormData(event.currentTarget);
    const payload = {
      customerFirstName: String(formData.get("customerFirstName") ?? ""),
      customerLastName: String(formData.get("customerLastName") ?? ""),
      customerAddress: String(formData.get("customerAddress") ?? ""),
      customerPostalCode: String(formData.get("customerPostalCode") ?? ""),
      customerCity: String(formData.get("customerCity") ?? ""),
      customerEmail: String(formData.get("customerEmail") ?? ""),
      customerPhone: String(formData.get("customerPhone") ?? ""),
      deliveryNote: String(formData.get("deliveryNote") ?? ""),
      items: availableLines.map((line) => ({
        type: line.item.type,
        id: line.item.id,
        quantity: line.item.quantity,
      })),
      campaignId: cart.campaignId,
      sellerId,
      idempotencyKey: idempotencyKeyRef.current,
    };

    setSubmitting(true);
    setFieldErrors({});
    setCartError(null);

    const result = await submitCheckoutAction(payload);

    setSubmitting(false);

    if (result.status === "success") {
      clearCart();
      setConfirmation(result.confirmation);
      return;
    }

    if (result.status === "validation-error") {
      setFieldErrors(result.fieldErrors);
      const firstInvalid = FIELD_ORDER.find((name) => result.fieldErrors[name]?.length);
      if (firstInvalid) {
        fieldRefs.current[firstInvalid]?.focus();
      }
      return;
    }

    // cart-error or generic error
    setCartError(result.message);
  }

  if (confirmation) {
    return <ConfirmationView confirmation={confirmation} />;
  }

  if (!hydrated) {
    return <div aria-hidden="true" className="py-16" />;
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Body className="text-foreground/75">Votre panier est vide.</Body>
        <Button asChild className="mt-6">
          <Link href="/">Découvrir les vins</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-12">
      {unavailableCount > 0 ? (
        <div className="border-warning bg-warning/10 flex flex-col gap-2 border-l-2 px-4 py-3">
          <Body className="font-medium">
            {unavailableCount === 1
              ? "Un article de votre panier n'est plus disponible."
              : `${unavailableCount} articles de votre panier ne sont plus disponibles.`}
          </Body>
          <Link href="/panier" className="font-sans text-sm underline-offset-2 hover:underline">
            Retourner au panier pour le retirer
          </Link>
        </div>
      ) : null}

      <section aria-labelledby="checkout-customer-heading" className="flex flex-col gap-5">
        <H2 id="checkout-customer-heading" className="text-xl">
          Vos coordonnées
        </H2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customerFirstName">Prénom</Label>
            <Input
              id="customerFirstName"
              name="customerFirstName"
              autoComplete="given-name"
              required
              aria-invalid={fieldErrors.customerFirstName ? true : undefined}
              ref={(el) => {
                if (el) fieldRefs.current.customerFirstName = el;
              }}
            />
            <FieldError messages={fieldErrors.customerFirstName} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customerLastName">Nom</Label>
            <Input
              id="customerLastName"
              name="customerLastName"
              autoComplete="family-name"
              required
              aria-invalid={fieldErrors.customerLastName ? true : undefined}
              ref={(el) => {
                if (el) fieldRefs.current.customerLastName = el;
              }}
            />
            <FieldError messages={fieldErrors.customerLastName} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="customerAddress">Adresse</Label>
          <Input
            id="customerAddress"
            name="customerAddress"
            autoComplete="street-address"
            required
            aria-invalid={fieldErrors.customerAddress ? true : undefined}
            ref={(el) => {
              if (el) fieldRefs.current.customerAddress = el;
            }}
          />
          <FieldError messages={fieldErrors.customerAddress} />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,140px)_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customerPostalCode">NPA</Label>
            <Input
              id="customerPostalCode"
              name="customerPostalCode"
              autoComplete="postal-code"
              inputMode="numeric"
              required
              aria-invalid={fieldErrors.customerPostalCode ? true : undefined}
              ref={(el) => {
                if (el) fieldRefs.current.customerPostalCode = el;
              }}
            />
            <FieldError messages={fieldErrors.customerPostalCode} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customerCity">Localité</Label>
            <Input
              id="customerCity"
              name="customerCity"
              autoComplete="address-level2"
              required
              aria-invalid={fieldErrors.customerCity ? true : undefined}
              ref={(el) => {
                if (el) fieldRefs.current.customerCity = el;
              }}
            />
            <FieldError messages={fieldErrors.customerCity} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customerEmail">E-mail</Label>
            <Input
              id="customerEmail"
              name="customerEmail"
              type="email"
              autoComplete="email"
              required
              aria-invalid={fieldErrors.customerEmail ? true : undefined}
              ref={(el) => {
                if (el) fieldRefs.current.customerEmail = el;
              }}
            />
            <FieldError messages={fieldErrors.customerEmail} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customerPhone">Téléphone</Label>
            <Input
              id="customerPhone"
              name="customerPhone"
              type="tel"
              autoComplete="tel"
              required
              aria-invalid={fieldErrors.customerPhone ? true : undefined}
              ref={(el) => {
                if (el) fieldRefs.current.customerPhone = el;
              }}
            />
            <FieldError messages={fieldErrors.customerPhone} />
          </div>
        </div>
      </section>

      <section aria-labelledby="checkout-seller-heading" className="flex flex-col gap-3">
        <H2 id="checkout-seller-heading" className="text-xl">
          Membre de Mélodia
        </H2>
        <BodySmall className="text-foreground/70">
          Un membre de l&rsquo;Ensemble de Cuivres Mélodia vous a-t-il proposé cette vente ?
        </BodySmall>
        <Combobox
          options={sellerOptions}
          value={sellerId}
          onChange={setSellerId}
          placeholder="Aucun membre sélectionné"
          searchPlaceholder="Rechercher un membre…"
          emptyText="Aucun membre trouvé."
          clearLabel="Je ne connais pas de membre / aucun vendeur"
          triggerAriaLabel="Membre de Mélodia"
          className="max-w-sm"
        />
      </section>

      <section aria-labelledby="checkout-note-heading" className="flex flex-col gap-3">
        <H2 id="checkout-note-heading" className="text-xl">
          Remarque pour la livraison
        </H2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="deliveryNote">
            Remarque <span className="text-muted-foreground">(facultatif)</span>
          </Label>
          <Textarea id="deliveryNote" name="deliveryNote" rows={3} className="max-w-lg" />
          <FieldError messages={fieldErrors.deliveryNote} />
        </div>
      </section>

      <section aria-labelledby="checkout-payment-heading" className="flex flex-col gap-3">
        <H2 id="checkout-payment-heading" className="text-xl">
          Mode de paiement
        </H2>
        <div className="border-border max-w-sm border px-4 py-3">
          <FieldLabel>Paiement au membre lors de la livraison</FieldLabel>
        </div>
      </section>

      <section aria-labelledby="checkout-review-heading" className="flex flex-col gap-4">
        <H2 id="checkout-review-heading" className="text-xl">
          Récapitulatif
        </H2>
        <ul>
          {availableLines.map((line) => (
            <li
              key={`${line.item.type}:${line.item.id}`}
              className="border-border flex items-center justify-between border-b py-3 last:border-b-0"
            >
              <div>
                <Body className="font-medium">
                  {line.item.quantity} × {line.name}
                </Body>
              </div>
              <Price>{formatCHF(line.lineTotal!)}</Price>
            </li>
          ))}
        </ul>
        <div className="border-border flex items-center justify-between border-t pt-4">
          <H3 className="text-lg">Total</H3>
          <Price className="text-lg">{formatCHF(subtotal)}</Price>
        </div>
      </section>

      {cartError ? (
        <p role="alert" className="text-danger text-body-sm font-sans">
          {cartError}
        </p>
      ) : null}

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/panier" className="font-sans text-sm underline-offset-2 hover:underline">
          Modifier le panier
        </Link>
        <Button type="submit" size="lg" disabled={!canSubmit || submitting}>
          {submitting ? "Envoi en cours…" : "Confirmer la commande"}
        </Button>
      </div>
    </form>
  );
}
