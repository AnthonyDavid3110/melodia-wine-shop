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
import type { BulkFulfilmentState } from "./actions";

export interface BulkOrderOption {
  id: string;
  orderNumber: string;
  customerName: string;
  bottleCount: number;
}

/**
 * Generic checkbox-selection + confirmation dialog for a bulk
 * fulfilment action (Phase 9 §7/§17-19) — reused for bulk prepare, bulk
 * handoff and bulk delivery by binding `action` to the right server
 * action + fixed args (campaignId, and sellerId where relevant). The
 * server re-validates every id; nothing selected here is trusted as
 * eligibility.
 */
export function BulkFulfilmentForm({
  orders,
  triggerLabel,
  confirmTitleTemplate,
  confirmDescription,
  action,
}: {
  orders: BulkOrderOption[];
  triggerLabel: string;
  /** A plain string containing the literal placeholder `{count}` — Server -> Client Component props cannot carry functions. */
  confirmTitleTemplate: string;
  confirmDescription: string;
  action: (orderIds: string[]) => Promise<BulkFulfilmentState>;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

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

  function toggleAll() {
    setSelected((current) =>
      current.size === orders.length ? new Set() : new Set(orders.map((order) => order.id)),
    );
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await action(Array.from(selected));
      if (result.formError) {
        setError(result.formError);
        return;
      }
      setSelected(new Set());
      setOpen(false);
    });
  }

  if (orders.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Checkbox
          id={`select-all-${triggerLabel}`}
          checked={selected.size === orders.length}
          onCheckedChange={toggleAll}
        />
        <Label htmlFor={`select-all-${triggerLabel}`} className="text-body-sm font-normal">
          Tout sélectionner
        </Label>
      </div>

      <ul className="flex flex-col gap-1.5">
        {orders.map((order) => (
          <li key={order.id} className="flex items-center gap-3">
            <Checkbox
              id={`bulk-${triggerLabel}-${order.id}`}
              checked={selected.has(order.id)}
              onCheckedChange={() => toggle(order.id)}
            />
            <Label
              htmlFor={`bulk-${triggerLabel}-${order.id}`}
              className="flex flex-1 items-center justify-between gap-4 font-normal"
            >
              <span>
                {order.orderNumber} — {order.customerName}
              </span>
              <span className="text-muted-foreground tabular-nums">{order.bottleCount} bout.</span>
            </Label>
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="text-danger text-body-sm font-sans">
          {error}
        </p>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <Button
          type="button"
          variant="outline"
          disabled={selected.size === 0}
          onClick={() => setOpen(true)}
        >
          {triggerLabel}
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmTitleTemplate.replace("{count}", String(selected.size))}
            </DialogTitle>
            <DialogDescription>{confirmDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={pending}>
              {pending ? "Enregistrement…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
