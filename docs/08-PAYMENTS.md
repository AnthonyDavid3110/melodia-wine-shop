# Melodia Wine Shop — Payments

> Version: 0.1
> Status: Draft
> Related documents:
> - `01-PRODUCT-SPEC.md`
> - `02-BUSINESS-RULES.md`
> - `03-USER-FLOWS.md`
> - `04-DATA-MODEL.md`
> - `05-ARCHITECTURE.md`
> - `06-ADMIN-SPEC.md`

---

# 1. Purpose

This document defines the payment architecture and financial workflows of
Melodia Wine Shop.

Payment handling is considered a critical part of the application.

The implementation must prioritize:

- financial correctness;
- traceability;
- idempotency;
- reconciliation;
- security;
- recoverability.

A visually successful checkout is not sufficient if financial state can
become ambiguous.

---

# 2. Supported V1 payment methods

Customers may choose:

    TWINT
    Card
    Payment to ECM seller

Public French labels should be user-friendly.

Recommended:

    TWINT

    Carte bancaire

    Paiement auprès du membre
    lors de la livraison

Exact wording may be refined during UI implementation.

---

# 3. Pricing rule

The selling price of an order is independent from payment method.

Example:

    Order total
    CHF 120.–

    TWINT                CHF 120.–
    Card                 CHF 120.–
    Seller payment       CHF 120.–

No payment-method surcharge is added to the customer.

Payment-provider fees are considered an ECM campaign expense.

---

# 4. Online payment provider

V1 provider:

    Worldline

Product (RESOLVED, Phase 10 Gate 10B — see §70 for the full implemented
protocol):

    Worldline E-Payments, technical platform Saferpay,
    Saferpay JSON API, Payment Page (hosted redirect)

Final onboarding and production contract details (ECM merchant account,
production credentials, contractual pricing) must still be confirmed
before production integration — see TBD-PAY-001. Development and testing
use the official Saferpay TEST environment and a real Saferpay TEST
account.

The application must not assume that a payment method is available merely
because Worldline supports it generally.

Production availability depends on the actual ECM merchant contract and
activated payment methods.

---

# 5. Required online methods

Before production launch, the ECM merchant configuration must confirm
support for at least:

    TWINT
    Visa
    Mastercard

Additional methods may be enabled if useful.

Examples:

    Apple Pay
    PostFinance Pay

These are optional and must not delay V1 unless explicitly decided.

---

# 6. Currency

V1 currency:

    CHF

Orders must not mix currencies.

Payment requests must use the authoritative Order currency and amount.

---

# 7. Money representation

Money must use precise representation.

Recommended conceptual representation:

    CHF 18.00 = 1800

Do not use JavaScript floating-point values as the authoritative monetary
representation.

Example:

    18.00 * 3

must not be the foundation of financial correctness.

Use integer minor units or another precise monetary representation
supported by the final implementation.

---

# 8. Payment architecture

Domain code must not depend directly on Worldline throughout the
application.

Use an abstraction such as:

    PaymentProvider

with responsibilities conceptually equivalent to:

    createPayment()
    getPaymentStatus()
    handleWebhook()
    refundPayment()

Provider-specific implementation:

    WorldlinePaymentProvider

This keeps payment-provider concerns isolated.

---

# 9. Payment records

Each external or offline payment operation is represented by a Payment
record.

An Order may have multiple Payment records because:

- an online payment can fail;
- the customer may retry;
- a refund may occur;
- payment history must remain traceable.

Do not model an Order as having only one immutable provider transaction
identifier.

---

# 10. Order payment summary

Order exposes a simplified operational status:

    customerPaymentStatus

Allowed V1 values:

    PENDING
    PAID
    REFUNDED

This is intentionally simpler than provider-level payment states.

The detailed Payment entity contains technical payment lifecycle
information.

---

# 11. Payment entity states

Recommended conceptual states:

    PENDING
    PROCESSING
    SUCCEEDED
    FAILED
    CANCELLED
    REFUNDED
    PARTIALLY_REFUNDED

