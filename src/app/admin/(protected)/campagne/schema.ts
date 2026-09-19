import { z } from "zod";
import { parseDateInputFr } from "./date-input";

/**
 * Campaign basic-fields validation (Phase 5 Gate 2A/2C). Status is
 * deliberately absent — it is never edited through this form, only
 * through the explicit lifecycle actions (`transitionCampaignStatusAction`).
 * `slug` is absent too (Gate 2C §6) — it is generated automatically on
 * create and preserved unchanged on every edit; there is no admin-facing
 * slug field at all.
 */
const dateField = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((value) => !value || parseDateInputFr(value).ok, {
    message: "Date invalide — utilisez le format jj.mm.aaaa.",
  });

export const campaignFormSchema = z
  .object({
    name: z.string().trim().min(1, "Le nom est requis.").max(200),
    publicTitle: z.string().trim().max(200).optional().or(z.literal("")),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    openingDate: dateField,
    closingDate: dateField,
    defaultSellerTargetAmount: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine((value) => !value || /^-?\d+([.,]\d{1,2})?$/.test(value), {
        message: "Montant invalide — utilisez un nombre avec au plus 2 décimales.",
      })
      .refine((value) => !value || !value.trim().startsWith("-"), {
        message: "Le montant ne peut pas être négatif.",
      }),
  })
  .refine(
    (values) => {
      if (!values.openingDate || !values.closingDate) return true;
      const opening = parseDateInputFr(values.openingDate);
      const closing = parseDateInputFr(values.closingDate);
      if (!opening.ok || !closing.ok || !opening.value || !closing.value) return true;
      return opening.value <= closing.value;
    },
    {
      message: "La date d'ouverture doit précéder la date de clôture.",
      path: ["closingDate"],
    },
  );

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;
