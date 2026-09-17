import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Closed, stable business state sets use native Postgres enums so the
 * database itself rejects invalid values (defence in depth, not just
 * TypeScript). Fields the specifications explicitly describe as
 * open-ended or provider-dependent (Product.category, OrderEvent.type,
 * Payment.provider) are deliberately plain `text` columns instead — see
 * the comments where they are declared.
 */

export const campaignStatusEnum = pgEnum("campaign_status", [
  "DRAFT",
  "ACTIVE",
  "CLOSED",
  "ARCHIVED",
]);

export const orderSourceEnum = pgEnum("order_source", ["ONLINE", "MANUAL"]);

export const orderStatusEnum = pgEnum("order_status", [
  "NEW",
  "CONFIRMED",
  "PREPARED",
  "HANDED_TO_SELLER",
  "DELIVERED",
  "CANCELLED",
]);

export const customerPaymentStatusEnum = pgEnum("customer_payment_status", [
  "PENDING",
  "PAID",
  "REFUNDED",
]);

/** Order-level settlement summary — distinct value set from settlementStatusEnum below. */
export const orderSellerSettlementStatusEnum = pgEnum("order_seller_settlement_status", [
  "NOT_APPLICABLE",
  "PENDING",
  "SETTLED",
]);

/** SellerSettlement record status — no NOT_APPLICABLE at this level. */
export const settlementStatusEnum = pgEnum("settlement_status", ["PENDING", "SETTLED"]);

export const orderItemTypeEnum = pgEnum("order_item_type", ["PRODUCT", "BUNDLE"]);

export const paymentMethodEnum = pgEnum("payment_method", ["TWINT", "CARD", "SELLER"]);

/**
 * PARTIALLY_REFUNDED is kept for provider/data fidelity (a PSP could in
 * principle report it) even though V1 only implements a full-refund
 * workflow — see docs/08-PAYMENTS.md §41 and TBD-DATA-002.
 */
export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);

export const actorTypeEnum = pgEnum("actor_type", ["SYSTEM", "ADMIN", "PAYMENT_PROVIDER"]);