The exact mapping depends on Worldline API semantics.

Provider-specific states should be translated into application domain
states.

Do not expose raw provider state strings as core business logic.

---

# 12. Online payment flow

Conceptual flow:

    Customer validates checkout
              │
              ▼
    Server validates order data
              │
              ▼
    Order created
              │
              ▼
    Payment record created
              │
              ▼
    Worldline payment initiated
              │
              ▼
    Customer completes payment
              │
              ├───────────────┐
              │               │
              ▼               ▼
         Browser return     Provider callback
                              / webhook
              │               │
              │               ▼
              │        Verify authenticity
              │               │
              │               ▼
              │        Update Payment
              │               │
              │               ▼
              │        Update Order
              │
              ▼
        Confirmation page

The provider callback / authoritative server-side verification determines
payment state.

The browser return does not.

---

# 13. Order creation before payment

For online payments, the application should create an Order before
redirecting the customer to the payment provider.

Initial state may conceptually be:

    Order
    CONFIRMED or payment-awaiting equivalent

    customerPaymentStatus
    PENDING

    Payment
    PENDING

This gives the application an internal Order ID and public order number
that can be associated with the provider transaction.

The exact operational Order status used during payment will be finalized
during implementation.

---

# 14. Payment creation

When initiating online payment, the server must determine:

    order ID
    order number
    amount
    currency

from trusted server-side Order data.

The browser must not determine the payment amount.

---

# 15. Provider metadata

Where supported, payment-provider metadata may contain minimal
reconciliation identifiers such as:

    internal order ID
    ECM order number

Example:

    ECM-2026-0042

Do not send unnecessary customer personal data to provider metadata.

---

# 16. Successful payment

A successful online payment results in:

    Payment.status = SUCCEEDED

and:

    Order.customerPaymentStatus = PAID

Relevant timestamps are stored.

An audit event is created.

Example:

    PAYMENT_CONFIRMED_BY_PROVIDER

---

# 17. Browser success page

The payment provider may redirect the browser to a success URL.

**DECIDED (docs/03-USER-FLOWS.md §18, Phase 7):** that URL must NOT be
addressed by the bare public order number alone (`09-SECURITY.md`
§22/§23 — a public order number is not itself a secret, so a route
keyed only by it must not expose full customer information to anyone
who can guess or enumerate it). Since this page genuinely must be a
real, reloadable URL the PSP redirects a real browser to (unlike Phase
7's seller-payment confirmation, which never needs to survive a
redirect), it requires an opaque, unguessable access token in the URL
instead of — or in addition to — the order number; the exact token
mechanism belongs to the online-payment phase's own implementation
gate, not this document.

This page must not execute:

    markOrderAsPaid()

simply because it was opened.

Instead, it reads the current trusted server-side state.

Possible display:

    Paiement confirmé

or temporarily:

    Vérification du paiement en cours...

depending on provider callback timing.

---

# 18. Browser closed before return

Scenario:

1. Customer pays successfully.
2. Customer closes TWINT/browser.
3. Customer never visits the success page.

Expected result:

    Payment still becomes SUCCEEDED

because payment confirmation is handled server-to-server.

Customer navigation is not part of payment correctness.

---

# 19. Failed payment

Possible reasons:

    card declined
    TWINT cancelled
    provider rejection
    technical failure

Result:

    Payment = FAILED or CANCELLED

Order:

    customerPaymentStatus = PENDING

The order must not become paid.

---

# 20. Abandoned payment

A customer may:

1. create an order;
2. open payment;
3. leave without paying.

The system must tolerate this.

The order remains unpaid.

Administration should be able to identify such orders.

Future cleanup rules may archive or cancel abandoned unpaid orders after
an appropriate period.

Automatic cancellation is not required for initial V1.

---

# 21. Payment retry

A customer should be able to retry an unpaid online payment where
practical.

A retry creates a new Payment attempt associated with the same Order.

