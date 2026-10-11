import { z } from "zod";

/**
 * Bundle field validation (Phase 5 Gate 2B/2C §6). Price is a separate
 * CHF text field, parsed via `parseCHF` in the action. `slug` is absent
 * (Gate 2C §6) — generated automatically on create, preserved unchanged
 * on edit.
 *
 * `imageUrl` is deliberately NOT a field here (Phase 15, Gate
 * ARCH-006-E): the legacy manual-URL text field was removed from the
 * admin form, mirroring the product form (Gate ARCH-006-D). `imageUrl`
 * is now computed server-side in `actions.ts` exclusively from a
 * validated/uploaded `File` (or preserved/nulled), never from a
 * client-supplied string — a forged `FormData.imageUrl` field has
 * nothing to attach to, since this schema has no such key.
 */
export const bundleFormSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(200),
  shortDescription: z.string().trim().max(280).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  price: z
    .string()
    .trim()
    .min(1, "Le prix est requis.")
    .refine((value) => /^\d+([.,]\d{1,2})?$/.test(value), {
      message: "Montant invalide — utilisez un nombre avec au plus 2 décimales.",
    }),
});

export type BundleFormValues = z.infer<typeof bundleFormSchema>;
