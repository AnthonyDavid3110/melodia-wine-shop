"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/dal";
import { parseCHF } from "@/domain/money";
import { generateUniqueSlug } from "@/domain/slug";
import {
  ImageValidationError,
  validateAndNormalizeImage,
} from "@/domain/products/validate-image-upload";
import { generateImagePathname, uploadImage } from "@/infrastructure/storage/upload-image";
import {
  BundleNotFoundError,
  type BundleUpdateInput,
  DuplicateBundleComponentError,
  DuplicateBundleSlugError,
  InvalidBundleComponentError,
  bundleSlugExists,
  createBundle,
  getBundle,
  replaceBundleComposition,
  setBundleActive,
  setBundleImage,
  updateBundleFields,
} from "@/infrastructure/campaign/bundles";
import { bundleFormSchema, type BundleFormValues } from "./schema";

export interface BundleFormState {
  errors?: Partial<Record<keyof BundleFormValues, string[]>>;
  formError?: string;
  success?: boolean;
}

function toBundleInput(
  values: BundleFormValues,
  priceAmount: number,
  slug: string,
  imageUrl: string | null,
) {
  return {
    name: values.name,
    slug,
    shortDescription: values.shortDescription || null,
    description: values.description || null,
    priceAmount,
    imageUrl,
  };
}

/**
 * `updateBundleAction`'s own mapper (Phase 15, Gate ARCH-006-E, mirrors
 * `toProductUpdateInput()` in `produits/actions.ts` exactly) —
 * `imageUrl` is genuinely OMITTED from the returned object (not merely
 * set to `undefined` inline) when `imageUrl` is `undefined` here, so
 * `updateBundleFields()`'s SQL `UPDATE` never mentions that column at
 * all when no new file was uploaded. See `BundleUpdateInput`'s own doc
 * comment in `bundles.ts` for why this — not a fresh pre-write read —
 * is the actual concurrency fix.
 */
function toBundleUpdateInput(
  values: BundleFormValues,
  priceAmount: number,
  slug: string,
  imageUrl: string | null | undefined,
): BundleUpdateInput {
  const base = {
    name: values.name,
    slug,
    shortDescription: values.shortDescription || null,
    description: values.description || null,
    priceAmount,
  };
  return imageUrl === undefined ? base : { ...base, imageUrl };
}

type ImageResolution =
  { ok: true; imageUrl: string | null; uploaded: boolean } | { ok: false; formError: string };

/**
 * Extracts the optional `image` File field (Phase 15, Gate
 * ARCH-006-E) and, when present, validates/normalizes/uploads it
 * BEFORE anything is ever written to the database — the only safe
 * ordering across two independent systems that can't share a real
 * transaction (Gate ARCH-006-A). Never reads an `imageUrl` string
 * field at all: `bundleFormSchema` has no such key, so a forged
 * `FormData.imageUrl` entry has nothing to attach to — the only way
 * this function's result can carry a URL is a URL THIS function itself
 * obtained from a successful Blob upload. Deliberately a separate,
 * near-identical copy of `produits/actions.ts`'s own
 * `resolveImageUpload()` rather than a shared abstraction (approved
 * Gate ARCH-006-E architectural decision) — the underlying validation/
 * storage modules it calls are shared and not duplicated.
 */
async function resolveImageUpload(formData: FormData): Promise<ImageResolution> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: true, imageUrl: null, uploaded: false };
  }

  let normalized;
  try {
    normalized = await validateAndNormalizeImage(file);
  } catch (error) {
    if (error instanceof ImageValidationError) {
      return { ok: false, formError: error.message };
    }
    throw error;
  }

  const pathname = generateImagePathname("bundles", normalized.contentType);
  try {
    const uploaded = await uploadImage({
      bytes: normalized.bytes,
      pathname,
      contentType: normalized.contentType,
    });
    return { ok: true, imageUrl: uploaded.url, uploaded: true };
  } catch {
    // Never exposes provider/SDK details — one generic French message,
    // same posture as every other provider-error surface in this
    // codebase (Resend, Saferpay, and `produits/actions.ts`).
    return { ok: false, formError: "Le téléversement de l'image a échoué. Veuillez réessayer." };
  }
}

/** Same redirect-outside-try/catch discipline as produits/actions.ts — see the comment there. */
export async function createBundleAction(
  campaignId: string,
  _prevState: BundleFormState,
  formData: FormData,
): Promise<BundleFormState> {
  await requireAdmin();

  const parsed = bundleFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const parsedPrice = parseCHF(parsed.data.price);
  if (!parsedPrice.ok) {
    return { errors: { price: [parsedPrice.error] } };
  }

  const imageResult = await resolveImageUpload(formData);
  if (!imageResult.ok) {
    return { formError: imageResult.formError };
  }

  const slug = await generateUniqueSlug(parsed.data.name, bundleSlugExists);

  let createdId: string;
  try {
    const bundle = await createBundle(
      campaignId,
      toBundleInput(parsed.data, parsedPrice.value, slug, imageResult.imageUrl),
    );
    createdId = bundle!.id;
  } catch (error) {
    // The auto-generated slug already avoids the common case — this is
    // only a genuine concurrent-create race.
    if (error instanceof DuplicateBundleSlugError) {
      return { formError: "Un carton très similaire vient d'être créé. Veuillez réessayer." };
    }
    throw error;
  }

  revalidatePath(`/admin/campagne/${campaignId}`);
  redirect(`/admin/campagne/${campaignId}/bundles/${createdId}`);
}

