"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import { customerInfoSchema } from "@/domain/orders/order-input-schema";
import {
  InvalidSellerAssignmentError,
  OrderAlreadyCancelledError,
  OrderNotCancellableError,
  OrderNotFoundError,
  OrderNotPayableError,
  SellerReassignmentBlockedError,
  assignOrderSeller,
  cancelOrder,
  markCustomerPaymentReceived,
  updateOrderCustomerInfo,
} from "@/infrastructure/orders/orders";

export interface CustomerInfoFormState {
  errors?: Partial<Record<string, string[]>>;
  formError?: string;
  success?: boolean;
}

/** Every Server Action here starts with `requireAdmin()` — same boundary as every other admin mutation (Phase 3). */
export async function updateOrderCustomerInfoAction(
  orderId: string,
  _prevState: CustomerInfoFormState,
  formData: FormData,
): Promise<CustomerInfoFormState> {
  const admin = await requireAdmin();

  const parsed = customerInfoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await updateOrderCustomerInfo(
      orderId,
      { ...parsed.data, deliveryNote: parsed.data.deliveryNote || null },
      admin.adminId,
    );
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      return { formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/admin/commandes/${orderId}`);
  return { success: true };
}

export interface SellerAssignmentState {
  formError?: string;
}

export async function assignOrderSellerAction(
  orderId: string,
  sellerId: string | null,
): Promise<SellerAssignmentState> {
  const admin = await requireAdmin();

  try {
    await assignOrderSeller(orderId, sellerId, admin.adminId);
  } catch (error) {
    if (
      error instanceof OrderNotFoundError ||
      error instanceof InvalidSellerAssignmentError ||
      error instanceof SellerReassignmentBlockedError
    ) {
      return { formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/commandes");
  return {};
}

export interface CancelOrderState {
  formError?: string;
}

export async function cancelOrderAction(
  orderId: string,
  _prevState: CancelOrderState,
  _formData: FormData,
): Promise<CancelOrderState> {
  const admin = await requireAdmin();

  try {
    await cancelOrder(orderId, admin.adminId);
  } catch (error) {
    if (
      error instanceof OrderNotFoundError ||
      error instanceof OrderAlreadyCancelledError ||
      error instanceof OrderNotCancellableError
    ) {
      return { formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/commandes");
  return {};
}

export interface MarkPaymentReceivedState {
  formError?: string;
}

/**
 * Customer → seller half of Phase 8's offline money flow. Requires
 * explicit confirmation in the UI (docs/09-SECURITY.md §64) — this
 * action itself only enforces the guard server-side; hiding the button
 * is not the authorization boundary.
 */
export async function markCustomerPaymentReceivedAction(
  orderId: string,
  _prevState: MarkPaymentReceivedState,
  _formData: FormData,
): Promise<MarkPaymentReceivedState> {
  const admin = await requireAdmin();

  try {
    await markCustomerPaymentReceived(orderId, admin.adminId);
  } catch (error) {
    if (error instanceof OrderNotFoundError || error instanceof OrderNotPayableError) {
      return { formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/commandes");
  return {};
}