Example:

    Order ECM-2026-0042

    Payment A
    FAILED

    Payment B
    SUCCEEDED

Order summary:

    PAID

The retry must not create a second fulfilment Order.

---

# 22. Duplicate checkout protection

The application should reduce accidental duplicate orders caused by:

    double click
    network retry
    browser refresh

Appropriate idempotency or duplicate-submission protection should be used
during checkout.

The exact implementation is technical.

---

# 23. Webhook / callback authenticity

Provider callbacks must never be trusted without verification.

The Worldline integration must follow the authentication and validation
mechanism required by the official provider documentation.

Invalid callbacks must not modify financial state.

---

# 24. Webhook idempotency

The same provider event may be delivered more than once.

Processing must be safe.

Conceptually:

    receive provider event

    if event already processed:
        acknowledge
        perform no duplicate financial mutation

    otherwise:
        validate
        process
        record event identifier

The same successful payment must not be applied twice.

---

# 25. Out-of-order events

Payment events may not always arrive in the expected order.

The application must not blindly overwrite a stronger final state with an
older weaker state.

Example:

    SUCCEEDED

must not accidentally become:

    PENDING

because an older notification arrives later.

Provider integration must define allowed state transitions.

---

# 26. Payment event storage

Where useful, store enough provider-event information to:

- detect duplicates;
- troubleshoot failures;
- reconcile transactions.

Do not store unnecessary sensitive payloads indefinitely.

Recommended information may include:

    provider event ID
    payment ID
    event type
    receivedAt
    processedAt
    processing result

Exact schema may be introduced during implementation.

---

# 27. Payment reconciliation

The application must make reconciliation easy for the ECM treasurer.

Every successful online payment should be traceable through:

    ECM order number
        ↕
    internal Payment
        ↕
    Worldline transaction reference

Example:

    ECM-2026-0042
    CHF 196.–
    TWINT
    PAID
    Worldline reference: XXXXX

This relationship should be visible in administration.

---

# 28. Worldline back office

The treasurer may use Worldline's merchant/back-office tools to inspect
external transactions.

Melodia Wine Shop remains responsible for linking those transactions to
ECM Orders.

The order number should therefore be included in provider references or
metadata wherever supported.

---

# 29. Online payout vs customer payment

Do not confuse:

    customer paid Worldline

with:

    Worldline funds arrived in ECM bank account

V1 primarily tracks customer payment status.

Provider payout/bank reconciliation is not necessarily tracked as a
separate application entity in V1.

Worldline back-office/accounting information can be used for final bank
reconciliation.

A future version may model provider payouts if ECM operationally needs
this.

---

# 30. Seller payment

Offline payment flow:

    Customer
       │
       ▼
    ECM seller
       │
       ▼
    ECM / Treasurer

These are two distinct financial transitions.

They must not be represented by one boolean.

---

# 31. Seller-payment order creation

Initial state:

    Payment.method = SELLER
    Payment.provider = OFFLINE
    Payment.status = PENDING

Order:

    customerPaymentStatus = PENDING

Seller settlement:

    PENDING

when a seller is assigned.

---

# 32. Customer pays seller

When the customer gives the money to the seller:

    Customer → Seller
    COMPLETE

Administrator records:

    Payment.status = SUCCEEDED
    Payment.paidAt = timestamp

Order becomes:

    customerPaymentStatus = PAID

But:

    sellerSettlementStatus = PENDING

The money is not yet considered remitted to ECM.

---

# 33. Seller has not collected payment

Example:

    Order
    DELIVERED

    Customer payment
    PENDING

This is allowed but should appear as an administrative alert.

The application must not automatically assume that delivery means
payment.

---

# 34. Seller settlement

Seller may remit money from multiple orders at once.

Example:

    Anthony David

    ECM-2026-0042     CHF 120.–
    ECM-2026-0061     CHF 180.–
    ECM-2026-0097     CHF 100.–

    Total             CHF 400.–

