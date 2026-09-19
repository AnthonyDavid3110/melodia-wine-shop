"use client";

import { useActionState, useMemo, useState } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/admin/submit-button";
import type { CompositionFormState } from "./actions";

export interface CompositionCandidate {
  productId: string;
  name: string;
}

interface CompositionRow {
  productId: string;
  name: string;
  quantity: number;
}

export function CompositionEditor({
  action,
  initialItems,
  candidates,
}: {
  action: (prevState: CompositionFormState, formData: FormData) => Promise<CompositionFormState>;
  initialItems: CompositionRow[];
  candidates: CompositionCandidate[];
}) {
  const [rows, setRows] = useState<CompositionRow[]>(initialItems);
  const [picking, setPicking] = useState<string | null>(null);
  const [state, formAction] = useActionState<CompositionFormState, FormData>(action, {});

  const nameById = useMemo(
    () => new Map(candidates.map((c) => [c.productId, c.name])),
    [candidates],
  );
  const usedIds = new Set(rows.map((r) => r.productId));
  const options: ComboboxOption[] = candidates
    .filter((c) => !usedIds.has(c.productId))
    .map((c) => ({ value: c.productId, label: c.name }));

  function addComponent(productId: string | null) {
    if (!productId) return;
    const name = nameById.get(productId) ?? productId;
    setRows((current) => [...current, { productId, name, quantity: 1 }]);
    setPicking(null);
  }

  function updateQuantity(productId: string, quantity: number) {
    setRows((current) => current.map((r) => (r.productId === productId ? { ...r, quantity } : r)));
  }

  function removeComponent(productId: string) {
    setRows((current) => current.filter((r) => r.productId !== productId));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.formError ? (
        <p role="alert" className="text-danger text-body-sm font-sans">
          {state.formError}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-success text-body-sm font-sans">
          Composition enregistrée.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-body-sm font-sans">
          Aucun composant pour le moment.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.productId}
              className="border-border flex items-center gap-3 border px-3 py-2"
            >
              <span className="text-body-sm flex-1 font-sans">{row.name}</span>
              <Label htmlFor={`qty-${row.productId}`} className="sr-only">
                Quantité pour {row.name}
              </Label>
              <Input
                id={`qty-${row.productId}`}
                type="number"
                min={1}
                step={1}
                value={row.quantity}
                onChange={(event) =>
                  updateQuantity(row.productId, Math.max(1, Number(event.target.value) || 1))
                }
                className="w-20"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeComponent(row.productId)}
                aria-label={`Retirer ${row.name} de la composition`}
              >
                Retirer
              </Button>
            </li>
          ))}
        </ul>
      )}

      {options.length > 0 ? (
        <div className="flex items-end gap-2">
          <div className="flex min-w-64 flex-col gap-1.5">
            <Label htmlFor="add-component">Ajouter un composant</Label>
            <Combobox
              options={options}
              value={picking}
              onChange={addComponent}
              placeholder="Choisir un vin de la campagne…"
              searchPlaceholder="Rechercher…"
              triggerAriaLabel="Choisir un vin à ajouter à la composition du carton"
            />
          </div>
        </div>
      ) : null}

      <input
        type="hidden"
        name="items"
        value={JSON.stringify(rows.map(({ productId, quantity }) => ({ productId, quantity })))}
      />
      <SubmitButton label="Enregistrer la composition" pendingLabel="Enregistrement…" />
    </form>
  );
}
