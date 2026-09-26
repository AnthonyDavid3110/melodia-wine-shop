# Melodia Wine Shop — Business Rules

> Version: 0.1
> Status: Draft
> Related document: 01-PRODUCT-SPEC.md

---

## 1. Purpose

This document defines the business rules governing Melodia Wine Shop.

Business rules must remain independent from implementation details where
possible.

If application behaviour conflicts with a rule defined in this document,
the business rule takes precedence unless explicitly changed.

---

# 2. Campaign rules

## BR-CAM-001 — Every order belongs to a campaign

An order cannot exist without an associated campaign.

## BR-CAM-002 — Only an ACTIVE campaign accepts public orders

`DRAFT`, `CLOSED` and `ARCHIVED` campaigns cannot accept new public
orders.

## BR-CAM-003 — Historical campaigns remain available

Closing or archiving a campaign must not delete:

- orders;
- customers;
- payment information;
- seller attribution;
- statistics;
- product snapshots.

## BR-CAM-004 — Campaign configuration must not be hardcoded

Campaign-specific values such as:

- dates;
- seller target;
- products;

must be configurable.

---

# 3. Product rules

## BR-PRO-001 — Products can be activated/deactivated

Inactive products cannot be added to new public orders.

Historical orders containing inactive products remain unchanged.

## BR-PRO-002 — Product information must survive later catalogue changes

An existing order must preserve the commercially relevant product
information applicable when the order was placed.

Changing a product price later must not alter historical order totals.

## BR-PRO-003 — Quantities are positive integers

Bottle quantities cannot be fractional or negative.

## BR-PRO-004 — No minimum quantity

Customers may order a single bottle.

## BR-PRO-005 — No multiple-of-six requirement

Order quantities are unrestricted by carton size.

Physical packaging constraints do not alter ordered quantities.

---

# 4. Bundle rules

## BR-BUN-001 — Bundles have predefined compositions

Customers cannot modify the composition of a predefined bundle.

## BR-BUN-002 — Bundles have independent prices

The selling price of a bundle does not need to equal the sum of its
component products.

## BR-BUN-003 — Bundle composition must be preserved

Historical orders must retain the bundle composition applicable when the
order was placed.

## BR-BUN-004 — Bundles count toward bottle requirements

All bundle components must be included when calculating quantities to
order from producers.

Example:

20 bundles containing 1 × Wine A contribute 20 bottles of Wine A.

---

# 5. Cart rules

## BR-CART-001 — Cart may contain products and bundles

Individual bottles and predefined bundles can coexist in one order.

## BR-CART-002 — Server determines authoritative pricing

Prices received from a browser must never be trusted as authoritative.

Final prices and totals must be recalculated from server-side data before
order creation/payment.

## BR-CART-003 — Zero quantities are removed

An item with quantity zero is not retained as an order item.

---

# 6. Customer rules

## BR-CUS-001 — No customer account required

Guest checkout is the standard V1 customer flow.

## BR-CUS-002 — Required customer information

An order requires:

- first name;
- last name;
- address;
- postal code;
- city;
- email;
- telephone.

## BR-CUS-003 — Delivery note is optional

Customers may provide a free-text delivery note.

## BR-CUS-004 — Marketing consent is not collected in V1

Order contact details must not automatically constitute marketing
consent.

---

# 7. Seller rules

## BR-SEL-001 — Seller selection is optional

A public order can be submitted without selecting a seller.

## BR-SEL-002 — Only active sellers can be selected publicly

Inactive sellers remain available in historical data but cannot receive
new public attribution.

## BR-SEL-003 — Seller is responsible for delivery

In V1:

`Seller = Delivery Person`

## BR-SEL-004 — Unassigned orders require administrative assignment

Orders without a seller must be visible as requiring assignment.

## BR-SEL-005 — Administrators may reassign orders

Seller attribution can be changed by an administrator.

Changes must not alter the order's monetary total.

**Phase 8 addition:** reassignment is blocked once
`sellerSettlementStatus = SETTLED` — a completed settlement is a
historical record of which seller remitted the money, and reassigning
the order afterward would make the order's live seller disagree with
that history. Reassignment remains freely allowed while payment is
`PENDING` or once it is `PAID` but not yet settled. Enforced
server-side (`SellerReassignmentBlockedError`), never merely by hiding
the control in the UI.

