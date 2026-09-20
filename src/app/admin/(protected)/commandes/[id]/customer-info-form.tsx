"use client";

import { useActionState } from "react";
import { Field, TextField } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/admin/submit-button";
import { updateOrderCustomerInfoAction, type CustomerInfoFormState } from "./actions";

export interface CustomerInfoDefaults {
  customerFirstName: string;
  customerLastName: string;
  customerAddress: string;
  customerPostalCode: string;
  customerCity: string;
  customerEmail: string;
  customerPhone: string;
  deliveryNote: string | null;
}

export function CustomerInfoForm({
  orderId,
  defaultValues,
}: {
  orderId: string;
  defaultValues: CustomerInfoDefaults;
}) {
  const action = updateOrderCustomerInfoAction.bind(null, orderId);
  const [state, formAction] = useActionState<CustomerInfoFormState, FormData>(action, {});

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {state.formError ? (
        <p role="alert" className="text-danger text-body-sm font-sans">
          {state.formError}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-success text-body-sm font-sans">
          Modifications enregistrées.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Prénom"
          name="customerFirstName"
          defaultValue={defaultValues.customerFirstName}
          errors={state.errors?.customerFirstName}
          required
        />
        <Field
          label="Nom"
          name="customerLastName"
          defaultValue={defaultValues.customerLastName}
          errors={state.errors?.customerLastName}
          required
        />
      </div>
      <Field
        label="Adresse"
        name="customerAddress"
        defaultValue={defaultValues.customerAddress}
        errors={state.errors?.customerAddress}
        required
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,140px)_1fr]">
        <Field
          label="NPA"
          name="customerPostalCode"
          defaultValue={defaultValues.customerPostalCode}
          errors={state.errors?.customerPostalCode}
          required
        />
        <Field
          label="Localité"
          name="customerCity"
          defaultValue={defaultValues.customerCity}
          errors={state.errors?.customerCity}
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="E-mail"
          name="customerEmail"
          type="email"
          defaultValue={defaultValues.customerEmail}
          errors={state.errors?.customerEmail}
          required
        />
        <Field
          label="Téléphone"
          name="customerPhone"
          type="tel"
          defaultValue={defaultValues.customerPhone}
          errors={state.errors?.customerPhone}
          required
        />
      </div>
      <TextField
        label="Remarque de livraison"
        name="deliveryNote"
        defaultValue={defaultValues.deliveryNote}
        errors={state.errors?.deliveryNote}
      />

      <div>
        <SubmitButton label="Enregistrer" />
      </div>
    </form>
  );
}
