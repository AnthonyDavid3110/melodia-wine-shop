"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import { parseCHF } from "@/domain/money";
import {
  attachProductToCampaign,
  moveCampaignProduct,
  setCampaignProductActive,
  setCampaignProductPrice,
} from "@/infrastructure/campaign/campaign-products";
import { CampaignNotFoundError } from "@/infrastructure/campaign/campaigns";
import { ProductNotFoundError } from "@/infrastructure/products/products";

export interface AttachProductFormState {
  formError?: string;
  success?: boolean;
}

/**
 * Every action here starts with `requireAdmin()` and revalidates both
 * the campaign page and `/` (Gate 2B §16) — unconditionally, matching
 * the Gate 2A `produits/actions.ts` precedent, rather than adding a
 * conditional "is this campaign currently ACTIVE" check purely to skip
 * one cheap revalidation.
 */
export async function attachCampaignProductAction(
  campaignId: string,
  _prevState: AttachProductFormState,
  formData: FormData,
): Promise<AttachProductFormState> {
  await requireAdmin();

  const productId = String(formData.get("productId") ?? "");
  const priceInput = String(formData.get("price") ?? "");
  if (!productId) {
    return { formError: "Veuillez sélectionner un vin." };
  }
  const parsedPrice = parseCHF(priceInput);
  if (!parsedPrice.ok) {
    return { formError: parsedPrice.error };
  }

  try {
    await attachProductToCampaign(campaignId, productId, parsedPrice.value);
  } catch (error) {
    if (error instanceof CampaignNotFoundError || error instanceof ProductNotFoundError) {
      return { formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/admin/campagne/${campaignId}`);
  revalidatePath("/");
  return { success: true };
}

export async function setCampaignProductPriceAction(
  campaignId: string,
  campaignProductId: string,
  _prevState: AttachProductFormState,
  formData: FormData,
): Promise<AttachProductFormState> {
  await requireAdmin();

  const parsedPrice = parseCHF(String(formData.get("price") ?? ""));
  if (!parsedPrice.ok) {
    return { formError: parsedPrice.error };
  }

  await setCampaignProductPrice(campaignProductId, parsedPrice.value);
  revalidatePath(`/admin/campagne/${campaignId}`);
  revalidatePath("/");
  return { success: true };
}

export async function setCampaignProductActiveAction(
  campaignId: string,
  campaignProductId: string,
  active: boolean,
) {
  await requireAdmin();
  await setCampaignProductActive(campaignProductId, active);
  revalidatePath(`/admin/campagne/${campaignId}`);
  revalidatePath("/");
}

export async function moveCampaignProductAction(
  campaignId: string,
  campaignProductId: string,
  direction: "up" | "down",
) {
  await requireAdmin();
  await moveCampaignProduct(campaignId, campaignProductId, direction);
  revalidatePath(`/admin/campagne/${campaignId}`);
  revalidatePath("/");
}
