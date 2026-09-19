"use client";

import { useActionState } from "react";
import { Field, TextField } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/admin/submit-button";
import type { BundleFormState } from "./actions";

export interface BundleFormDefaults {
  name?: string;
  shortDescription?: string | null;
  description?: string | null;
  price?: string;
  imageUrl?: string | null;
}

export function BundleForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: BundleFormState, formData: FormData) => Promise<BundleFormState>;
  defaultValues?: BundleFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<BundleFormState, FormData>(action, {});

  return (
    <form action={formAction} noValidate className="flex max-w-[720px] flex-col gap-6">
      {state.formError ? (
        <p role="alert" className="text-danger text-body-sm font-sans">
          {state.formError}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-success text-body-sm font-sans">
          Carton enregistré.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label="Nom"
          name="name"
          defaultValue={defaultValues?.name}
          errors={state.errors?.name}
          required
        />
        <Field
          label="Prix (CHF)"
          name="price"
          defaultValue={defaultValues?.price}
          errors={state.errors?.price}
          required
        />
      </div>

      <TextField
        label="Description courte"
        name="shortDescription"
        defaultValue={defaultValues?.shortDescription}
        errors={state.errors?.shortDescription}
        hint="Texte principal affiché sur la page publique."
      />
      <TextField
        label="Description"
        name="description"
        defaultValue={defaultValues?.description}
        errors={state.errors?.description}
      />

      {/* Image management is deferred (no upload in V1) — collapsed and
          secondary, but its value still submits/preserves whether the
          <details> is open or closed. */}
      <details className="group">
        <summary className="text-muted-foreground hover:text-foreground text-body-sm w-fit cursor-pointer font-sans">
          Image (avancé)
        </summary>
        <div className="mt-3">
          <Field
            label="URL de l'image"
            name="imageUrl"
            defaultValue={defaultValues?.imageUrl}
            errors={state.errors?.imageUrl}
          />
        </div>
      </details>

      <div>
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
