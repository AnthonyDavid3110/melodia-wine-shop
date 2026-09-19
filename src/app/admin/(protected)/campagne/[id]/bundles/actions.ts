"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/dal";
import { parseCHF } from "@/domain/money";
import { generateUniqueSlug } from "@/domain/slug";
import {
  BundleNotFoundError,
  DuplicateBundleComponentError,
  DuplicateBundleSlugError,
  InvalidBundleComponentError,
  bundleSlugExists,
  createBundle,
  getBundle,
  replaceBundleComposition,
  setBundleActive,
  updateBundleFields,
} from "@/infrastructure/campaign/bundles";
import { bundleFormSchema, type BundleFormValues } from "./schema";

export interface BundleFormState {
  errors?: Partial<Record<keyof BundleFormValues, string[]>>;
  formError?: string;
  success?: boolean;
}

function toBundleInput(values: BundleFormValues, priceAmount: number, slug: string) {
  return {
    name: values.name,
    slug,
    shortDescription: values.shortDescription || null,
    description: values.description || null,
    priceAmount,
    imageUrl: values.imageUrl || null,
  };
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

  const slug = await generateUniqueSlug(parsed.data.name, bundleSlugExists);

  let createdId: string;
  try {
    const bundle = await createBundle(
      campaignId,
      toBundleInput(parsed.data, parsedPrice.value, slug),
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
  if (!existing) {
    return { formError: new BundleNotFoundError(bundleId).message };
  }

  try {
    await updateBundleFields(
      bundleId,
      toBundleInput(parsed.data, parsedPrice.value, existing.slug),
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
  await setBundleActive(bundleId, active);
  revalidatePath(`/admin/campagne/${campaignId}`);
  revalidatePath(`/admin/campagne/${campaignId}/bundles/${bundleId}`);
  revalidatePath("/");
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
