import { check, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, timestampColumns } from "./columns.helpers";
import { orders } from "./orders";
import { paymentMethodEnum, paymentStatusEnum } from "./enums";

/**
 * One payment attempt or completed payment for an Order
 * (docs/04-DATA-MODEL.md §18/§19). An Order may have multiple Payment
 * rows (retries, refund history) — never a single mutable provider
 * transaction ID on Order itself (docs/08-PAYMENTS.md §9).
 *
 * `provider` is plain `text`, not an enum — docs/04-DATA-MODEL.md §18
 * lists an explicit `OTHER` catch-all value, signalling this is meant
 * to stay open rather than a hard closed set. Worldline is the selected
 * V1 direction (TBD-DATA-001, partially resolved); nothing here is
 * Worldline-specific.
 */
export const payments = pgTable(
  "payments",
  {
    id: idColumn(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    method: paymentMethodEnum("method").notNull(),
    provider: text("provider").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("CHF"),
    status: paymentStatusEnum("status").notNull().default("PENDING"),
    providerPaymentId: text("provider_payment_id"),
    providerSessionId: text("provider_session_id"),
    ...timestampColumns(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
  },
  (table) => [
    check("payments_amount_non_negative", sql`${table.amount} >= 0`),
    index("payments_order_id_idx").on(table.orderId),
  ],
);

/**
 * Provider webhook/callback event log (docs/08-PAYMENTS.md §26) —
 * infrastructure/data-model preparation only; no webhook handling is
 * implemented in Phase 2. The unique (provider, providerEventId) pair
 * is the actual database-level guarantee behind webhook idempotency
 * (BR-PAY-009, docs/08-PAYMENTS.md §56 invariant 4).
 */
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: idColumn(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processingResult: text("processing_result"),
  },
  (table) => [
    unique("payment_events_provider_event_unique").on(table.provider, table.providerEventId),
    index("payment_events_payment_id_idx").on(table.paymentId),
  ],
);
