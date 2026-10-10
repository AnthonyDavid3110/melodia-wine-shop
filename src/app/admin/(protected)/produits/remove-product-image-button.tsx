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
import { removeProductImageAction, type RemoveProductImageState } from "./actions";

/**
 * Explicit-confirmation image removal (Phase 15, Gate ARCH-006-D) —
 * same `Dialog` pattern as `CancelOrderButton`
 * (`commandes/[id]/cancel-order-button.tsx`). Only ever clears the
 * database association; the underlying Blob object is never deleted
 * here or by the action it calls (Gate ARCH-006-A's accepted
 * conservative orphan policy).
 */
export function RemoveProductImageButton({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const action = removeProductImageAction.bind(null, productId);
  const [state, formAction, isPending] = useActionState<RemoveProductImageState, FormData>(
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
      <Button variant="outline" type="button" onClick={() => setOpen(true)}>
        Supprimer l&rsquo;image
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer cette image ?</DialogTitle>
          <DialogDescription>
            Le produit n&rsquo;aura plus d&rsquo;image dans le catalogue public jusqu&rsquo;à
            l&rsquo;ajout d&rsquo;une nouvelle. Cette action ne peut pas être annulée depuis cette
            boîte de dialogue.
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
              {isPending ? "Suppression…" : "Supprimer l’image"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
