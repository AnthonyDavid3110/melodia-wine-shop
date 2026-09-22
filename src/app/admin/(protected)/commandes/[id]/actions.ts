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
import {
  handOrderToSeller,
  markOrderDelivered,
  markOrderPrepared,
} from "@/infrastructure/fulfilment/fulfilment";
import {
  MultipleUnresolvedPaymentAttemptsError,
  NoReconcilablePaymentAttemptError,
  reconcileOnlinePaymentForOrder,
} from "@/infrastructure/payments/online-payments";

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

/**
 * Phase 9 single-order fulfilment actions. Routine, reversible-in-
 * effect-only-forward operational steps (docs/06-ADMIN-SPEC.md §54) —
 * unlike cancellation/mark-paid, these are direct one-click actions
 * with no confirmation dialog, matching the same plain-form pattern as
 * `setSellerActiveAction`. The order-detail page only ever renders
 * these forms when the matching pure guard already agrees, so a thrown
 * error here means a genuine race/stale-page edge case rather than an
 * expected outcome.
 */
export async function markOrderPreparedAction(orderId: string) {
  const admin = await requireAdmin();
  await markOrderPrepared(orderId, admin.adminId);
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/commandes");
  revalidatePath("/admin/preparation");
}

export async function handOrderToSellerAction(orderId: string) {
  const admin = await requireAdmin();
  await handOrderToSeller(orderId, admin.adminId);
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/commandes");
  revalidatePath("/admin/preparation");
}

export async function markOrderDeliveredAction(orderId: string) {
  const admin = await requireAdmin();
  await markOrderDelivered(orderId, admin.adminId);
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/commandes");
  revalidatePath("/admin/preparation");
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

export interface ReconcileOnlinePaymentState {
  formError?: string;
}

/**
 * "Vérifier auprès de Saferpay" (Phase 10 Gate 10C-B1 §22) — trusted
 * manual recovery for a `NEW` online Order whose Saferpay notification
 * was lost or whose browser never returned. Delegates entirely to
 * `reconcileOnlinePaymentForOrder()`, which itself delegates to the
 * exact same `confirmOnlinePayment()` the browser return route and the
 * notify webhook use — this action can never force PAID; it only ever
 * asks Saferpay for the authoritative current state.
 */
export async function reconcileOnlinePaymentAction(
  orderId: string,
): Promise<ReconcileOnlinePaymentState> {
  await requireAdmin();

  try {
    await reconcileOnlinePaymentForOrder(orderId);
  } catch (error) {
    if (
      error instanceof OrderNotFoundError ||
      error instanceof NoReconcilablePaymentAttemptError ||
      error instanceof MultipleUnresolvedPaymentAttemptsError
    ) {
      return { formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/commandes");
  return {};
}
