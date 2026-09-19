"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/admin/submit-button";
import type { AttachProductFormState } from "./campaign-products-actions";

export function PriceEditForm({
  action,
  defaultValue,
  productLabel,
}: {
  action: (
    prevState: AttachProductFormState,
    formData: FormData,
  ) => Promise<AttachProductFormState>;
  defaultValue: string;
  productLabel: string;
}) {
  const [state, formAction] = useActionState<AttachProductFormState, FormData>(action, {});

  return (
    <div>
      <form action={formAction} className="flex items-center gap-2">
        <Input
          name="price"
          defaultValue={defaultValue}
          className="w-24"
          aria-label={`Prix pour ${productLabel}`}
        />
        <SubmitButton label="Enregistrer" pendingLabel="…" />
      </form>
      {state.formError ? (
        <p role="alert" className="text-danger text-body-sm mt-1 font-sans">
          {state.formError}
        </p>
      ) : null}
    </div>
  );
}
