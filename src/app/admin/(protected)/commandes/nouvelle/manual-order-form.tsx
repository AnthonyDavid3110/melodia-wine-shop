"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import { Body, H3, Price } from "@/components/ui/typography";
import {
  cartSubtotal,
  resolveCartAgainstCatalog,
  type Cart,
  type CartItemType,
} from "@/domain/cart/cart";
import { formatCHF } from "@/domain/money";
import type { PublicCatalog } from "@/domain/catalog/public-catalog";
import { createManualOrderAction } from "./actions";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p role="alert" className="text-danger text-body-sm mt-1 font-sans">
      {messages[0]}
    </p>
  );
}

function key(type: CartItemType, id: string): string {
  return `${type}:${id}`;
}

export function ManualOrderForm({
  catalog,
  sellerOptions,
}: {
  catalog: Extract<PublicCatalog, { state: "active" }>;
  sellerOptions: { value: string; label: string }[];
}) {
  const idempotencyKeyRef = React.useRef<string>(crypto.randomUUID());
  const [quantities, setQuantities] = React.useState<Record<string, number>>({});
  const [sellerId, setSellerId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<string, string[]>>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const cart: Cart = {
    campaignId: catalog.campaign.id,
    items: Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([entryKey, quantity]) => {
        const [type, ...rest] = entryKey.split(":");
        return { type: type as CartItemType, id: rest.join(":"), quantity };
      }),
  };
  const lines = resolveCartAgainstCatalog(cart, catalog);
  const subtotal = cartSubtotal(lines);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

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
      items: cart.items,
      sellerId,
      idempotencyKey: idempotencyKeyRef.current,
    };

    setSubmitting(true);
    setErrors({});
    setFormError(null);

    const result = await createManualOrderAction(payload);
    // A successful call redirects server-side and never returns here.
    setSubmitting(false);
    if (result?.errors) setErrors(result.errors);
    if (result?.formError) setFormError(result.formError);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-3xl flex-col gap-8">
      <section className="flex flex-col gap-4">
        <H3 className="text-lg">Client</H3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-customerFirstName">Prénom</Label>
            <Input id="m-customerFirstName" name="customerFirstName" required />
            <FieldError messages={errors.customerFirstName} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-customerLastName">Nom</Label>
            <Input id="m-customerLastName" name="customerLastName" required />
            <FieldError messages={errors.customerLastName} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m-customerAddress">Adresse</Label>
          <Input id="m-customerAddress" name="customerAddress" required />
          <FieldError messages={errors.customerAddress} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,140px)_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-customerPostalCode">NPA</Label>
            <Input id="m-customerPostalCode" name="customerPostalCode" required />
            <FieldError messages={errors.customerPostalCode} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-customerCity">Localité</Label>
            <Input id="m-customerCity" name="customerCity" required />
            <FieldError messages={errors.customerCity} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-customerEmail">E-mail</Label>
            <Input id="m-customerEmail" name="customerEmail" type="email" required />
            <FieldError messages={errors.customerEmail} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-customerPhone">Téléphone</Label>
            <Input id="m-customerPhone" name="customerPhone" type="tel" required />
            <FieldError messages={errors.customerPhone} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m-deliveryNote">
            Remarque de livraison <span className="text-muted-foreground">(facultatif)</span>
          </Label>
          <Textarea id="m-deliveryNote" name="deliveryNote" rows={2} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <H3 className="text-lg">Produits</H3>
        <ul className="flex flex-col gap-3">
          {catalog.wines.map((wine) => (
            <li key={wine.id} className="flex items-center justify-between gap-4">
              <Body>{wine.name}</Body>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground text-body-sm font-sans tabular-nums">
                  {formatCHF(wine.price)}
                </span>
                <QuantitySelector
                  label={wine.name}
                  value={quantities[key("PRODUCT", wine.id)] ?? 0}
                  onChange={(value) =>
                    setQuantities((current) => ({ ...current, [key("PRODUCT", wine.id)]: value }))
                  }
                  min={0}
                  max={999}
                />
              </div>
            </li>
          ))}
          {catalog.bundles.map((bundle) => (
            <li key={bundle.id} className="flex items-center justify-between gap-4">
              <Body>{bundle.name}</Body>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground text-body-sm font-sans tabular-nums">
                  {formatCHF(bundle.price)}
                </span>
                <QuantitySelector
                  label={bundle.name}
                  value={quantities[key("BUNDLE", bundle.id)] ?? 0}
                  onChange={(value) =>
                    setQuantities((current) => ({ ...current, [key("BUNDLE", bundle.id)]: value }))
                  }
                  min={0}
                  max={999}
                />
              </div>
            </li>
          ))}
        </ul>
        <div className="border-border flex items-center justify-between border-t pt-3">
          <Body className="font-medium">Total</Body>
          <Price>{formatCHF(subtotal)}</Price>
        </div>
        <FieldError messages={errors.items} />
      </section>

      <section className="flex flex-col gap-3">
        <H3 className="text-lg">Vendeur</H3>
        <Combobox
          options={sellerOptions}
          value={sellerId}
          onChange={setSellerId}
          placeholder="Non assigné"
          searchPlaceholder="Rechercher un membre…"
          emptyText="Aucun membre trouvé."
          clearLabel="Non assigné"
          triggerAriaLabel="Vendeur"
          className="max-w-sm"
        />
      </section>

      <section className="flex flex-col gap-3">
        <H3 className="text-lg">Paiement</H3>
        <Body className="text-foreground/70 text-sm">Paiement au membre lors de la livraison.</Body>
      </section>

      {formError ? (
        <p role="alert" className="text-danger text-body-sm font-sans">
          {formError}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={submitting || cart.items.length === 0}>
          {submitting ? "Création…" : "Créer la commande"}
        </Button>
      </div>
    </form>
  );
}
