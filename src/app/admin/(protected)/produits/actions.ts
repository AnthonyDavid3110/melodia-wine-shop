"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { generateUniqueSlug } from "@/domain/slug";
import {
  ImageValidationError,
  validateAndNormalizeImage,
} from "@/domain/products/validate-image-upload";
import { generateImagePathname, uploadImage } from "@/infrastructure/storage/upload-image";
import {
  DuplicateProductSlugError,
  ProductNotFoundError,
  type ProductUpdateInput,
  createProduct,
  getProduct,
  productSlugExists,
  setProductActive,
  setProductImage,
  updateProduct,
} from "@/infrastructure/products/products";
import { productFormSchema, type ProductFormValues } from "./schema";

export interface ProductFormState {
  errors?: Partial<Record<keyof ProductFormValues, string[]>>;
  formError?: string;
  success?: boolean;
}

function toProductInput(values: ProductFormValues, slug: string, imageUrl: string | null) {
  return {
    name: values.name,
    slug,
    producer: values.producer || null,
    category: values.category,
    vintage: values.vintage ? Number(values.vintage) : null,
    region: values.region || null,
    grapeVariety: values.grapeVariety || null,
    shortDescription: values.shortDescription || null,
    description: values.description || null,
    tastingNotes: values.tastingNotes || null,
    imageUrl,
  };
}

/**
 * `updateProductAction`'s own mapper (Phase 15, Gate ARCH-006-D review
 * finding) — `imageUrl` is genuinely OMITTED from the returned object
 * (not merely set to `undefined` inline) when `imageUrl` is
 * `undefined` here, so `updateProduct()`'s SQL `UPDATE` never mentions
 * that column at all when no new file was uploaded. See
 * `ProductUpdateInput`'s own doc comment in `products.ts` for why this
 * — not a fresh pre-write read — is the actual concurrency fix.
 */
function toProductUpdateInput(
  values: ProductFormValues,
  slug: string,
  imageUrl: string | null | undefined,
): ProductUpdateInput {
  const base = {
    name: values.name,
    slug,
    producer: values.producer || null,
    category: values.category,
    vintage: values.vintage ? Number(values.vintage) : null,
    region: values.region || null,
    grapeVariety: values.grapeVariety || null,
    shortDescription: values.shortDescription || null,
    description: values.description || null,
    tastingNotes: values.tastingNotes || null,
  };
  return imageUrl === undefined ? base : { ...base, imageUrl };
}

type ImageResolution =
  { ok: true; imageUrl: string | null; uploaded: boolean } | { ok: false; formError: string };

/**
 * Extracts the optional `image` File field (Phase 15, Gate
 * ARCH-006-D) and, when present, validates/normalizes/uploads it
 * BEFORE anything is ever written to the database — the only safe
 * ordering across two independent systems that can't share a real
 * transaction (Gate ARCH-006-A). Never reads an `imageUrl` string
 * field at all: `productFormSchema` has no such key, so a forged
 * `FormData.imageUrl` entry has nothing to attach to — the only way
 * this function's result can carry a URL is a URL THIS function itself
 * obtained from a successful Blob upload.
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

  const pathname = generateImagePathname("products", normalized.contentType);
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
    // codebase (Resend, Saferpay).
    return { ok: false, formError: "Le téléversement de l'image a échoué. Veuillez réessayer." };
  }
}

/**
 * Every Server Action in this file starts with `requireAdmin()` — the
 * exact existing authorization boundary (Phase 3), never a second
 * mechanism. `redirect()` is always called *after* any try/catch has
 * fully completed, never from inside one — Next.js implements
 * `redirect()` as a thrown control-flow signal, so catching it
 * accidentally inside a broader `catch` would misreport a successful
 * navigation as an error.
 */
export async function createProductAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin();

  const parsed = productFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const imageResult = await resolveImageUpload(formData);
  if (!imageResult.ok) {
    return { formError: imageResult.formError };
  }

  const slug = await generateUniqueSlug(parsed.data.name, productSlugExists);

  let createdId: string;
  try {
    const product = await createProduct(toProductInput(parsed.data, slug, imageResult.imageUrl));
    createdId = product!.id;
  } catch (error) {
    // The auto-generated slug already avoids the common case — this is
    // only a genuine concurrent-create race.
    if (error instanceof DuplicateProductSlugError) {
      return { formError: "Un produit très similaire vient d'être créé. Veuillez réessayer." };
    }
    throw error;
  }

  revalidatePath("/admin/produits");
  redirect(`/admin/produits/${createdId}`);
}

export async function updateProductAction(
  id: string,
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin();

  const parsed = productFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const existing = await getProduct(id);
  if (!existing) {
    return { formError: new ProductNotFoundError(id).message };
  }

  const imageResult = await resolveImageUpload(formData);
  if (!imageResult.ok) {
    return { formError: imageResult.formError };
  }

  // `undefined` here means "no new file — leave the column untouched."
  // `toProductUpdateInput()` turns that into genuinely OMITTING the
  // `imageUrl` key, so `updateProduct()`'s SQL `UPDATE` never mentions
  // that column at all in this case — not a fresh pre-write read, a
  // real exclusion from the statement itself (Gate ARCH-006-D review
  // finding: a read-then-write, however late, is still a TOCTOU
  // window, not an atomicity guarantee). A concurrent
  // `removeProductImageAction` — or another concurrent edit — can
  // never be clobbered by this write, because this write cannot touch
  // `image_url` at all unless a new file was actually uploaded in THIS
  // request.
  const imageUrl = imageResult.uploaded ? imageResult.imageUrl : undefined;

  try {
    await updateProduct(id, toProductUpdateInput(parsed.data, existing.slug, imageUrl));
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      return { formError: error.message };
    }
    throw error;
  }

  revalidatePath("/admin/produits");
  revalidatePath(`/admin/produits/${id}`);
  // A product's active state/content can be visible on the current
  // public catalog (Product.active AND CampaignProduct.active) —
  // revalidate `/` too so an active campaign reflects the edit
  // immediately rather than waiting on incidental freshness.
  revalidatePath("/");
  return { success: true };
}

export async function setProductActiveAction(id: string, active: boolean) {
  await requireAdmin();
  await setProductActive(id, active);
  revalidatePath("/admin/produits");
  revalidatePath(`/admin/produits/${id}`);
  revalidatePath("/");
}

export interface RemoveProductImageState {
  formError?: string;
}

/**
 * Standalone remove-image action (Phase 15, Gate ARCH-006-D) — same
 * authenticated/confirmed-dialog shape as `cancelOrderAction`
 * (`commandes/[id]/actions.ts`), deliberately not folded into the main
 * edit form so it never touches unrelated fields. Only ever nulls the
 * database reference; the underlying Blob object is never deleted
 * (Gate ARCH-006-A's accepted conservative orphan policy). Naturally
 * idempotent — nulling an already-null column succeeds trivially.
 */
export async function removeProductImageAction(
  id: string,
  _prevState: RemoveProductImageState,
  _formData: FormData,
): Promise<RemoveProductImageState> {
  // `useActionState` requires this exact (id, prevState, formData)
  // signature — neither is read, by design (removal takes no form
  // input beyond the already-bound id). A genuine reference, not a
  // broad eslint-disable, is enough to tell @typescript-eslint/
  // no-unused-vars these are deliberately unused.
  void _prevState;
  void _formData;

  await requireAdmin();

  try {
    await setProductImage(id, null);
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      return { formError: error.message };
    }
    throw error;
  }

  revalidatePath("/admin/produits");
  revalidatePath(`/admin/produits/${id}`);
  revalidatePath("/");
  return {};
}
