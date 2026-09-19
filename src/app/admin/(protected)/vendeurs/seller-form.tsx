"use client";

import { useActionState } from "react";
import { Field } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/admin/submit-button";
import type { SellerFormState } from "./actions";

export function SellerForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: SellerFormState, formData: FormData) => Promise<SellerFormState>;
  defaultValues?: { firstName?: string; lastName?: string };
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<SellerFormState, FormData>(action, {});

  return (
    <form action={formAction} noValidate className="flex max-w-sm flex-col gap-5">
      {state.formError ? (
        <p role="alert" className="text-danger text-body-sm font-sans">
          {state.formError}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-success text-body-sm font-sans">
          Vendeur enregistré.
        </p>
      ) : null}

      <Field
        label="Prénom"
        name="firstName"
        defaultValue={defaultValues?.firstName}
        errors={state.errors?.firstName}
        required
      />
      <Field
        label="Nom"
        name="lastName"
        defaultValue={defaultValues?.lastName}
        errors={state.errors?.lastName}
        required
      />

      <SubmitButton label={submitLabel} />
    </form>
  );
}