## BR-SEL-006 — Seller sales contribute toward campaign objective

The total value of eligible orders attributed to a seller contributes
toward their campaign sales total.

The exact definition of "eligible" in relation to cancelled/refunded
orders is defined below.

## BR-SEL-007 — Cancelled orders do not contribute

Cancelled orders must not count toward seller targets.

## BR-SEL-008 — Refunded amounts do not contribute

Refunded amounts must be removed from seller sales performance.

---

# 8. Order source rules

## BR-SRC-001 — Orders record their source

Initial sources:

- `ONLINE`
- `MANUAL`

## BR-SRC-002 — Manual orders participate normally

After creation, manual orders participate in:

- statistics;
- seller totals;
- preparation;
- bottle requirements;
- exports;

in the same way as online orders.

---

# 9. Order identification

## BR-ORD-001 — Every order has an internal immutable identifier

The database identifier must not depend on the public order number.

## BR-ORD-002 — Every order has a human-readable number

Expected representation:

`ECM-YYYY-NNNN`

Example:

`ECM-2026-0042`

## BR-ORD-003 — Public order numbers are unique

Two orders must never share the same public order number.

---

# 10. Order pricing

## BR-PRI-001 — Order total is calculated from order items

The application calculates:

`line total = unit price × quantity`

and:

`order total = sum(line totals)`

## BR-PRI-002 — Bundle prices are not recomputed from components

A bundle uses its configured selling price.

Its components are used for fulfilment calculations, not for recalculating
the customer's bundle price.

## BR-PRI-003 — Historical prices are immutable

Future catalogue price changes must not alter existing orders.

## BR-PRI-004 — Currency

V1 uses CHF exclusively.

---

# 11. Discounts

## BR-DIS-001 — No quantity discount in V1

There is no automatic threshold discount such as:

`5% above CHF 300`

in the initial version.

## BR-DIS-002 — Architecture may allow future discounts

Future discount functionality must not require redesigning the entire
order model.

This does not require implementing a discount engine in V1.

---

# 12. Payment methods

## BR-PAY-001 — Online payment

Online payment must support at least:

- TWINT;
- payment cards.

A single payment service provider should expose these methods to the
application.

## BR-PAY-002 — Seller payment

Customers may choose to pay directly to the seller responsible for
delivery.

## BR-PAY-003 — No customer surcharge

V1 does not add a fee based on the selected payment method.

## BR-PAY-004 — Payment provider fees are internal costs

Provider fees do not modify the customer's order total.

---

# 13. Payment status

## BR-PAY-005 — Payment state is independent from fulfilment state

An order may be:

`DELIVERED + PENDING PAYMENT`

or:

`CONFIRMED + PAID`

Payment status and order status must therefore be stored separately.

## BR-PAY-006 — Online payment is confirmed server-side

The application must not mark an online order as paid solely because the
customer reached a success page.

Payment confirmation must originate from a trusted server-to-server
payment provider mechanism.

## BR-PAY-007 — Offline payment is manually confirmed

Payment to a seller is marked as paid through an administrative action.

## BR-PAY-008 — Failed online payments are not paid orders

A failed, cancelled or abandoned online payment must never result in a
`PAID` state.

## BR-PAY-009 — Payment events must be idempotent

Receiving the same payment notification multiple times must not create
duplicate payments or duplicate orders.

---

# 14. Seller collection rules

## BR-COL-001 — Offline amounts are attributed to sellers

For an order using seller payment, the amount is associated with the
seller responsible for the order.

## BR-COL-002 — Administration shows amounts to collect

For each seller, the system must provide at least:

- total attributed sales;
- online-paid sales;
- seller-payment sales;
- seller-payment amounts still pending.

