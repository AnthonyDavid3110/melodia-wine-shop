"use client";

import { useActionState } from "react";
import { Field, FieldError, TextField } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/admin/submit-button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ProductFormState } from "./actions";

const CATEGORY_SUGGESTIONS: Array<{ value: string; label: string }> = [
  { value: "WHITE", label: "Blanc" },
  { value: "RED", label: "Rouge" },
  { value: "ROSE", label: "Rosé" },
];

export interface ProductFormDefaults {
  name?: string;
  producer?: string | null;
  category?: string;
  vintage?: number | null;
  region?: string | null;
  grapeVariety?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  tastingNotes?: string | null;
  imageUrl?: string | null;
}

export function ProductForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  defaultValues?: ProductFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<ProductFormState, FormData>(action, {});

  return (
    <form action={formAction} noValidate className="flex max-w-[720px] flex-col gap-6">
      {state.formError ? (
        <p role="alert" className="text-danger text-body-sm font-sans">
          {state.formError}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-success text-body-sm font-sans">
          Produit enregistré.
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
          label="Producteur"
          name="producer"
          defaultValue={defaultValues?.producer}
          errors={state.errors?.producer}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Catégorie</Label>
          <Input
            id="category"
            name="category"
            list="category-suggestions"
            defaultValue={defaultValues?.category ?? ""}
            required
          />
          <datalist id="category-suggestions">
            {CATEGORY_SUGGESTIONS.map((category) => (
              <option key={category.value} value={category.value} label={category.label} />
            ))}
          </datalist>
          <FieldError messages={state.errors?.category} />
        </div>
        <Field
          label="Millésime"
          name="vintage"
          type="number"
          defaultValue={defaultValues?.vintage != null ? String(defaultValues.vintage) : ""}
          errors={state.errors?.vintage}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label="Région"
          name="region"
          defaultValue={defaultValues?.region}
          errors={state.errors?.region}
        />
        <Field
          label="Cépage"
          name="grapeVariety"
          defaultValue={defaultValues?.grapeVariety}
          errors={state.errors?.grapeVariety}
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
      <TextField
        label="Notes de dégustation"
        name="tastingNotes"
        defaultValue={defaultValues?.tastingNotes}
        errors={state.errors?.tastingNotes}
      />

      {/* Image management is deferred (no upload in V1) — kept as a
          collapsed, secondary field so it doesn't compete with normal
          editing, while still submitting/preserving its value whether
          the <details> is open or closed. */}
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