One SellerSettlement groups these payments.

---

# 35. Settlement eligibility

An order may be included in a seller settlement only when:

    payment method = SELLER

and:

    customerPaymentStatus = PAID

and:

    seller assigned

and:

    relevant amount not already settled

Cancelled/refunded cases must be handled explicitly.

---

# 36. Settlement amount

Settlement total must be calculated by the application.

Conceptually:

    settlement amount =
        sum eligible selected seller-payment amounts

Admin must not independently type:

    CHF 390.–

when selected orders total:

    CHF 400.–

This prevents reconciliation errors.

---

# 37. Settlement completion

When ECM confirms receipt:

    SellerSettlement.status = SETTLED
    settledAt = timestamp
    recordedByAdminUserId = current admin

Associated eligible orders become operationally:

    sellerSettlementStatus = SETTLED

An audit event is recorded.

---

# 38. Partial seller remittance

Because settlements associate individual orders, a seller may remit only
part of their outstanding collected orders.

Example:

Outstanding:

    Order A       CHF 100.–
    Order B       CHF 150.–
    Order C       CHF 200.–

Seller remits:

    Order A
    Order B

Settlement:

    CHF 250.–

Remaining outstanding:

    CHF 200.–

This is supported.

---

# 39. Partial payment of one order

V1 does not intentionally support a customer paying one order in several
offline instalments.

Expected:

    one order
    one full customer payment

If a real operational requirement appears, partial customer payments can
be introduced later.

Do not implement them pre-emptively.

---

# 40. Refunds

Refund behaviour must distinguish:

    online payment refund

from:

    offline seller-payment correction

Online refunds should use the payment provider where supported.

Application state must only reflect a refund after authoritative
confirmation.

---

# 41. V1 refund recommendation

Recommended V1 scope:

    full online refunds supported administratively
    partial refunds not required

This keeps cancellation and correction manageable.

If the provider integration makes partial refunds trivial, the domain
model may remain compatible with them without exposing the feature in V1.

---

# 42. Paid order cancellation

Cancelling a paid order must not silently refund it.

Example:

    Order status
    CANCELLED

    Payment status
    PAID

is temporarily possible and indicates:

    refund action still required

Admin UI must make this visible.

---

# 43. Refund completion

After confirmed full refund:

    Payment.status = REFUNDED

Order:

    customerPaymentStatus = REFUNDED

Audit event:

    PAYMENT_REFUNDED

The original Payment record remains preserved.

---

# 44. Offline refund

If a seller-payment order was already paid and must be refunded, V1 may
require a manual operational refund.

The administrator records the resulting financial state only after the
refund has actually occurred.

The application must not pretend to transfer cash.

---

# 45. Chargebacks

Card chargebacks are exceptional but possible.

Worldline/provider information remains authoritative for the external
financial event.

V1 does not require a complete chargeback-management module.

However, the data model and audit trail should allow administrators to
record or investigate exceptional payment states.

---

# 46. Payment status transitions

Conceptually valid transitions include:

    PENDING
       │
       ├──> PROCESSING
       │       │
       │       ├──> SUCCEEDED
       │       └──> FAILED
       │
       ├──> SUCCEEDED
       ├──> FAILED
       └──> CANCELLED

    SUCCEEDED
       │
       └──> REFUNDED

Provider-specific transitions may differ.

Invalid regressions should be prevented.

---

# 47. Order payment summary transitions

Typical:

    PENDING
       │
       ▼
    PAID
       │
       ▼
    REFUNDED

Administrative corrections may exist but must be audited.

---

# 48. Payment confirmation email

For successful online payment, confirmation email should communicate:

    order number
    total
    payment method
    payment confirmed
    delivery information

Example conceptually:

    Commande ECM-2026-0042

    Total
    CHF 196.–

    Paiement
    TWINT — payé

The email must not include sensitive provider data.

---

# 49. Offline confirmation email

For seller payment:

    Paiement
    Auprès du membre lors de la livraison

