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
import { resendOrderConfirmationAction, type ResendConfirmationState } from "./actions";

/**
 * Manual admin resend (Phase 11 Gate 11C) — same explicit-confirmation
 * Dialog pattern as `MarkPaymentReceivedButton`. Eligibility and the
 * confirmation variant are determined entirely server-side (see
 * `resolveOrderConfirmationEligibility`); this component only ever
 * submits `orderId` — never a variant, recipient, subject, or body.
 *
 * Deliberately does NOT auto-close on success (unlike
 * `CancelOrderButton`/`MarkPaymentReceivedButton`, where the dialog
 * closing IS the feedback because the page's own visible state — a
 * status badge, an amount — changes). A resend leaves no other visible
 * change on the page, so the explicit success message below is the
 * only feedback the admin gets; closing early would hide it.
 */
export function ResendConfirmationButton({
  orderId,
  customerEmail,
  variantDescription,
}: {
  orderId: string;
  customerEmail: string;
  variantDescription: string;
}) {
  const [open, setOpen] = useState(false);
  const action = resendOrderConfirmationAction.bind(null, orderId);
  const [state, formAction, isPending] = useActionState<ResendConfirmationState, FormData>(
    action,
    {},
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" type="button" onClick={() => setOpen(true)}>
        Renvoyer la confirmation
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renvoyer la confirmation à {customerEmail} ?</DialogTitle>
          <DialogDescription>{variantDescription}</DialogDescription>
        </DialogHeader>
        {state.formError ? (
          <p role="alert" className="text-danger text-body-sm font-sans">
            {state.formError}
          </p>
        ) : null}
        {state.success ? (
          <p role="status" className="text-success text-body-sm font-sans">
            E-mail de confirmation envoyé.
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Fermer
          </Button>
          <form action={formAction}>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Envoi…" : "Renvoyer la confirmation"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
