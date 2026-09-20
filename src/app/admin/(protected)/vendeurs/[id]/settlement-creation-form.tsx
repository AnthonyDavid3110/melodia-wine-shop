"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Body, Price } from "@/components/ui/typography";
import { formatCHF, money } from "@/domain/money";
import { createSettlementAction } from "../actions";

export interface EligibleOrderOption {
  id: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
}

/**
 * Settlement creation (Phase 8 §21) — checkbox selection, a preview
 * total, explicit confirmation, then a single Server Action call. The
 * displayed total is preview-only: `createSettlement()` independently
 * re-resolves and re-sums the selected orders server-side (docs/08
 * §36) — nothing typed or computed here is ever trusted as
 * authoritative.
 */
export function SettlementCreationForm({
  sellerId,
  campaignId,
  eligibleOrders,
}: {
  sellerId: string;
  campaignId: string;
  eligibleOrders: EligibleOrderOption[];
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  const selectedOrders = eligibleOrders.filter((order) => selected.has(order.id));
  const previewTotal = selectedOrders.reduce((sum, order) => sum + order.totalAmount, 0);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await createSettlementAction(sellerId, campaignId, Array.from(selected));
      if (result.formError) {
        setError(result.formError);
        return;
      }
      setSelected(new Set());
      setOpen(false);
    });
  }

  if (eligibleOrders.length === 0) {
    return (
      <p className="text-muted-foreground text-body-sm font-sans">
        Aucune commande encaissée en attente de règlement pour le moment.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {eligibleOrders.map((order) => (
          <li key={order.id} className="flex items-center gap-3">
            <Checkbox
              id={`settle-${order.id}`}
              checked={selected.has(order.id)}
              onCheckedChange={() => toggle(order.id)}
            />
            <Label
              htmlFor={`settle-${order.id}`}
              className="flex flex-1 items-center justify-between gap-4 font-normal"
            >
              <span>
                {order.orderNumber} — {order.customerName}
              </span>
              <span className="tabular-nums">{formatCHF(money(order.totalAmount))}</span>
            </Label>
          </li>
        ))}
      </ul>

      <div className="border-border flex items-center justify-between border-t pt-3">
        <Body className="font-medium">Total sélectionné</Body>
        <Price>{formatCHF(money(previewTotal))}</Price>
      </div>

      {error ? (
        <p role="alert" className="text-danger text-body-sm font-sans">
          {error}
        </p>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <Button type="button" disabled={selected.size === 0} onClick={() => setOpen(true)}>
          Enregistrer le règlement
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la réception de {formatCHF(money(previewTotal))} ?</DialogTitle>
            <DialogDescription>
              Confirmez que Mélodia a reçu ce montant de la part du vendeur. Le montant définitif
              est recalculé par le serveur à partir des commandes sélectionnées.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={pending}>
              {pending ? "Enregistrement…" : "Confirmer le règlement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