**RESOLVED (Phase 13 Gate 13C):** "online-paid sales" — deferred at
Phase 8 because online payments did not exist yet (`getSellerFinancialSummary()`'s
own comment recorded this explicitly) — is now delivered on
`/admin/statistiques`'s seller table via `listCampaignSellerSalesSummaries()`'s
new `onlinePaidSales` field: the commercial value of TWINT/CARD orders
attributed to the seller whose authoritative payment attempt
(`selectAuthoritativePaymentForExport()`) succeeded. Retries/failed
attempts are never counted; SELLER-payment orders never contribute to
it. The other three figures (total attributed sales, seller-payment
sales via `sales`, seller-payment amounts still pending via
`stillToCollect`) were already delivered in Phase 8/12A.

## BR-COL-003 — Treasurer settlement is operationally relevant

The application should make it possible to determine how much money each
seller is responsible for collecting/remitting.

**RESOLVED (Phase 8):** no separate `REMITTED_TO_TREASURER` order-level
state was needed. The implemented model is exactly the one
`TBD-BR-001` already recommended:

- `Order.customerPaymentStatus` (`PENDING`/`PAID`/`REFUNDED`) — customer
  → seller;
- `Order.sellerSettlementStatus` (`NOT_APPLICABLE`/`PENDING`/`SETTLED`)
  — operational summary of seller → ECM, derived from the record below;
- a `SellerSettlement` record (docs/04-DATA-MODEL.md §21/§22) — the
  actual seller → ECM remittance event, grouping the specific orders it
  covers, with its own amount/timestamp/recording administrator.

See docs/05-ARCHITECTURE.md §20/§21 and docs/08-PAYMENTS.md §34-§39 for
the full implemented mechanics.

---

# 15. Order status rules

Supported operational statuses:

- `NEW`
- `CONFIRMED`
- `PREPARED`
- `HANDED_TO_SELLER`
- `DELIVERED`
- `CANCELLED`

## BR-STA-001 — Payment status does not drive fulfilment automatically

Except where explicitly required during online checkout, fulfilment and
payment lifecycles remain independent.

## BR-STA-002 — Cancelled orders are excluded from fulfilment

Cancelled orders are excluded from:

- bottle requirements;
- preparation;
- seller performance;
- active sales totals.

## BR-STA-003 — Prepared

`PREPARED` means the physical customer order has been assembled.

## BR-STA-004 — Handed to seller

`HANDED_TO_SELLER` means the prepared order has been transferred to the
seller responsible for customer delivery.

## BR-STA-005 — Delivered

`DELIVERED` means the customer has received the order.

## BR-STA-006 — Fulfilment transitions are strictly sequential

**Phase 9 addition:** the only valid forward transitions are
`CONFIRMED -> PREPARED`, `PREPARED -> HANDED_TO_SELLER`, and
`HANDED_TO_SELLER -> DELIVERED`. Skipping a step (e.g.
`CONFIRMED -> HANDED_TO_SELLER` or `CONFIRMED -> DELIVERED`) is
rejected server-side. There is no reverse/undo transition in V1.
`NEW` is not treated as equivalent to `CONFIRMED` — it is reserved for
a future online-payment-awaiting state and cannot be prepared while in
that state. Enforced by `canPrepareOrder`/`canHandOrderToSeller`/
`canMarkOrderDelivered` (`src/domain/orders/order-guards.ts`), never
merely by hiding the control in the UI (BR-ADM-003).

## BR-STA-007 — Seller required for handoff, not for preparation

**Phase 9 addition:** an order without an assigned seller may still
transition `CONFIRMED -> PREPARED` — central preparation is independent
of delivery assignment (BR-PRE-003). It may NOT transition
`PREPARED -> HANDED_TO_SELLER` until a seller is assigned, since a
physical order cannot be handed to nobody. `DELIVERED` is consequently
unreachable while unassigned, by transitivity of BR-STA-006.

## BR-STA-008 — Fulfilment progress does not change the Phase 8 financial guards

**Phase 9 addition:** cancellation remains governed solely by
BR-CAN-004 (blocked once `customerPaymentStatus = PAID` or
`sellerSettlementStatus = SETTLED`) — an unpaid, unsettled order remains
cancellable regardless of how far its fulfilment has progressed, even
once `DELIVERED`. Seller reassignment remains governed solely by the
Phase 8 addition to BR-SEL-005 (blocked only once `SETTLED`) — an
order that is `HANDED_TO_SELLER` or `DELIVERED` but not yet settled may
still be reassigned; the admin UI shows a contextual warning in that
case, but does not block the action.

