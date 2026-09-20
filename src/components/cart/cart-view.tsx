"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import { Body, BodySmall, Metadata, Price } from "@/components/ui/typography";
import { formatCHF } from "@/domain/money";
import { cartSubtotal, resolveCartAgainstCatalog, type ResolvedCartLine } from "@/domain/cart/cart";
import type { PublicCatalog } from "@/domain/catalog/public-catalog";
import { useCart } from "./cart-context";

/** No name is ever persisted for an unavailable line (Phase 6 §9) — this is deliberately generic, never a remembered/stale name. */
function unavailableLabel(type: ResolvedCartLine["item"]["type"]): string {
  return type === "PRODUCT" ? "Vin indisponible" : "Carton indisponible";
}

function AvailableLineRow({ line }: { line: ResolvedCartLine & { available: true } }) {
  const { setItemQuantity, removeItem } = useCart();
  const { item, name, unitPrice, lineTotal } = line;

  return (
    <li className="border-border flex flex-col gap-4 border-b py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 sm:flex-1">
        <Body className="font-medium">{name}</Body>
        <Metadata as="p" className="mt-1">
          {formatCHF(unitPrice)} / unité
        </Metadata>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <QuantitySelector
          label={name ?? ""}
          value={item.quantity}
          onChange={(quantity) => setItemQuantity(item.type, item.id, quantity)}
          min={0}
          max={99}
        />
        <Price className="w-24 shrink-0 text-right whitespace-nowrap">{formatCHF(lineTotal)}</Price>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => removeItem(item.type, item.id)}
          aria-label={`Retirer ${name} du panier`}
        >
          Retirer
        </Button>
      </div>
    </li>
  );
}

function UnavailableLineRow({ line }: { line: ResolvedCartLine & { available: false } }) {
  const { removeItem } = useCart();
  const label = unavailableLabel(line.item.type);

  return (
    <li className="border-border text-muted-foreground flex flex-col gap-3 border-b border-dashed py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 sm:flex-1">
        <Body className="text-muted-foreground font-medium">{label}</Body>
        <BodySmall className="text-muted-foreground mt-1">
          Cet article n&rsquo;est plus disponible.
        </BodySmall>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => removeItem(line.item.type, line.item.id)}
        aria-label={`Retirer ${label.toLowerCase()} du panier`}
        className="self-start sm:self-auto"
      >
        Retirer
      </Button>
    </li>
  );
}

function EmptyCartNotice() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <Body className="text-foreground/75">Votre panier est vide.</Body>
      <Button asChild className="mt-6">
        <Link href="/">Découvrir les vins</Link>
      </Button>
    </div>
  );
}

export function CartView({ catalog }: { catalog: PublicCatalog }) {
  const { cart, hydrated } = useCart();

  // Neutral, non-committal state until the real persisted cart is known
  // — deliberately not "Votre panier est vide.", since that would
  // misleadingly read as data loss for a returning customer with a
  // real cart, for the brief moment before the mount effect runs.
  if (!hydrated) {
    return <div aria-hidden="true" className="py-16" />;
  }

  const lines = resolveCartAgainstCatalog(cart, catalog);
  const availableLines = lines.filter(
    (line): line is ResolvedCartLine & { available: true } => line.available,
  );
  const unavailableLines = lines.filter(
    (line): line is ResolvedCartLine & { available: false } => !line.available,
  );

  if (lines.length === 0) {
    return <EmptyCartNotice />;
  }

  const subtotal = cartSubtotal(lines);

  return (
    <div className="flex flex-col gap-10">
      <ul>
        {availableLines.map((line) => (
          <AvailableLineRow key={`${line.item.type}:${line.item.id}`} line={line} />
        ))}
        {unavailableLines.map((line) => (
          <UnavailableLineRow key={`${line.item.type}:${line.item.id}`} line={line} />
        ))}
      </ul>

      {availableLines.length > 0 ? (
        <div className="flex flex-col gap-6">
          <div className="border-border flex items-center justify-between border-t pt-6">
            <Body className="font-medium">Total</Body>
            <Price className="text-lg">{formatCHF(subtotal)}</Price>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="font-sans text-sm underline-offset-2 hover:underline">
              Continuer mes achats
            </Link>
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/commande">Passer la commande</Link>
            </Button>
          </div>
        </div>
      ) : (
        <Link href="/" className="font-sans text-sm underline-offset-2 hover:underline">
          Continuer mes achats
        </Link>
      )}
    </div>
  );
}
