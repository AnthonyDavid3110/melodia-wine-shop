import type { SendEmailInput, SendEmailSuccess } from "./resend-provider";

/**
 * The smallest provider boundary Phase 11 needs (Gate 11A). Domain/
 * application code depends on this interface, never on the `resend`
 * package directly — mirrors `08-PAYMENTS.md`'s `PaymentProvider`
 * boundary/`saferpay-client.ts` pattern, scaled down to what
 * transactional order confirmation actually requires: one operation,
 * not a general campaign-email platform (docs/10-IMPLEMENTATION-PLAN.md
 * §5).
 *
 * Both `resend-provider.ts` and `fake-test-provider.ts` structurally
 * satisfy this shape (checked via `satisfies` at each module's export
 * site is unnecessary boilerplate here — `order-confirmation.ts`'s
 * `getProvider()` return type already enforces it at every call site).
 */
export interface EmailProvider {
  sendEmail(input: SendEmailInput): Promise<SendEmailSuccess>;
}

export type { SendEmailInput, SendEmailSuccess };