The customer should understand that no online payment has been taken.

---

# 50. Payment UI

Payment methods should be presented clearly and neutrally.

Example:

    ○ TWINT
      Paiement sécurisé en ligne

    ○ Carte bancaire
      Visa / Mastercard

    ○ Paiement auprès du membre
      Réglez votre commande lors de la livraison

No method should be artificially penalized through a customer surcharge.

---

# 51. Payment security

Melodia Wine Shop must never store:

    card number
    card CVV/CVC
    full card authentication credentials
    TWINT customer credentials

Sensitive payment entry is handled by the payment provider.

---

# 52. PCI scope

The implementation should prefer provider-hosted or provider-secured
payment components that minimize ECM's direct handling of card data.

Do not build custom card-input processing.

Provider integration must follow the provider's PCI guidance.

---

# 53. Secrets

Payment credentials are stored only as protected environment variables.

Examples conceptually:

    WORLDLINE_CUSTOMER_ID
    WORLDLINE_TERMINAL_ID
    WORLDLINE_API_USERNAME
    WORLDLINE_API_PASSWORD

Actual variable names depend on the final API.

Never commit real credentials.

Never expose server payment credentials to browser JavaScript.

---

# 54. Development environment

Production payment credentials must not be used for ordinary local
development.

Use Worldline test/sandbox facilities where available.

Test and production configuration must be clearly separated.

---

# 55. Test scenarios

Payment implementation must test at minimum:

    successful TWINT payment
    successful card payment
    declined card
    cancelled payment
    abandoned payment
    retry after failure
    browser closed after payment
    duplicate provider callback
    invalid provider callback
    provider callback before browser return
    browser return before callback
    full refund
    offline seller payment
    seller settlement
    partial settlement across seller orders

---

# 56. Financial invariants

The application must enforce:

1. Browser cannot choose authoritative order total.
2. Browser cannot mark an order paid.
3. Payment provider callback cannot be processed without validation.
4. Same provider event cannot create duplicate payment effects.
5. Online payment must reference an existing Order.
6. Successful payment amount must correspond to expected Order amount.
7. Currency must correspond to Order currency.
8. Seller settlement cannot include unpaid customer orders.
9. Same seller-payment amount cannot be settled twice.
10. Settlement total is calculated from included records.

---

# 57. Amount mismatch

If provider reports a successful payment whose amount or currency does
not match the expected Order:

    DO NOT silently mark order PAID

The situation must be treated as a financial anomaly.

It should be logged and surfaced for administrative review.

---

# 58. Unknown payment callback

If a valid provider callback cannot be associated with an Order:

    do not invent an Order

Record enough diagnostic information to investigate safely.

---

# 59. Provider outage

If Worldline is temporarily unavailable:

- do not mark orders paid;
- do not fabricate payment success;
- show a controlled customer message;
- preserve valid existing order data where appropriate;
- allow retry when service is restored.

Offline seller payment may remain available if operationally desired.

---

# 60. Database outage during callback

If provider confirmation arrives while application persistence fails:

- callback handling must fail safely;
- provider retry behaviour should be leveraged where available;
- reconciliation must allow recovery.

Never acknowledge successful processing if the application has not
safely persisted required financial state, unless provider protocol
requires a different safe recovery mechanism.

---

# 61. Reconciliation screen

Admin payment view should make discrepancies visible.

Examples:

    ONLINE PAID
    142 orders
    CHF 18'420.–

    OFFLINE COLLECTED
    53 orders
    CHF 6'840.–

    OFFLINE TO COLLECT
    11 orders
    CHF 1'320.–

    SELLER MONEY TO REMIT
    CHF 2'480.–

These values are derived from authoritative records.

---

# 62. Treasurer workflow

The treasurer should be able to answer:

    How much was sold?

    How much was paid online?

    How much is still due from customers?

    How much have sellers collected?

    How much do sellers still owe ECM?

    Which Worldline transaction belongs to which order?

