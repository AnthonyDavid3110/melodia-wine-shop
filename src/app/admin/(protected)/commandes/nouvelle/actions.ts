"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { orderCreationInputSchema } from "@/domain/orders/order-input-schema";
import { createOrder } from "@/infrastructure/orders/create-order";

export interface ManualOrderFormState {
  errors?: Partial<Record<string, string[]>>;
  formError?: string;
}

/**
 * Manual/paper-order entry (Phase 7 §21) — calls the EXACT SAME
 * `createOrder` core as public checkout, just with `source: "MANUAL"`
 * and an `ADMIN` actor. No second order-insert pipeline
 * (docs/02-BUSINESS-RULES.md BR-SRC-002, CLAUDE.md §19). Prices are
 * still resolved authoritatively server-side from the live campaign —
 * the admin never types a price.
 */
export async function createManualOrderAction(payload: unknown): Promise<ManualOrderFormState> {
  const admin = await requireAdmin();

  const parsed = orderCreationInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  let result;
  try {
    result = await createOrder(
      parsed.data,
      { type: "ADMIN", adminUserId: admin.adminId },
      "MANUAL",
    );
  } catch {
    return { formError: "La commande n'a pas pu être enregistrée. Veuillez réessayer." };
  }

  if (result.status === "rejected") {
    const { reason } = result;
    if (reason === "empty-cart") {
      return { formError: "Ajoutez au moins un article." };
    }
    if (reason === "no-active-campaign" || reason === "stale-campaign") {
      return { formError: "Aucune campagne active. Impossible de créer une commande." };
    }
    if (reason === "invalid-seller") {
      return { formError: "Ce membre n'est plus disponible pour cette campagne." };
    }
    return {
      formError: "Un ou plusieurs articles ne sont plus disponibles dans la campagne active.",
    };
  }

  redirect(`/admin/commandes/${result.order.id}`);
}
