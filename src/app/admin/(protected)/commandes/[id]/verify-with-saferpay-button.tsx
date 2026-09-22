"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { reconcileOnlinePaymentAction } from "./actions";

/**
 * "Vérifier auprès de Saferpay" (Phase 10 Gate 10C-B1 §22/§24) —
 * trusted manual recovery when a notification was lost or the browser
 * never returned. A safe, idempotent, read-mostly action (it only ever
 * re-derives the authoritative state via Assert/Capture — see
 * `reconcileOnlinePaymentAction`), so — like `FulfilmentSection`'s
 * forward-only steps — it submits directly with no confirmation
 * dialog, unlike the genuinely destructive mark-paid/cancel actions.
 */
export function VerifyWithSaferpayButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await reconcileOnlinePaymentAction(orderId);
      if (result.formError) {
        setError(result.formError);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleClick}>
        {pending ? "Vérification…" : "Vérifier auprès de Saferpay"}
      </Button>
      {error ? (
        <p role="alert" className="text-danger text-body-sm font-sans">
          {error}
        </p>
      ) : null}
    </div>
  );
}
