"use client";

import * as React from "react";
import { useActionState } from "react";
import { Field, TextField } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/admin/submit-button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { BodySmall } from "@/components/ui/typography";
import { RemoveBundleImageButton } from "./remove-bundle-image-button";
import type { BundleFormState } from "./actions";

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";

export interface BundleFormDefaults {
  campaignId?: string;
  bundleId?: string;
  name?: string;
  shortDescription?: string | null;
  description?: string | null;
  price?: string;
  imageUrl?: string | null;
}

/**
 * Local-file preview + selection (Phase 15, Gate ARCH-006-E) — same
 * behavior as `produits/product-form.tsx`'s `ProductImageField`,
 * deliberately a separate copy rather than a shared component (approved
 * Gate ARCH-006-E architectural decision). Entirely client-side —
 * `URL.createObjectURL()`/`revokeObjectURL()`, no server round-trip
 * just to preview. The actual upload/validation happens server-side in
 * `actions.ts` on normal form submission; this component never uploads
 * anything itself.
 */
function BundleImageField({
  campaignId,
  bundleId,
  existingImageUrl,
}: {
  campaignId?: string;
  bundleId?: string;
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
      <Label htmlFor="image">Photo du carton</Label>

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
                directly during Gate ARCH-006-D (it crashed the product
                edit page in the Playwright fake-storage-provider suite,
                since `fake-blob.test` is deliberately never allowlisted).
                A real Blob-hosted URL would normally be in the
                allowlist, but this admin thumbnail must stay robust
                even if it ever isn't — a small fixed-size admin preview
                is not worth that fragility, unlike the public
                catalogue. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={existingImageUrl ?? undefined}
              alt="Photo actuelle du carton"
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
          {hasExisting && campaignId && bundleId ? (
            <div className="mt-1">
              <RemoveBundleImageButton campaignId={campaignId} bundleId={bundleId} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
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

      <BundleImageField
        campaignId={defaultValues?.campaignId}
        bundleId={defaultValues?.bundleId}
        existingImageUrl={defaultValues?.imageUrl}
      />

      <div>
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
