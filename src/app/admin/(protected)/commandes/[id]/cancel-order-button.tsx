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
import { cancelOrderAction, type CancelOrderState } from "./actions";

/** Explicit-confirmation cancellation (Phase 7 §20, BR-CAN-001) — same Dialog pattern as campaign lifecycle transitions. */
export function CancelOrderButton({
  orderId,
  alreadyPaid,
}: {
  orderId: string;
  alreadyPaid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const action = cancelOrderAction.bind(null, orderId);
  const [state, formAction, isPending] = useActionState<CancelOrderState, FormData>(action, {});

  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (open && !state.formError) {
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="destructive" type="button" onClick={() => setOpen(true)}>
        Annuler la commande
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler cette commande ?</DialogTitle>
          <DialogDescription>
            Cette commande sera exclue du chiffre d&rsquo;affaires actif, des besoins en bouteilles,
            de la préparation et de l&rsquo;objectif du vendeur. Elle reste consultable, jamais
            supprimée.
            {alreadyPaid ? (
              <span className="text-warning mt-2 block font-medium">
                Cette commande a déjà été payée. L&rsquo;annulation n&rsquo;implique pas
                automatiquement un remboursement — cela reste à traiter séparément.
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {state.formError ? (
          <p role="alert" className="text-danger text-body-sm font-sans">
            {state.formError}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Retour
          </Button>
          <form action={formAction}>
            <Button variant="destructive" type="submit" disabled={isPending}>
              {isPending ? "Annulation…" : "Annuler la commande"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