---

# 16. Online checkout rules

## BR-CHK-001 — Checkout validates current availability

Before finalizing an order, the server validates that ordered products
and bundles are still available for the active campaign.

## BR-CHK-002 — Checkout recalculates total

The authoritative order total is calculated server-side.

## BR-CHK-003 — Customer cannot choose inactive seller

Seller validity is verified server-side.

## BR-CHK-004 — Online payment and order creation must tolerate interruption

The system must safely handle cases where:

- the customer closes the browser;
- the payment provider redirects incorrectly;
- the webhook arrives late;
- the webhook arrives multiple times.

No duplicate order or inconsistent payment state should result.

---

# 17. Manual order rules

## BR-MAN-001 — Administrators create manual orders

Paper forms are entered through the administration interface.

## BR-MAN-002 — Manual orders use authoritative catalogue pricing by default

The admin interface should use configured prices rather than requiring
manual calculation.

## BR-MAN-003 — Manual order source is preserved

A manually entered order remains identifiable as `MANUAL`.

## BR-MAN-004 — Manual orders may use seller payment

This is expected to be the normal payment method for paper orders.

---

# 18. Editing rules

## BR-EDT-001 — Customers cannot edit orders themselves in V1

Changes require administrative intervention.

## BR-EDT-002 — Administrators may correct orders

Administrators may modify:

- customer information;
- items;
- quantities;
- seller;
- operational status;
- relevant offline payment information.

## BR-EDT-003 — Paid online order modifications require special handling

A modification that changes the monetary total of an already-paid online
order must not silently create a discrepancy between payment and order
total.

Exact refund/additional-payment behaviour is TBD.

Until implemented, the UI must prevent unsafe monetary modifications or
require an explicit controlled administrative workflow.

---

# 19. Cancellation rules

## BR-CAN-001 — Cancellation does not delete orders

Cancelled orders remain in the database.

## BR-CAN-002 — Cancelled orders are excluded from operational totals

They do not contribute to:

- wine requirements;
- preparation;
- active revenue;
- seller objective.

## BR-CAN-003 — Paid cancellation may require refund

Cancelling an online-paid order does not automatically imply that the
payment has already been refunded.

Cancellation state and refund/payment state remain distinguishable.

## BR-CAN-004 — Paid or settled orders cannot currently be cancelled

**Phase 8 addition:** cancellation is blocked entirely once
`customerPaymentStatus = PAID` or `sellerSettlementStatus = SETTLED` —
once money has moved, cancelling through the ordinary admin workflow
would leave stale financial state attached to a cancelled order rather
than reflect it accurately. No automatic refund, payment reversal, or
settlement reversal is performed or implied. A future reversal/refund
workflow is required to cancel such an order; it does not exist yet.
Enforced server-side (`OrderNotCancellableError`), never merely by
hiding the control in the UI. An ordinary `PENDING` payment order
remains freely cancellable, unchanged from Phase 7.

---

# 20. Wine requirement calculation

For every active, non-cancelled order:

1. count individual product quantities;
2. decompose bundles;
3. add bundle component quantities;
4. aggregate by wine.

Example:

Orders contain:

- 10 × Wine A individually;
- 20 × Discovery Box;
- each Discovery Box contains 1 × Wine A.

Required Wine A:

`10 + 20 = 30 bottles`

## BR-REQ-001 — No automatic rounding

The customer requirement remains the exact bottle quantity.

If 487 bottles are required, the system reports:

`487`

It may additionally display logistical information such as:

`81 full cartons + 1 bottle`

but must not silently change the required quantity to 492.

---

# 21. Preparation rules

## BR-PRE-001 — Cancelled orders are not prepared

Only active fulfilment orders appear in preparation workflows.

## BR-PRE-002 — Orders can be grouped by seller

Preparation documents and administrative views must support grouping by
seller.

## BR-PRE-003 — Unassigned orders remain visible

Unassigned orders must not disappear from preparation data.

