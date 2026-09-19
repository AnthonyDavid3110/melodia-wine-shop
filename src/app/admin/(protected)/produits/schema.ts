import { z } from "zod";

/**
 * Product master-data validation (Phase 5 Gate 2A/2C §7). Sanity bounds
 * only — not real business rules — category deliberately stays
 * `z.string()`, never a fixed enum (docs/04-DATA-MODEL.md §6, Gate 1
 * §7): a curated suggestion list is offered in the UI via a
 * `<datalist>`, not enforced server-side. `slug` is absent (Gate 2C
 * §6) — generated automatically on create, preserved unchanged on edit.
 */
export const productFormSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(200),
  producer: z.string().trim().max(200).optional().or(z.literal("")),
  category: z.string().trim().min(1, "La catégorie est requise.").max(50),
  vintage: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) =>
        !value ||
        (/^\d{4}$/.test(value) &&
          Number(value) >= 1900 &&
          Number(value) <= new Date().getFullYear() + 1),
      {
        message: "Millésime invalide.",
      },
    ),
  region: z.string().trim().max(200).optional().or(z.literal("")),
  grapeVariety: z.string().trim().max(200).optional().or(z.literal("")),
  shortDescription: z.string().trim().max(280).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  tastingNotes: z.string().trim().max(2000).optional().or(z.literal("")),
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

export type ProductFormValues = z.infer<typeof productFormSchema>;
