"use client";

import { useActionState, useState } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/admin/submit-button";
import type { AddSellerFormState } from "./sellers-actions";

export function AddSellerForm({
  action,
  options,
}: {
  action: (prevState: AddSellerFormState, formData: FormData) => Promise<AddSellerFormState>;
  options: ComboboxOption[];
}) {
  const [state, formAction] = useActionState<AddSellerFormState, FormData>(action, {});
  const [sellerId, setSellerId] = useState<string | null>(null);

  if (options.length === 0) {
    return (
      <p className="text-muted-foreground text-body-sm font-sans">
        Tous les vendeurs actifs participent déjà à cette campagne.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {state.formError ? (
        <p role="alert" className="text-danger text-body-sm w-full font-sans">
          {state.formError}
        </p>
      ) : null}
      <div className="flex min-w-64 flex-col gap-1.5">
        <Label htmlFor="add-seller">Vendeur</Label>
        <Combobox
          options={options}
          value={sellerId}
          onChange={setSellerId}
          placeholder="Choisir un vendeur…"
          searchPlaceholder="Rechercher un vendeur…"
          triggerAriaLabel="Choisir un vendeur à ajouter à la campagne"
        />
        <input type="hidden" name="sellerId" value={sellerId ?? ""} />
      </div>
      <div className="flex w-40 flex-col gap-1.5">
        <Label htmlFor="add-seller-target">Objectif (facultatif)</Label>
        <Input id="add-seller-target" name="target" placeholder="Utilise le défaut" />
      </div>
      <SubmitButton label="Ajouter à la campagne" pendingLabel="Ajout…" />
    </form>
  );
}
