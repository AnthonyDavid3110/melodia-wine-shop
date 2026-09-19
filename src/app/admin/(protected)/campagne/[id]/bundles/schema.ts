import { z } from "zod";

/**
 * Bundle field validation (Phase 5 Gate 2B/2C §6). Price is a separate
 * CHF text field, parsed via `parseCHF` in the action. `slug` is absent
 * (Gate 2C §6) — generated automatically on create, preserved unchanged
 * on edit.
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
  imageUrl: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || /^https?:\/\//.test(value), {
      message: "L'URL de l'image doit commencer par http:// ou https://.",
    }),
});

export type BundleFormValues = z.infer<typeof bundleFormSchema>;
