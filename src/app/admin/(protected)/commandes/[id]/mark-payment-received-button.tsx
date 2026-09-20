"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { markCustomerPaymentReceivedAction, type MarkPaymentReceivedState } from "./actions";

/**
 * Customer → seller confirmation (Phase 8 §8, docs/09-SECURITY.md §64)
 * — same explicit-confirmation Dialog pattern as `CancelOrderButton`.
 * The confirmation names the authoritative amount so an admin can never
 * mistake this for "money has reached Mélodia" — that is the separate,
 * later settlement action.
 */
export function MarkPaymentReceivedButton({
  orderId,
  formattedAmount,
}: {
  orderId: string;
  formattedAmount: string;
}) {
  const [open, setOpen] = useState(false);
  const action = markCustomerPaymentReceivedAction.bind(null, orderId);
  const [state, formAction, isPending] = useActionState<MarkPaymentReceivedState, FormData>(
    action,
    {},
  );

  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (open && !state.formError) {
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" type="button" onClick={() => setOpen(true)}>
        Marquer le paiement client comme reçu
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marquer {formattedAmount} comme encaissé ?</DialogTitle>
          <DialogDescription>
            Confirmez que le client a payé le membre lors de la livraison. Cela n&rsquo;indique pas
            que l&rsquo;argent a déjà été remis à Mélodia — le règlement du vendeur reste une étape
            séparée.
          </DialogDescription>
        </DialogHeader>
        {state.formError ? (
          <p role="alert" className="text-danger text-body-sm font-sans">
            {state.formError}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <form action={formAction}>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Enregistrement…" : "Confirmer l'encaissement"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
