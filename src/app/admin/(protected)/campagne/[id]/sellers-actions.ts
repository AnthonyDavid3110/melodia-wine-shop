"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import { parseCHF } from "@/domain/money";
import {
  addSellerToCampaign,
  bulkAddActiveSellers,
  setCampaignSellerActive,
  setCampaignSellerTarget,
} from "@/infrastructure/campaign/campaign-sellers";
import { CampaignNotFoundError } from "@/infrastructure/campaign/campaigns";
import { SellerNotFoundError } from "@/infrastructure/sellers/sellers";

export interface AddSellerFormState {
  formError?: string;
  success?: boolean;
}

export async function addCampaignSellerAction(
  campaignId: string,
  _prevState: AddSellerFormState,
  formData: FormData,
): Promise<AddSellerFormState> {
  await requireAdmin();

  const sellerId = String(formData.get("sellerId") ?? "");
  if (!sellerId) {
    return { formError: "Veuillez sélectionner un vendeur." };
  }

  const targetInput = String(formData.get("target") ?? "").trim();
  let targetAmount: number | null = null;
  if (targetInput) {
    const parsed = parseCHF(targetInput);
    if (!parsed.ok) {
      return { formError: parsed.error };
    }
    targetAmount = parsed.value;
  }

  try {
    await addSellerToCampaign(campaignId, sellerId, targetAmount);
  } catch (error) {
    if (error instanceof CampaignNotFoundError || error instanceof SellerNotFoundError) {
      return { formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/admin/campagne/${campaignId}`);
  return { success: true };
}

export async function setCampaignSellerActiveAction(
  campaignId: string,
  campaignSellerId: string,
  active: boolean,
) {
  await requireAdmin();
  await setCampaignSellerActive(campaignSellerId, active);
  revalidatePath(`/admin/campagne/${campaignId}`);
}

export interface TargetFormState {
  formError?: string;
}

export async function setCampaignSellerTargetAction(
  campaignId: string,
  campaignSellerId: string,
  _prevState: TargetFormState,
  formData: FormData,
): Promise<TargetFormState> {
  await requireAdmin();

  const raw = String(formData.get("target") ?? "").trim();
  let targetAmount: number | null = null;
  if (raw) {
    const parsed = parseCHF(raw);
    if (!parsed.ok) {
      return { formError: parsed.error };
    }
    targetAmount = parsed.value;
  }

  await setCampaignSellerTarget(campaignSellerId, targetAmount);
  revalidatePath(`/admin/campagne/${campaignId}`);
  return {};
}

export interface BulkAddState {
  formError?: string;
  message?: string;
}

/** Bound with `.bind(null, campaignId)`; `useActionState` calls it as `(state, formData)`, both ignored here. */
export async function bulkAddActiveSellersAction(campaignId: string): Promise<BulkAddState> {
  await requireAdmin();

  try {
    const result = await bulkAddActiveSellers(campaignId);
    revalidatePath(`/admin/campagne/${campaignId}`);
    return {
      message: `${result.added} vendeur(s) ajouté(s), ${result.reactivated} réactivé(s).`,
    };
  } catch (error) {
    if (error instanceof CampaignNotFoundError) {
      return { formError: error.message };
    }
    throw error;
  }
}
