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
import { bulkAddActiveSellersAction, type BulkAddState } from "./sellers-actions";

export function BulkAddSellersButton({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);
  const action = bulkAddActiveSellersAction.bind(null, campaignId);
  const [state, formAction, isPending] = useActionState<BulkAddState, FormData>(action, {});

  // Close the dialog once a submission succeeds — during render, not in
  // a `useEffect` (see campagne/[id]/lifecycle-actions.tsx for why).
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (open && !state.formError) {
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" type="button" onClick={() => setOpen(true)} className="self-start">
        Ajouter tous les vendeurs actifs
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter tous les vendeurs actifs ?</DialogTitle>
          <DialogDescription>
            Chaque vendeur actuellement actif et ne participant pas encore à cette campagne sera
            ajouté ; tout vendeur déjà retiré de cette campagne sera réactivé.
          </DialogDescription>
        </DialogHeader>
        {state.formError ? (
          <p role="alert" className="text-danger text-body-sm font-sans">
            {state.formError}
          </p>
        ) : null}
        {state.message ? (
          <p role="status" className="text-success text-body-sm font-sans">
            {state.message}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Retour
          </Button>
          <form action={formAction}>
            <Button type="submit" disabled={isPending}>
              {isPending ? "En cours…" : "Ajouter tous les vendeurs actifs"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