without maintaining a separate operational spreadsheet.

---

# 63. Payment exports

CSV exports should contain useful reconciliation fields.

Example:

    orderNumber
    customerName
    seller
    paymentMethod
    paymentStatus
    orderAmount
    provider
    providerReference
    paidAt
    settlementStatus

Sensitive credentials or card information must never be exported.

---

# 64. Accounting boundary

Melodia Wine Shop is an operational sales and payment reconciliation
system.

It is not intended to replace full accounting software.

V1 does not implement:

    general ledger
    VAT accounting engine
    bank statement import
    automated bookkeeping
    full payout reconciliation

Accounting exports/integration may be considered later if needed.

---

# 65. Worldline implementation gate

Before implementing production Worldline integration, confirm:

    [ ] ECM merchant account approved                — pending
    [x] E-Payments/Saferpay product selected          — Saferpay JSON API, Payment Page (Phase 10 Gate 10B)
    [x] TWINT activated                               — confirmed on TEST terminal
    [x] Visa activated                                — confirmed on TEST terminal
    [x] Mastercard activated                          — confirmed on TEST terminal
    [x] test environment available                    — real Saferpay TEST account in use
    [x] API credentials available                     — TEST JSON API Basic Authentication
    [ ] production credentials available               — pending
    [x] callback/notification mechanism confirmed      — Assert-driven, no signed webhook (§70.1)
    [ ] refund mechanism confirmed                      — out of scope for Gate 10B
    [ ] merchant back-office access confirmed           — pending
    [ ] contractual transaction pricing confirmed       — pending

TWINT/Visa/Mastercard activation above is confirmed on the Saferpay TEST
eCommerce terminal only — production activation on the real merchant
terminal remains pending (TBD-PAY-001).

Do not guess provider configuration.

---

# 66. Provider fallback

If Worldline onboarding or technical integration becomes unsuitable,
another PSP may replace it.

Because the application uses:

    PaymentProvider

the business domain should remain largely unchanged.

A provider migration must not require redesigning:

    Orders
    Sellers
    Offline payments
    Settlements
    Fulfilment

---

# 67. V1 exclusions

Do not implement unless scope changes:

    customer wallet
    stored cards
    subscriptions
    recurring payments
    instalment payments
    crypto payments
    multi-currency checkout
    automatic seller payouts
    split payments
    marketplace payments
    customer credit
    gift cards
    payment-method surcharges

---

# 68. Decisions

- DECIDED: V1 supports TWINT.
- DECIDED: V1 supports card payment.
- DECIDED: V1 supports payment to seller.
- DECIDED: Customer price does not change by payment method.
- DECIDED: CHF is the V1 currency.
- DECIDED: Worldline is the preferred online PSP.
- DECIDED: Provider-specific code is isolated behind a payment abstraction.
- DECIDED: Order is created before online payment completion.
- DECIDED: Browser return is not authoritative payment confirmation.
- DECIDED: Server-side provider confirmation is required.
- DECIDED: Payment processing is idempotent.
- DECIDED: Multiple payment attempts per Order are supported.
- DECIDED: Payment retries must not create duplicate fulfilment Orders.
- DECIDED: Customer payment and seller settlement remain separate.
- DECIDED: Sellers may remit multiple collected orders in one settlement.
- DECIDED: Partial settlement across multiple whole orders is supported.
- DECIDED: Partial customer payment of one order is not a V1 feature.
- DECIDED: Full refund workflow is preferred for V1.
- DECIDED: Card data is never stored by Melodia Wine Shop.
- DECIDED: Payment credentials are server-side secrets.
- DECIDED: Financial anomalies are surfaced rather than silently corrected.

---

# 69. Remaining payment decisions

## TBD-PAY-001 — Worldline contract

Still open. ECM merchant account, contract and contractual pricing are
not yet finalized — a deployment/onboarding dependency, not an
architecture TBD. Nothing in the Gate 10B implementation depends on it;
a real Saferpay TEST account (customer/terminal numbers, JSON API Basic
Authentication) is used for development and is sufficient to build and
test the full integration.