They should be prominently identified for administrative action.

**Phase 9 addition:** unassigned orders may be marked `PREPARED` — see
BR-STA-007 for the full transition rule.

---

# 22. Documents

## BR-DOC-001 — Documents reflect order snapshots

Generated documents use the commercial information stored on the order,
not potentially modified current catalogue prices.

## BR-DOC-002 — Preparation sheets show payment status

Preparation staff must be able to identify whether payment is already
complete or expected through the seller.

## BR-DOC-003 — Order reference, not an invoice number — RESOLVED (Phase 12 Gate 12C)

ECM's V1 commercial documents (order confirmation, receipt) are not
traditional invoices — no bank-transfer payment workflow, no
accounting numbering scheme exists. The existing human order number is
displayed as `Référence de commande`, explicitly never labelled or
treated as a legally/accountingly authoritative invoice number. No
dedicated invoice-numbering counter or `Invoice` entity was
introduced.

---

# 23. Emails

## BR-EML-001 — Order confirmation

A confirmation email is sent following successful order creation under
the appropriate payment flow.

## BR-EML-002 — Email failure does not invalidate an order

If transactional email delivery fails, the valid order remains valid.

Email sending and order persistence must therefore not be one
all-or-nothing operation.

## BR-EML-003 — No seller notification required in V1

Sellers do not automatically receive an email for each attributed order.

---

# 24. Administration rules

## BR-ADM-001 — Administration requires authentication

Public visitors must never access administrative data or actions.

## BR-ADM-002 — V1 administrators have equivalent permissions

Advanced role-based access control is not required initially.

## BR-ADM-003 — Sensitive actions must be server-authorized

Hiding an admin button in the browser is not an authorization mechanism.

Administrative permissions must be enforced server-side.

---

# 25. Data integrity

## BR-DAT-001 — Orders are not physically deleted during normal operation

Cancellation/archival mechanisms are preferred to deletion.

## BR-DAT-002 — Monetary values must use precise representation

Floating-point arithmetic must not be used in a way that can introduce
currency rounding errors.

## BR-DAT-003 — Historical commercial data must remain reproducible

The application must retain enough order-time information to explain how
an historical order total was calculated.

---

# 26. Security-sensitive business rules

## BR-SEC-001 — Browser input is untrusted

All business-critical values must be validated server-side.

## BR-SEC-002 — Payment status cannot be customer-controlled

Customers cannot submit or modify authoritative payment status.

## BR-SEC-003 — Seller totals are calculated from orders

Seller performance must not be accepted as a manually supplied browser
total.

## BR-SEC-004 — Admin actions require authenticated authorization

Every administrative mutation requires server-side authorization.

---

# 27. Open business-rule decisions

## TBD-BR-001 — Seller → treasurer reconciliation — RESOLVED (Phase 8)

Question:

Do we need to distinguish:

1. customer has paid seller;
2. seller has remitted money to treasurer?

Recommended model:

`customerPaymentStatus`
+
`sellerSettlementStatus`

This would make reconciliation significantly safer.

**Resolution:** yes — implemented exactly as recommended, plus a
`SellerSettlement`/`SellerSettlementOrder` record pair (see BR-COL-003
above) as the actual remittance event, not just a status flag.

## TBD-BR-002 — Editing already-paid online orders

Define policy for:

- adding products;
- removing products;
- price changes;
- partial refunds.

## TBD-BR-003 — Invoice/accounting requirements — RESOLVED (Phase 12 Gate 12C)

Confirmed directly with ECM: not VAT-registered (no VAT field/
calculation anywhere), no bank-transfer/QR-bill payment workflow, no
dedicated invoice numbering — see BR-DOC-003 above and
`docs/05-ARCHITECTURE.md` §34.

## TBD-BR-004 — Delivery geographical limits

Define whether any Swiss address is accepted or whether delivery is
restricted geographically.

## TBD-BR-005 — Seller objective calculation

Confirm whether seller objective is based on:

- gross order value;
- paid orders only;
- delivered orders;
- another organizational rule.

Recommended V1 rule:

Non-cancelled attributed order value, minus refunded amounts.
