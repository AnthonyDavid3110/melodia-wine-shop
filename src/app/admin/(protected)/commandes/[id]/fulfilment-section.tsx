"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  type FulfilmentActionState,
  handOrderToSellerAction,
  markOrderDeliveredAction,
  markOrderPreparedAction,
} from "./actions";

interface Step {
  label: string;
  completedAt: Date | null;
}

function formatTimestamp(date: Date): string {
  return `${date.toLocaleDateString("fr-CH")} à ${date.toLocaleTimeString("fr-CH", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/**
 * Fulfilment progression + the single explicit next action (Phase 9
 * §27, docs/06-ADMIN-SPEC.md §19) — never a generic status dropdown.
 * These are routine, forward-only operational steps (docs/06 §54), so
 * — unlike cancellation/mark-paid — they submit directly with no
 * confirmation dialog, the same plain-form pattern as
 * `setSellerActiveAction`. Never touches payment/settlement state
 * (Phase 9 §3/§18).
 */
export function FulfilmentSection({
  orderId,
  status,
  hasSeller,
  canPrepare,
  canHandToSeller,
  canMarkDelivered,
  confirmedAt,
  preparedAt,
  handedToSellerAt,
  deliveredAt,
}: {
  orderId: string;
  status: string;
  hasSeller: boolean;
  canPrepare: boolean;
  canHandToSeller: boolean;
  canMarkDelivered: boolean;
  confirmedAt: Date | null;
  preparedAt: Date | null;
  handedToSellerAt: Date | null;
  deliveredAt: Date | null;
}) {
  // Phase 14 Gate 14D: three independent `useActionState` calls, one per
  // button, matching `CancelOrderButton`'s existing pattern — each
  // action now returns a typed `{ formError }` result (a stale-
  // transition or genuine concurrency conflict) instead of throwing
  // unhandled. Hoisted above the `status === "CANCELLED"` early return
  // below: React hooks must run unconditionally on every render, never
  // skipped by a branch.
  const preparedOrderAction = markOrderPreparedAction.bind(null, orderId);
  const handToSellerOrderAction = handOrderToSellerAction.bind(null, orderId);
  const deliveredOrderAction = markOrderDeliveredAction.bind(null, orderId);
  const [prepareState, prepareFormAction, isPreparePending] = useActionState<
    FulfilmentActionState,
    FormData
  >(preparedOrderAction, {});
  const [handToSellerState, handToSellerFormAction, isHandToSellerPending] = useActionState<
    FulfilmentActionState,
    FormData
  >(handToSellerOrderAction, {});
  const [deliverState, deliverFormAction, isDeliverPending] = useActionState<
    FulfilmentActionState,
    FormData
  >(deliveredOrderAction, {});

  if (status === "CANCELLED") {
    return (
      <p className="text-muted-foreground text-body-sm font-sans">
        Commande annulée — le traitement physique ne s&rsquo;applique plus.
      </p>
    );
  }

  const steps: Step[] = [
    { label: "Confirmée", completedAt: confirmedAt },
    { label: "Préparée", completedAt: preparedAt },
    { label: "Remise au vendeur", completedAt: handedToSellerAt },
    { label: "Livrée", completedAt: deliveredAt },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2">
              <StatusBadge tone={step.completedAt ? "success" : "neutral"}>
                {step.label}
              </StatusBadge>
            </span>
            <span className="text-muted-foreground text-body-sm font-sans">
              {step.completedAt ? formatTimestamp(step.completedAt) : "—"}
            </span>
          </li>
        ))}
      </ol>

      {canPrepare ? (
        <form action={prepareFormAction} className="flex flex-col gap-2">
          {prepareState.formError ? (
            <p role="alert" className="text-danger text-body-sm font-sans">
              {prepareState.formError}
            </p>
          ) : null}
          <Button type="submit" variant="outline" disabled={isPreparePending}>
            Marquer comme préparée
          </Button>
        </form>
      ) : null}

      {status === "PREPARED" && !hasSeller ? (
        <p className="text-muted-foreground text-body-sm font-sans">
          Un vendeur doit d&rsquo;abord être assigné à cette commande avant de pouvoir la remettre.
        </p>
      ) : null}

      {canHandToSeller ? (
        <form action={handToSellerFormAction} className="flex flex-col gap-2">
          {handToSellerState.formError ? (
            <p role="alert" className="text-danger text-body-sm font-sans">
              {handToSellerState.formError}
            </p>
          ) : null}
          <Button type="submit" variant="outline" disabled={isHandToSellerPending}>
            Remettre au vendeur
          </Button>
        </form>
      ) : null}

      {canMarkDelivered ? (
        <form action={deliverFormAction} className="flex flex-col gap-2">
          {deliverState.formError ? (
            <p role="alert" className="text-danger text-body-sm font-sans">
              {deliverState.formError}
            </p>
          ) : null}
          <Button type="submit" variant="outline" disabled={isDeliverPending}>
            Marquer comme livrée
          </Button>
        </form>
      ) : null}
    </div>
  );
}
