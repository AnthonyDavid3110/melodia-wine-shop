import type { RateLimitPolicy } from "./rate-limit";

/**
 * Approved Phase 14 Gate 14B initial policies (Step 1 §2/§9, approved
 * as-is) — operational security parameters, not business rules.
 * Centralized here (rather than duplicated at each call site) because
 * `PAYMENT_INITIATION` is shared verbatim by two separate action files
 * (`src/app/commande/actions.ts` and `src/app/commande/retour/
 * actions.ts`) — both MUST reference the identical policy object so a
 * checkout-path Initialize and a retry-path Initialize consume the same
 * bucket, not two independent ones.
 *
 * Adjust these numbers here only — never duplicate a policy inline at a
 * call site.
 */

/** A real household/office sharing one NAT IP may legitimately place several separate orders in one sitting. */
export const ORDER_CREATION: RateLimitPolicy = {
  action: "order_creation",
  windowSeconds: 10 * 60,
  limit: 8,
};

/** A legitimate customer may retry a failed/cancelled online payment a few times. */
export const PAYMENT_INITIATION: RateLimitPolicy = {
  action: "payment_initiation",
  windowSeconds: 10 * 60,
  limit: 5,
};

/** The legitimate UI polls at most 10 times, 3s apart (~30s total) per page load — generous headroom for a refresh/second visit. */
export const STATUS_POLLING: RateLimitPolicy = {
  action: "status_polling",
  windowSeconds: 60,
  limit: 25,
};
