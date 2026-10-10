"use client";

import * as React from "react";
import { useActionState } from "react";
import { Field, FieldError, TextField } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/admin/submit-button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { BodySmall } from "@/components/ui/typography";
import { RemoveProductImageButton } from "./remove-product-image-button";
import type { ProductFormState } from "./actions";

const CATEGORY_SUGGESTIONS: Array<{ value: string; label: string }> = [
  { value: "WHITE", label: "Blanc" },
  { value: "RED", label: "Rouge" },
  { value: "ROSE", label: "Rosé" },
];

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";

export interface ProductFormDefaults {
  id?: string;
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

/**
 * Local-file preview + selection (Phase 15, Gate ARCH-006-D). Entirely
 * client-side — `URL.createObjectURL()`/`revokeObjectURL()`, no server
 * round-trip just to preview. The actual upload/validation happens
 * server-side in `actions.ts` on normal form submission; this component
 * never uploads anything itself.
 */
function ProductImageField({
  productId,
  existingImageUrl,
}: {
  productId?: string;
  existingImageUrl?: string | null;
}) {
  const [preview, setPreview] = React.useState<{ url: string; name: string } | null>(null);

  React.useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current.url);
      }
      if (!file) {
        return null;
      }
      return { url: URL.createObjectURL(file), name: file.name };
    });
  }

  const hasExisting = Boolean(existingImageUrl);

  return (
    <div className="flex flex-col gap-2.5">
      <Label htmlFor="image">Photo du vin</Label>

      <div className="flex flex-wrap items-start gap-4">
        {preview ? (
          <div className="flex flex-col gap-1.5">
            <BodySmall className="text-muted-foreground">Nouvelle image</BodySmall>
            {/* Plain <img>, not next/image: `preview.url` is an ephemeral
                local `blob:` object URL — next/image's remote optimizer
                has no way to fetch/allowlist that scheme, and there is
                nothing to optimize for a never-uploaded local preview. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.url}
              alt={`Aperçu local de « ${preview.name} », pas encore enregistré`}
              className="border-border h-28 w-28 rounded-lg border object-cover"
            />
          </div>
        ) : hasExisting ? (
          <div className="flex flex-col gap-1.5">
            <BodySmall className="text-muted-foreground">Image actuelle</BodySmall>
            {/* Plain <img>, not next/image: `next/image` THROWS a hard
                render error (not a graceful broken-image fallback) for
                any host outside `images.remotePatterns` — verified
                directly during this gate (it crashed this entire page
                in the Playwright fake-storage-provider suite, since
                `fake-blob.test` is deliberately never allowlisted). A
                real Blob-hosted URL would normally be in the allowlist,
                but this admin thumbnail must stay robust even if it
                ever isn't — a small fixed-size admin preview is not
                worth that fragility, unlike the public catalogue. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={existingImageUrl ?? undefined}
              alt="Photo actuelle du vin"
              className="border-border h-28 w-28 rounded-lg border object-cover"
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Input
            id="image"
            name="image"
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            aria-describedby="image-hint"
            onChange={handleFileChange}
            className="h-auto py-1.5"
          />
          <p id="image-hint" className="text-muted-foreground text-body-sm font-sans">
            JPG, PNG ou WebP — 5 Mo maximum.
          </p>
          {hasExisting && productId ? (
            <div className="mt-1">
              <RemoveProductImageButton productId={productId} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
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

      <ProductImageField productId={defaultValues?.id} existingImageUrl={defaultValues?.imageUrl} />

      <div>
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
