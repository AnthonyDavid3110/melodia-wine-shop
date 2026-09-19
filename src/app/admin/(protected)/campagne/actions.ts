"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { parseCHF } from "@/domain/money";
import { generateUniqueSlug } from "@/domain/slug";
import type { CampaignStatus } from "@/domain/campaign/campaign-status";
import {
  AnotherCampaignAlreadyActiveError,
  CampaignNotFoundError,
  DuplicateCampaignSlugError,
  InvalidCampaignTransitionError,
  campaignSlugExists,
  createCampaign,
  getCampaign,
  transitionCampaignStatus,
  updateCampaignFields,
  type CampaignFieldsInput,
} from "@/infrastructure/campaign/campaigns";
import { campaignFormSchema, type CampaignFormValues } from "./schema";
import { parseDateInputFr } from "./date-input";

export interface CampaignFormState {
  errors?: Partial<Record<keyof CampaignFormValues, string[]>>;
  formError?: string;
  success?: boolean;
}

export interface CampaignTransitionState {
  formError?: string;
}

/**
 * Shared field mapping — `slug` is deliberately not part of
 * `CampaignFormValues` (Gate 2C §6: no admin-facing slug field). Callers
 * supply the slug separately: generated fresh on create, preserved
 * unchanged from the existing row on update.
 */
function toCampaignInput(
  values: CampaignFormValues,
  slug: string,
): CampaignFieldsInput | { fieldError: string } {
  let defaultSellerTargetAmount: number | null = null;
  if (values.defaultSellerTargetAmount) {
    const parsed = parseCHF(values.defaultSellerTargetAmount);
    if (!parsed.ok) {
      return { fieldError: parsed.error };
    }
    defaultSellerTargetAmount = parsed.value;
  }

  const opening = parseDateInputFr(values.openingDate ?? "");
  const closing = parseDateInputFr(values.closingDate ?? "");

  return {
    name: values.name,
    slug,
    publicTitle: values.publicTitle || null,
    description: values.description || null,
    openingDate: opening.ok ? opening.value : null,
    closingDate: closing.ok ? closing.value : null,
    defaultSellerTargetAmount,
  };
}

/**
 * Same `redirect()`-outside-`try/catch` discipline as
 * `produits/actions.ts` — see the comment there.
 */
export async function createCampaignAction(
  _prevState: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  await requireAdmin();

  const parsed = campaignFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const slug = await generateUniqueSlug(parsed.data.name, campaignSlugExists);
  const input = toCampaignInput(parsed.data, slug);
  if ("fieldError" in input) {
    return { errors: { defaultSellerTargetAmount: [input.fieldError] } };
  }

  let createdId: string;
  try {
    const campaign = await createCampaign(input);
    createdId = campaign!.id;
  } catch (error) {
    // The auto-generated slug already avoids the common case — this is
    // only a genuine concurrent-create race, not something a normal
    // admin caused, so it's reported generically rather than pointing
    // at a form field that doesn't exist.
    if (error instanceof DuplicateCampaignSlugError) {
      return { formError: "Une campagne très similaire vient d'être créée. Veuillez réessayer." };
    }
    throw error;
  }

  revalidatePath("/admin/campagne");
  redirect(`/admin/campagne/${createdId}`);
}

export async function updateCampaignFieldsAction(
  id: string,
  _prevState: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  await requireAdmin();

  const parsed = campaignFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const existing = await getCampaign(id);
  if (!existing) {
    return { formError: new CampaignNotFoundError(id).message };
  }

  const input = toCampaignInput(parsed.data, existing.slug);
  if ("fieldError" in input) {
    return { errors: { defaultSellerTargetAmount: [input.fieldError] } };
  }

  try {
    await updateCampaignFields(id, input);
  } catch (error) {
    if (error instanceof CampaignNotFoundError) {
      return { formError: error.message };
    }
    throw error;
  }

  revalidatePath("/admin/campagne");
  revalidatePath(`/admin/campagne/${id}`);
  // The campaign being edited may be the current public campaign
  // (Phase 5 Gate 1 §10 — ACTIVE-campaign edits apply immediately).
  revalidatePath("/");
  return { success: true };
}

/**
 * Bound with `.bind(null, id, to)` before being handed to
 * `useActionState`, which then invokes it as `(state, formData)` — both
 * land as extra, intentionally-undeclared arguments here since neither
 * is needed (the dialog carries no fields; `state` is read from the
 * hook's own return value instead).
 */
export async function transitionCampaignStatusAction(
  id: string,
  to: CampaignStatus,
): Promise<CampaignTransitionState> {
  const admin = await requireAdmin();

  try {
    await transitionCampaignStatus(id, to, admin.adminId);
  } catch (error) {
    if (
      error instanceof InvalidCampaignTransitionError ||
      error instanceof AnotherCampaignAlreadyActiveError ||
      error instanceof CampaignNotFoundError
    ) {
      return { formError: error.message };
    }
    throw error;
  }

  revalidatePath("/admin/campagne");
  revalidatePath(`/admin/campagne/${id}`);
  revalidatePath("/");
  return {};
}
