"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import {
  EmptyFulfilmentSelectionError,
  InvalidBulkFulfilmentSelectionError,
  bulkHandOrdersToSeller,
  bulkMarkOrdersDelivered,
  bulkPrepareOrders,
} from "@/infrastructure/fulfilment/fulfilment";

export interface BulkFulfilmentState {
  formError?: string;
}

function revalidateFulfilmentPaths() {
  revalidatePath("/admin/preparation");
  revalidatePath("/admin/commandes");
}

/**
 * Bulk fulfilment actions (Phase 9 §7/§17-19) — all-or-nothing, called
 * directly (not `useActionState`-bound) matching
 * `createSettlementAction`'s structured-array convention. The server
 * re-resolves and re-validates every submitted order id; the browser's
 * selection is never trusted as eligibility.
 */
export async function bulkPrepareAction(
  campaignId: string,
  orderIds: string[],
): Promise<BulkFulfilmentState> {
  const admin = await requireAdmin();

  try {
    await bulkPrepareOrders({ campaignId, orderIds, adminId: admin.adminId });
  } catch (error) {
    if (
      error instanceof EmptyFulfilmentSelectionError ||
      error instanceof InvalidBulkFulfilmentSelectionError
    ) {
      return { formError: error.message };
    }
    throw error;
  }

  revalidateFulfilmentPaths();
  return {};
}

export async function bulkHandToSellerAction(
  campaignId: string,
  sellerId: string,
  orderIds: string[],
): Promise<BulkFulfilmentState> {
  const admin = await requireAdmin();

  try {
    await bulkHandOrdersToSeller({ campaignId, sellerId, orderIds, adminId: admin.adminId });
  } catch (error) {
    if (
      error instanceof EmptyFulfilmentSelectionError ||
      error instanceof InvalidBulkFulfilmentSelectionError
    ) {
      return { formError: error.message };
    }
    throw error;
  }

  revalidateFulfilmentPaths();
  return {};
}

export async function bulkDeliverAction(
  campaignId: string,
  sellerId: string,
  orderIds: string[],
): Promise<BulkFulfilmentState> {
  const admin = await requireAdmin();

  try {
    await bulkMarkOrdersDelivered({ campaignId, sellerId, orderIds, adminId: admin.adminId });
  } catch (error) {
    if (
      error instanceof EmptyFulfilmentSelectionError ||
      error instanceof InvalidBulkFulfilmentSelectionError
    ) {
      return { formError: error.message };
    }
    throw error;
  }

  revalidateFulfilmentPaths();
  return {};
}
