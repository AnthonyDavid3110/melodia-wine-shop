"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import { Body, BodySmall, Metadata, Price } from "@/components/ui/typography";
import { formatCHF, multiplyMoney } from "@/domain/money";
import {
  cartSubtotal,
  resolveCartAgainstCatalog,
  WINE_LOT_SIZE,
  type ResolvedCartLine,
} from "@/domain/cart/cart";
import type { PublicCatalog } from "@/domain/catalog/public-catalog";
import { useCart } from "./cart-context";

/** No name is ever persisted for an unavailable line (Phase 6 §9) — this is deliberately generic, never a remembered/stale name. */
function unavailableLabel(type: ResolvedCartLine["item"]["type"]): string {
  return type === "PRODUCT" ? "Vin indisponible" : "Carton indisponible";
}

/**
 * CORR-003 — a wine (`PRODUCT`) line stepper manipulates whole lots
 * (1, 2, 3…), converting to/from the real bottle count stored in the
 * cart only at the point of read/write; the Discovery Box (`BUNDLE`)
 * keeps its original one-box-at-a-time stepper, entirely unaffected.
 */
function AvailableLineRow({ line }: { line: ResolvedCartLine & { available: true } }) {
  const { setItemQuantity, removeItem } = useCart();
  const { item, name, unitPrice, lineTotal, lotCompatible } = line;
  const isWine = item.type === "PRODUCT";

  if (isWine && !lotCompatible) {
    return <IncompatibleWineLineRow line={line} />;
  }

  const stepperValue = isWine ? item.quantity / WINE_LOT_SIZE : item.quantity;
  const displayUnitPrice = isWine ? multiplyMoney(unitPrice, WINE_LOT_SIZE) : unitPrice;

  return (
    <li className="border-border flex flex-col gap-4 border-b py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 sm:flex-1">
        <Body className="font-medium">{name}</Body>
        <Metadata as="p" className="mt-1">
          {formatCHF(displayUnitPrice)}{" "}
          {isWine ? `/ lot de ${WINE_LOT_SIZE} bouteilles` : "/ unité"}
        </Metadata>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="flex flex-col items-end gap-1">
          <QuantitySelector
            label={isWine ? `lots de ${name ?? ""}` : (name ?? "")}
            value={stepperValue}
            onChange={(value) =>
              setItemQuantity(item.type, item.id, isWine ? value * WINE_LOT_SIZE : value)
            }
            min={0}
            max={isWine ? Math.floor(99 / WINE_LOT_SIZE) : 99}
          />
          {isWine ? (
            <Metadata as="p" className="text-foreground/50">
              {item.quantity} bouteille{item.quantity > 1 ? "s" : ""}
            </Metadata>
          ) : null}
        </div>
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

/**
 * CORR-003 — a PRODUCT line whose stored quantity predates the
 * lots-of-3 rule (e.g. 4 bottles from an old session). Never
 * auto-rounded, never silently dropped, never silently charged more —
 * the customer explicitly picks a valid lot count; nothing is written
 * back to the cart until they interact with the stepper below (it
 * starts at a neutral 1 lot, never a value derived from the
 * incompatible stored quantity).
 */
function IncompatibleWineLineRow({ line }: { line: ResolvedCartLine & { available: true } }) {
  const { setItemQuantity, removeItem } = useCart();
  const { item, name, unitPrice } = line;
  const [lots, setLots] = React.useState(1);

  return (
    <li className="border-warning/40 bg-warning/5 flex flex-col gap-3 border-b py-5 last:border-b-0">
      <div>
        <Body className="font-medium">{name}</Body>
        <BodySmall className="text-warning mt-1">
          Les vins se commandent désormais par lots de {WINE_LOT_SIZE} bouteilles identiques. Cette
          ligne contient actuellement {item.quantity} bouteille
          {item.quantity > 1 ? "s" : ""} — choisissez un nombre de lots valide pour continuer.
        </BodySmall>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col items-start gap-1">
          <QuantitySelector
            label={`lots de ${name ?? ""}`}
            value={lots}
            onChange={setLots}
            min={1}
            max={Math.floor(99 / WINE_LOT_SIZE)}
          />
          <Metadata as="p" className="text-foreground/50">
            {lots * WINE_LOT_SIZE} bouteilles —{" "}
            {formatCHF(multiplyMoney(unitPrice, lots * WINE_LOT_SIZE))}
          </Metadata>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => setItemQuantity(item.type, item.id, lots * WINE_LOT_SIZE)}
          >
            Mettre à jour
          </Button>
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
  // CORR-003: at least one old, pre-lots-of-3 wine line blocks checkout
  // entirely — never a partial/ambiguous order.
  const hasIncompatibleLine = availableLines.some((line) => !line.lotCompatible);

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
          {hasIncompatibleLine ? (
            <BodySmall className="text-warning">
              Veuillez mettre à jour la quantité des vins signalés ci-dessus avant de passer
              commande.
            </BodySmall>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="font-sans text-sm underline-offset-2 hover:underline">
              Continuer mes achats
            </Link>
            {hasIncompatibleLine ? (
              <Button size="lg" className="w-full sm:w-auto" disabled>
                Passer la commande
              </Button>
            ) : (
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/commande">Passer la commande</Link>
              </Button>
            )}
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
