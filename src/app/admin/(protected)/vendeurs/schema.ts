import { z } from "zod";

/** Seller master-data validation (Phase 5 Gate 2B §9) — only the fields the schema actually has. */
export const sellerFormSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis.").max(100),
  lastName: z.string().trim().min(1, "Le nom est requis.").max(100),
});

export type SellerFormValues = z.infer<typeof sellerFormSchema>;