## TBD-PAY-002 — Worldline product/API — RESOLVED (Phase 10 Gate 10B)

**Resolution:** Saferpay, the technical payment platform behind
Worldline's Swiss e-commerce offer ("Worldline E-Payments"). Integration
uses the **Saferpay JSON API** (Spec-Version 1.54,
https://saferpay.github.io/jsonapi/), specifically the **Payment Page**
interface: `PaymentPage/Initialize` and `PaymentPage/Assert`. See §70
below for the full implemented protocol.

## TBD-PAY-003 — Enabled methods — RESOLVED for TEST (Phase 10 Gate 10B)

Confirmed available on the Saferpay TEST eCommerce terminal:

    TWINT Simulator — CHF
    Mastercard Saferpay Test — CHF, 3-D Secure
    Visa Saferpay Test — CHF, 3-D Secure

Apple Pay, PostFinance Pay, and every other method the TEST account may
list are deliberately **not** enabled — the application restricts
`PaymentMethods` on every `Initialize` call to exactly `["TWINT"]` or
`["VISA", "MASTERCARD"]` (never a broader or unrestricted list).
Production activation of TWINT/Visa/Mastercard on the real merchant
terminal remains a deployment dependency (TBD-PAY-001).

## TBD-PAY-004 — Payment page UX — RESOLVED (Phase 10 Gate 10B)

**Resolution:** hosted **Payment Page** (redirect model) — the customer
is redirected to Saferpay's own hosted form; Melodia never receives or
transmits raw card data (minimizes PCI scope, per this TBD's own stated
preference).

Melodia's own checkout presents **three separate customer-facing
choices** — TWINT, Carte bancaire, Paiement au membre — matching the
labels already recommended in §2 above, rather than one generic
"Paiement en ligne" option deferring method selection to Saferpay's
hosted page. Reasoning: `Payment.method` (TWINT/CARD) must be known at
the moment the local Payment attempt is created, before the customer
ever reaches Saferpay's page, and Saferpay's `PaymentMethods` restriction
parameter (`["TWINT"]` vs `["VISA", "MASTERCARD"]`) lets each Melodia
choice cleanly initialize a session scoped to exactly that method — no
provider-owned method-selection UI is duplicated by this, since the
actual card entry form (and 3-D Secure) still happens entirely on
Saferpay's own page for the "Carte bancaire" choice.

## TBD-PAY-005 — Refund UI

Still open — explicitly out of scope for Gate 10B (§21 of the gate
brief). No refund API, button, or partial-refund workflow was
implemented; `Payment.status` values `REFUNDED`/`PARTIALLY_REFUNDED`
remain unused.

## TBD-PAY-006 — Abandoned order policy

Still open, unchanged — not required for initial launch. A `NEW`,
never-confirmed online order remains in the database indefinitely under
Gate 10B; automatic cleanup was explicitly out of scope (§17 of the gate
brief).

---

# 70. Saferpay Payment Page — implemented protocol (Phase 10 Gate 10B)

This section documents the mechanics actually implemented, confirmed
against the official documentation at https://saferpay.github.io/jsonapi/
(Spec-Version 1.54) rather than assumed from a generic webhook model.

## 70.1 No signed webhook

Saferpay's Payment Page protocol does **not** work like a conventional
signed-event webhook. There is:

- **one** `ReturnUrl` for every outcome (success, failure, cancellation
  all redirect the browser to the same URL) — not separate success/fail
  URLs;
- optional, **unsigned** `SuccessNotifyUrl`/`FailNotifyUrl` server-to-
  server pings, which carry no authoritative payload — they are only a
  hint to call `PaymentPage/Assert`;
- **`PaymentPage/Assert`** (queried with the session `Token` returned by
  `Initialize`) as the **sole authoritative result lookup**. A
  successful call (HTTP 200) returns `Transaction.Status`
  (`AUTHORIZED`/`CAPTURED`, or `PENDING` for Account-to-Account methods
  this project doesn't use); a failed, declined, or payer-aborted
  transaction is instead an HTTP 400+ error response carrying an
  `ErrorName` (`TRANSACTION_ABORTED` for a payer cancellation,
  `TRANSACTION_DECLINED` for a processor decline, etc.).

Gate 10B's implementation therefore calls `Assert` directly from the
public return route when the browser lands on it (`/commande/retour`),
rather than relying on `NotifyUrl`. `NotifyUrl` was not registered on
`Initialize` for this gate — it requires a publicly reachable HTTPS
callback endpoint, which a local development server cannot provide (see
the Gate 10B final report for the full explanation); this is a known,
reported gap for a future gate once a publicly reachable deployment
exists, not a silently accepted risk.

## 70.2 Opaque return-correlation token

The public `ReturnUrl` (`https://.../commande/retour?rt=<token>`) never
carries the Saferpay `Token` itself, the human order number, or the
database order id. It carries a dedicated, server-generated, 256-bit
opaque token stored on the `payments` table (`return_token`, unique,
nullable) — Payment-level, not Order-level, because each online payment
attempt gets its own Saferpay session and therefore its own return
correlation.

## 70.3 Order/Payment lifecycle

    Order created (online)
        status = NEW
        customerPaymentStatus = PENDING
        sellerSettlementStatus = NOT_APPLICABLE
        no Payment row yet
            ↓
    initiateOnlinePayment()
        Payment created: PENDING, provider SAFERPAY
        PaymentPage/Initialize called (outside any DB transaction)
        Payment.providerSessionId = Saferpay Token
            ↓
    customer redirected to Saferpay's hosted Payment Page
            ↓
    browser returns to /commande/retour?rt=<token>
        (informational only — never marks anything paid by itself)
            ↓
    confirmOnlinePayment() calls PaymentPage/Assert
            ↓
    trusted success:                  trusted failure/cancellation:
        Payment -> SUCCEEDED              Payment -> FAILED/CANCELLED
        Order.customerPaymentStatus       Order remains NEW/PENDING
            -> PAID                       retry creates a NEW Payment
        Order.status NEW -> CONFIRMED     row on the SAME Order — never
        Order.confirmedAt set             a second Order
        sellerSettlementStatus stays
            NOT_APPLICABLE
        OrderEvent PAYMENT_CONFIRMED_BY_PROVIDER (actor PAYMENT_PROVIDER)

Multiple Payment attempts per Order are fully supported (no uniqueness
constraint on `payments.orderId`) — e.g. a declined card attempt
followed by a successful TWINT retry produces two rows: `FAILED` then
`SUCCEEDED`. A terminal `FAILED`/`CANCELLED` row is never mutated back
into an active state.

## 70.4 PaymentEvent usage

`payment_events`' pre-existing `unique(provider, providerEventId)`
constraint (built in Phase 2, unused until now) is used with Saferpay's
own `Transaction.Id` as `providerEventId` — a genuinely provider-issued,
stable identifier for a specific completed transaction, recorded once
per successful `Assert` result. A minimal, honest adaptation rather than
a literal webhook-event log: Saferpay's protocol here is a query/result
lookup, not a pushed event stream, so there is no separate "duplicate
webhook delivery" to deduplicate — the constraint instead guarantees
that repeated `Assert` calls returning the same transaction never write
duplicate audit rows or duplicate `OrderEvent`s (the real idempotency
boundary is the trusted-success transaction itself, guarded by
`SELECT ... FOR UPDATE` on the Payment row).

## 70.5 Authentication

JSON API Basic Authentication, credentials created in the Saferpay
Backoffice (Settings > JSON API basic authentication). Stored as two
separate raw components (`SAFERPAY_API_USERNAME` /
`SAFERPAY_API_PASSWORD`), never a precomputed `Authorization: Basic ...`
header — the application constructs the header server-side.