export async function updateBundleAction(
  campaignId: string,
  bundleId: string,
  _prevState: BundleFormState,
  formData: FormData,
): Promise<BundleFormState> {
  await requireAdmin();

  const parsed = bundleFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const parsedPrice = parseCHF(parsed.data.price);
  if (!parsedPrice.ok) {
    return { errors: { price: [parsedPrice.error] } };
  }

  const existing = await getBundle(bundleId);
  // Campaign-ownership re-verified here, independent of the edit
  // page's own `notFound()` check (Gate ARCH-006-E) — a direct Server
  // Action call is not gated by the page that normally renders the
  // form, so "the page already checked this" is not authorization
  // (CLAUDE.md §21). Reported identically to "not found", never
  // distinguished, so this never confirms a bundle id exists under a
  // different campaign.
  //
  // Unlike `setBundleImage()`, this check is NOT repeated inside a
  // transaction wrapping the later `updateBundleFields()` write below
  // — deliberately, not an oversight (Gate ARCH-006-E final-review
  // question): `bundles.campaignId` is set exactly once, in
  // `createBundle()`, and is structurally absent from both
  // `BundleFieldsInput` and `BundleUpdateInput` — no function anywhere
  // in `bundles.ts` can ever reassign it. A value nothing can change
  // cannot go stale between this check and the write that follows, so
  // there is no TOCTOU window here the way there genuinely is for
  // `imageUrl` (which `setProductImage`-equivalent concurrent calls
  // really can mutate, hence that function's own in-transaction
  // re-check).
  if (!existing || existing.campaignId !== campaignId) {
    return { formError: new BundleNotFoundError(bundleId).message };
  }

  const imageResult = await resolveImageUpload(formData);
  if (!imageResult.ok) {
    return { formError: imageResult.formError };
  }

  // `undefined` here means "no new file — leave the column untouched."
  // `toBundleUpdateInput()` turns that into genuinely OMITTING the
  // `imageUrl` key, so `updateBundleFields()`'s SQL `UPDATE` never
  // mentions that column at all in this case (Gate ARCH-006-D review
  // finding, applied here from the start rather than repeating the
  // same mistake: a read-then-write, however late, is still a TOCTOU
  // window, not an atomicity guarantee).
  const imageUrl = imageResult.uploaded ? imageResult.imageUrl : undefined;

  try {
    await updateBundleFields(
      bundleId,
      toBundleUpdateInput(parsed.data, parsedPrice.value, existing.slug, imageUrl),
    );
  } catch (error) {
    if (error instanceof BundleNotFoundError) {
      return { formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/admin/campagne/${campaignId}`);
  revalidatePath(`/admin/campagne/${campaignId}/bundles/${bundleId}`);
  revalidatePath("/");
  return { success: true };
}

export async function setBundleActiveAction(campaignId: string, bundleId: string, active: boolean) {
  await requireAdmin();
  await setBundleActive(bundleId, campaignId, active);
  revalidatePath(`/admin/campagne/${campaignId}`);
  revalidatePath(`/admin/campagne/${campaignId}/bundles/${bundleId}`);
  revalidatePath("/");
}

export interface RemoveBundleImageState {
  formError?: string;
}

/**
 * Standalone remove-image action (Phase 15, Gate ARCH-006-E) — same
 * authenticated/confirmed-dialog shape as `removeProductImageAction`
 * (`produits/actions.ts`), deliberately not folded into the main edit
 * form so it never touches unrelated fields. Only ever nulls the
 * database reference; the underlying Blob object is never deleted
 * (Gate ARCH-006-A's accepted conservative orphan policy). Campaign
 * ownership is independently re-verified by `setBundleImage()` itself
 * (not just here), so this is safe even if ever called with a
 * mismatched campaign/bundle pair. Naturally idempotent — nulling an
 * already-null column succeeds trivially.
 */
export async function removeBundleImageAction(
  campaignId: string,
  bundleId: string,
  _prevState: RemoveBundleImageState,
  _formData: FormData,
): Promise<RemoveBundleImageState> {
  // `useActionState` requires this exact (..., prevState, formData)
  // signature — neither is read, by design (removal takes no form
  // input beyond the already-bound ids). A genuine reference, not a
  // broad eslint-disable, is enough to tell @typescript-eslint/
  // no-unused-vars these are deliberately unused.
  void _prevState;
  void _formData;

  await requireAdmin();

  try {
    await setBundleImage(bundleId, campaignId, null);
  } catch (error) {
    if (error instanceof BundleNotFoundError) {
      return { formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/admin/campagne/${campaignId}`);
  revalidatePath(`/admin/campagne/${campaignId}/bundles/${bundleId}`);
  revalidatePath("/");
  return {};
}

export interface CompositionFormState {
  formError?: string;
  success?: boolean;
}

const compositionSchema = z
  .array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
    }),
  )
  .max(50);

/**
 * Never trusts client-submitted composition rows (Gate 2B §2/§7) — the
 * JSON payload is parsed and shape-validated here, and
 * `replaceBundleComposition` re-validates every id against the real
 * database (duplicate component, cross-campaign product) inside one
 * transaction before writing anything.
 */
export async function replaceBundleCompositionAction(
  campaignId: string,
  bundleId: string,
  _prevState: CompositionFormState,
  formData: FormData,
): Promise<CompositionFormState> {
  await requireAdmin();

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { formError: "Composition invalide." };
  }
  const parsed = compositionSchema.safeParse(raw);
  if (!parsed.success) {
    return { formError: "Composition invalide." };
  }

  try {
    await replaceBundleComposition(bundleId, campaignId, parsed.data);
  } catch (error) {
    if (
      error instanceof BundleNotFoundError ||
      error instanceof DuplicateBundleComponentError ||
      error instanceof InvalidBundleComponentError
    ) {
      return { formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/admin/campagne/${campaignId}`);
  revalidatePath(`/admin/campagne/${campaignId}/bundles/${bundleId}`);
  revalidatePath("/");
  return { success: true };
}
