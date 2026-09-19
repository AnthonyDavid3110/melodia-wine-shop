"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/admin/submit-button";
import type { TargetFormState } from "./sellers-actions";

export function SellerTargetForm({
  action,
  defaultValue,
  sellerLabel,
}: {
  action: (prevState: TargetFormState, formData: FormData) => Promise<TargetFormState>;
  defaultValue: string;
  sellerLabel: string;
}) {
  const [state, formAction] = useActionState<TargetFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Input
        name="target"
        defaultValue={defaultValue}
        placeholder="Objectif de la campagne"
        className="w-36"
        aria-label={`Objectif spécifique pour ${sellerLabel}`}
      />
      <SubmitButton label="Enregistrer" pendingLabel="…" />
      {state.formError ? (
        <span role="alert" className="text-danger text-body-sm font-sans">
          {state.formError}
        </span>
      ) : null}
    </form>
  );
}
