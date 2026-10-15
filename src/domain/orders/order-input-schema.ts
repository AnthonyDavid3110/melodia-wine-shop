import { z } from "zod";
import { WINE_LOT_SIZE } from "../cart/cart";

/**
 * Shared Zod validation for order creation (Phase 7) — the ONE schema
 * used by both `/commande` (ONLINE) and `/admin/commandes/nouvelle`
 * (MANUAL), per docs/10 §48's "SAME server-side pricing... SAME
 * authoritative order-creation core" requirement. Customer fields match
 * docs/01-PRODUCT-SPEC.md §9.1 / docs/02-BUSINESS-RULES.md BR-CUS-002
 * exactly — no extra fields invented. Deliberately no Swiss-only postal
 * code / phone format (docs/02 TBD-BR-004 — delivery geography remains
 * unresolved), just non-empty, reasonably bounded strings.
 */

/**
 * CORR-003 — wines (`PRODUCT`) are sold only in lots of `WINE_LOT_SIZE`
 * identical bottles; the Discovery Box (`BUNDLE`) is unaffected. The
 * `.refine()` runs after the base shape/positivity checks, so a
 * PRODUCT line that's merely a non-multiple of 3 still gets this
 * specific, actionable message rather than a generic one — reusing
 * `WINE_LOT_SIZE`/the same rule `cart.ts`'s `isLotCompatibleQuantity`
 * enforces client-side, never a second definition.
 */
export const orderLineItemSchema = z
  .object({
    type: z.enum(["PRODUCT", "BUNDLE"]),
    id: z.string().min(1).max(200),
    quantity: z.number().int().positive().max(999),
  })
  .refine((line) => line.type !== "PRODUCT" || line.quantity % WINE_LOT_SIZE === 0, {
    message: "Les vins se commandent uniquement par lots de 3 bouteilles.",
    path: ["quantity"],
  });

export const customerInfoSchema = z.object({
  customerFirstName: z.string().trim().min(1, "Le prénom est requis.").max(100),
  customerLastName: z.string().trim().min(1, "Le nom est requis.").max(100),
  customerAddress: z.string().trim().min(1, "L'adresse est requise.").max(200),
  customerPostalCode: z.string().trim().min(1, "Le NPA est requis.").max(10),
  customerCity: z.string().trim().min(1, "La localité est requise.").max(100),
  customerEmail: z
    .string()
    .trim()
    .min(1, "L'e-mail est requis.")
    .max(200)
    .email("Adresse e-mail invalide."),
  customerPhone: z.string().trim().min(1, "Le téléphone est requis.").max(30),
  deliveryNote: z.string().trim().max(500, "500 caractères maximum.").optional().or(z.literal("")),
});

export type CustomerInfoInput = z.infer<typeof customerInfoSchema>;

/**
 * The full payload the order-creation core accepts. `campaignId` is the
 * cart's own stored campaign id (Phase 6) — present for ONLINE so
 * staleness can be detected; MANUAL entry omits it (the admin form is
 * always built fresh against the live campaign, so there is no
 * analogous stale-snapshot risk to guard against).
 */
export const orderCreationInputSchema = customerInfoSchema.extend({
  items: z.array(orderLineItemSchema).min(1, "Le panier est vide."),
  campaignId: z.string().min(1).optional(),
  sellerId: z.string().min(1).nullable(),
  idempotencyKey: z.string().uuid("Jeton de soumission invalide."),
  /** Phase 10 Gate 10B. Defaults to SELLER — MANUAL entry never sends this field at all. */
  paymentMethod: z.enum(["SELLER", "TWINT", "CARD"]).default("SELLER"),
});

export type OrderCreationInput = z.infer<typeof orderCreationInputSchema>;

/**
 * CORR-004 — the public checkout specifically (never the admin manual
 * order form, which stays on `orderCreationInputSchema` unchanged) must
 * never accept an implicit "no seller" the same way an untouched,
 * never-interacted-with field would produce. `sellerDecision` is
 * **required** here — omitting it entirely (e.g. a direct call to
 * `submitCheckoutAction` bypassing the UI) fails validation, exactly
 * like any other missing required field. `KNOWN`/`NONE` must also agree
 * with `sellerId` (never trusted independently, so a crafted payload
 * can't claim `NONE` while still smuggling a `sellerId`, or vice
 * versa) — the actual order-creation core keeps reading `sellerId`
 * alone, `sellerDecision` exists only to prove a real choice was made.
 */
export const checkoutInputSchema = orderCreationInputSchema
  .extend({
    sellerDecision: z.enum(["KNOWN", "NONE"], {
      message: "Veuillez indiquer si vous connaissez un membre de Mélodia.",
    }),
  })
  .superRefine((data, ctx) => {
    if (data.sellerDecision === "KNOWN" && data.sellerId === null) {
      ctx.addIssue({
        code: "custom",
        message:
          "Veuillez choisir un membre dans la liste, ou indiquer que vous n'en connaissez pas.",
        path: ["sellerId"],
      });
    }
    if (data.sellerDecision === "NONE" && data.sellerId !== null) {
      ctx.addIssue({
        code: "custom",
        message: "Sélection du membre incohérente. Veuillez réessayer.",
        path: ["sellerId"],
      });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
