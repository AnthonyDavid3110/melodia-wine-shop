"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { generateUniqueSlug } from "@/domain/slug";
import {
  DuplicateProductSlugError,
  ProductNotFoundError,
  createProduct,
  getProduct,
  productSlugExists,
  setProductActive,
  updateProduct,
} from "@/infrastructure/products/products";
import { productFormSchema, type ProductFormValues } from "./schema";

export interface ProductFormState {
  errors?: Partial<Record<keyof ProductFormValues, string[]>>;
  formError?: string;
  success?: boolean;
}

function toProductInput(values: ProductFormValues, slug: string) {
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
    imageUrl: values.imageUrl || null,
  };
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

  const slug = await generateUniqueSlug(parsed.data.name, productSlugExists);

  let createdId: string;
  try {
    const product = await createProduct(toProductInput(parsed.data, slug));
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

  try {
    await updateProduct(id, toProductInput(parsed.data, existing.slug));
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
