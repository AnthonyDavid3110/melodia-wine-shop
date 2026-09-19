"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import {
  SellerNotFoundError,
  createSeller,
  setSellerActive,
  updateSeller,
} from "@/infrastructure/sellers/sellers";
import { sellerFormSchema, type SellerFormValues } from "./schema";

export interface SellerFormState {
  errors?: Partial<Record<keyof SellerFormValues, string[]>>;
  formError?: string;
  success?: boolean;
}

/** Same redirect-outside-try/catch discipline as produits/actions.ts — see the comment there. */
export async function createSellerAction(
  _prevState: SellerFormState,
  formData: FormData,
): Promise<SellerFormState> {
  await requireAdmin();

  const parsed = sellerFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const seller = await createSeller(parsed.data);

  revalidatePath("/admin/vendeurs");
  redirect(`/admin/vendeurs/${seller.id}`);
}

export async function updateSellerAction(
  id: string,
  _prevState: SellerFormState,
  formData: FormData,
): Promise<SellerFormState> {
  await requireAdmin();

  const parsed = sellerFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await updateSeller(id, parsed.data);
  } catch (error) {
    if (error instanceof SellerNotFoundError) {
      return { formError: error.message };
    }
    throw error;
  }

  revalidatePath("/admin/vendeurs");
  revalidatePath(`/admin/vendeurs/${id}`);
  return { success: true };
}

export async function setSellerActiveAction(id: string, active: boolean) {
  await requireAdmin();
  await setSellerActive(id, active);
  revalidatePath("/admin/vendeurs");
  revalidatePath(`/admin/vendeurs/${id}`);
}
