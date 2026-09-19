"use client";

import { useActionState, useState } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/admin/submit-button";
import type { AttachProductFormState } from "./campaign-products-actions";

export function AttachProductForm({
  action,
  options,
}: {
  action: (
    prevState: AttachProductFormState,
    formData: FormData,
  ) => Promise<AttachProductFormState>;
  options: ComboboxOption[];
}) {
  const [state, formAction] = useActionState<AttachProductFormState, FormData>(action, {});
  const [productId, setProductId] = useState<string | null>(null);

  if (options.length === 0) {
    return (
      <p className="text-muted-foreground text-body-sm font-sans">
        Tous les produits actifs du catalogue sont déjà attachés à cette campagne.
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
        <Label htmlFor="attach-product">Vin</Label>
        <Combobox
          options={options}
          value={productId}
          onChange={setProductId}
          placeholder="Choisir un vin…"
          searchPlaceholder="Rechercher un vin…"
          triggerAriaLabel="Choisir un vin à ajouter à la campagne"
        />
        <input type="hidden" name="productId" value={productId ?? ""} />
      </div>
      <div className="flex w-32 flex-col gap-1.5">
        <Label htmlFor="attach-product-price">Prix (CHF)</Label>
        <Input id="attach-product-price" name="price" placeholder="18.00" />
      </div>
      <SubmitButton label="Ajouter à la campagne" pendingLabel="Ajout…" />
    </form>
  );
}
