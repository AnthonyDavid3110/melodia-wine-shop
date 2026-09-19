"use client";

import { useActionState } from "react";
import { Field, TextField } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/admin/submit-button";
import type { CampaignFormState } from "./actions";

export interface CampaignFormDefaults {
  name?: string;
  publicTitle?: string | null;
  description?: string | null;
  openingDate?: string;
  closingDate?: string;
  defaultSellerTargetAmount?: string;
}

export function CampaignForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: CampaignFormState, formData: FormData) => Promise<CampaignFormState>;
  defaultValues?: CampaignFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<CampaignFormState, FormData>(action, {});

  return (
    <form action={formAction} noValidate className="flex max-w-[720px] flex-col gap-6">
      {state.formError ? (
        <p role="alert" className="text-danger text-body-sm font-sans">
          {state.formError}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-success text-body-sm font-sans">
          Campagne enregistrée.
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
          label="Titre public"
          name="publicTitle"
          defaultValue={defaultValues?.publicTitle}
          errors={state.errors?.publicTitle}
          hint="Le nom ci-dessus est utilisé par défaut si vide."
        />
      </div>

      <TextField
        label="Description"
        name="description"
        defaultValue={defaultValues?.description}
        errors={state.errors?.description}
      />

      <Field
        label="Objectif par vendeur par défaut (CHF)"
        name="defaultSellerTargetAmount"
        defaultValue={defaultValues?.defaultSellerTargetAmount}
        errors={state.errors?.defaultSellerTargetAmount}
        hint="Utilisé pour tout vendeur sans objectif spécifique."
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-label font-sans">Période indicative</legend>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Date d'ouverture"
            name="openingDate"
            defaultValue={defaultValues?.openingDate}
            errors={state.errors?.openingDate}
            hint="jj.mm.aaaa"
          />
          <Field
            label="Date de clôture"
            name="closingDate"
            defaultValue={defaultValues?.closingDate}
            errors={state.errors?.closingDate}
            hint="jj.mm.aaaa"
          />
        </div>
      </fieldset>

      <div>
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
