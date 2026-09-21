"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { assignOrderSellerAction } from "./actions";

/**
 * Assign / reassign / unassign (Phase 7 §19). `sellerOptions` is
 * already scoped to eligible sellers for this order's campaign (same
 * `listActiveCampaignSellers` checkout uses) — the server re-validates
 * regardless (`assignOrderSeller`), never trusting this list alone.
 */
export function SellerAssignment({
  orderId,
  orderStatus,
  currentSellerId,
  sellerOptions,
}: {
  orderId: string;
  /** Drives the Phase 9 §28 contextual warning below — never blocks reassignment itself. */
  orderStatus: string;
  currentSellerId: string | null;
  sellerOptions: { value: string; label: string }[];
}) {
  const [selected, setSelected] = useState<string | null>(currentSellerId);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty = selected !== currentSellerId;
  const alreadyHandedOver = orderStatus === "HANDED_TO_SELLER" || orderStatus === "DELIVERED";

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await assignOrderSellerAction(orderId, selected);
      if (result.formError) {
        setError(result.formError);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {alreadyHandedOver ? (
        <p className="text-warning text-body-sm font-sans">
          Cette commande a déjà été remise à un vendeur. Modifier le vendeur change son attribution
          actuelle mais ne modifie pas l&rsquo;historique de remise/livraison.
        </p>
      ) : null}
      <Combobox
        options={sellerOptions}
        value={selected}
        onChange={setSelected}
        placeholder="Non assigné"
        searchPlaceholder="Rechercher un membre…"
        emptyText="Aucun membre trouvé."
        clearLabel="Non assigné"
        triggerAriaLabel="Vendeur"
        className="max-w-sm"
      />
      {error ? (
        <p role="alert" className="text-danger text-body-sm font-sans">
          {error}
        </p>
      ) : null}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!dirty || pending}
          onClick={handleSubmit}
        >
          {pending ? "Mise à jour…" : "Mettre à jour le vendeur"}
        </Button>
      </div>
    </div>
  );
}
