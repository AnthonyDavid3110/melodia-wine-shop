# Melodia Wine Shop — Data Model

> Version: 0.1
> Status: Draft
> Related documents:
> - `01-PRODUCT-SPEC.md`
> - `02-BUSINESS-RULES.md`
> - `03-USER-FLOWS.md`

---

# 1. Purpose

This document defines the conceptual data model for Melodia Wine Shop.

It describes:

- entities;
- relationships;
- important fields;
- immutable historical data;
- financial state;
- fulfilment state;
- audit requirements.

This is a conceptual model.

Database-specific implementation details such as ORM syntax, PostgreSQL
types, indexes and migrations will be defined in `05-ARCHITECTURE.md`
and during implementation.

---

# 2. Core principles

## 2.1 Historical orders must remain reproducible

An historical order must never change because:

- a product is renamed;
- a wine price changes;
- a bundle composition changes;
- a seller is deactivated;
- a campaign is archived.

Commercial information relevant at order time must therefore be
snapshotted where appropriate.

## 2.2 Money must use precise representation

Monetary values must never rely on imprecise floating-point arithmetic.

Recommended representation:

    CHF 18.00 → 1800 minor units

Example conceptual field:

    unitPriceAmount = 1800

Currency:

    CHF

The final technical representation will be decided in the architecture.

## 2.3 Business states are explicit

The system must not infer important financial or operational states when
they can be represented explicitly.

Examples:

    orderStatus
    customerPaymentStatus
    sellerSettlementStatus

These represent different concepts.

## 2.4 Deletion is exceptional

Historical commercial records should normally be:

- cancelled;
- deactivated;
- archived;

rather than physically deleted.

---

# 3. Entity overview

Main V1 entities:

    Campaign
        │
        ├── CampaignProduct
        │       └── Product
        │
        ├── Bundle
        │       └── BundleItem
        │               └── Product
        │
        ├── CampaignSeller
        │       └── Seller
        │
        └── Order
                │
                ├── OrderItem
                ├── Payment
                ├── SellerSettlement
                └── OrderEvent

Additional entity:

    AdminUser

---

# 4. High-level relationships

Conceptually:

    Campaign
       │
       ├── has many CampaignProducts
       │
       ├── has many Bundles
       │
       ├── has many CampaignSellers
       │
       └── has many Orders

    Product
       │
       ├── belongs to many campaigns
       └── may belong to many BundleItems

    Bundle
       │
       └── has many BundleItems

    Seller
       │
       ├── belongs to many campaigns
       └── may be assigned to many Orders

    Order
       │
       ├── has many OrderItems
       ├── has payment information
       ├── may have seller settlement information
       └── has many OrderEvents

---

# 5. Campaign

Represents one fundraising wine sale.

Examples:

    Wine Sale 2026
    Wine Sale 2027

## Fields

### Identity

    id
    name
    slug

### Public content

    publicTitle
    description

### Lifecycle

    status
    openingDate
    closingDate

### Seller configuration

    defaultSellerTargetAmount

### Metadata

    createdAt
    updatedAt

## Status

Allowed conceptual values:

    DRAFT
    ACTIVE
    CLOSED
    ARCHIVED

## Rules

- Every order belongs to exactly one campaign.
- Campaign-specific values must not be hardcoded.
- Historical campaigns remain available.
- Closing a campaign does not prevent fulfilment work.
- At most one campaign may have `status = ACTIVE` at a time — enforced
  at the database level by a partial unique index
  (`campaigns_one_active_idx` on `status` where `status = 'ACTIVE'`,
  drizzle/0002, Phase 4 Gate 2). Zero ACTIVE campaigns is valid (no
  active sale). The application never silently resolves a
  multiple-ACTIVE result if this invariant is ever violated — that is
  a technical error, not a business state.
- `status` alone determines public visibility. `openingDate`/
  `closingDate` are informational only and never automatically gate
  the public catalogue (Phase 4 Gate 1 decision).
- Public visibility by status: `ACTIVE` → publicly browsable; `DRAFT`,
  `CLOSED`, `ARCHIVED` → not publicly browsable. `CLOSED` remains
  available administratively for reporting/history, matching
  `01-PRODUCT-SPEC.md` §4.3 (resolves a prior conflict with
  `10-IMPLEMENTATION-PLAN.md`, now corrected there too).
- The public site (`/`) always represents the single ACTIVE campaign
  directly — there is no public campaign slug/ID route in V1
  (docs/05-ARCHITECTURE.md §8).

---

# 6. Product

Represents a wine independently of a specific customer order.

Example:

    Chasselas — Domaine Example

## Fields

### Identity

    id
    slug

### Product information

    name
    producer
    category
    vintage
    region
    grapeVariety
    shortDescription
    description
    tastingNotes
    imageUrl

### General state

    active

### Metadata

    createdAt
    updatedAt

## Product category

Expected initial values:

    WHITE
    RED
    ROSE

The implementation should not unnecessarily prevent additional
categories later.

## Important rule

Product data is catalogue data.

Historical order items must not depend on current Product values for
commercially relevant information.

---

# 7. CampaignProduct

Associates a Product with a Campaign.

This entity exists because the same wine may potentially:

- appear in multiple annual campaigns;
- have different prices in different campaigns;
- have different display order;
- be unavailable in one campaign and available in another.

## Fields

    id
    campaignId
    productId

    unitPriceAmount
    active
    displayOrder

    createdAt
    updatedAt

## Example

Product:

    Chasselas — Domaine Example

2026:

    CHF 18.–

2027:

    CHF 19.–

The Product can remain the same while CampaignProduct stores the
campaign-specific commercial configuration.

## Public visibility (Phase 4 Gate 1/2)

A product is publicly visible in the active campaign's catalogue only
when both `Product.active = true` and this row's `active = true`.
Display order is `displayOrder ASC`, with a deterministic secondary
ordering (product name) when values tie. The public catalogue renders
correctly for any number of visible products — it must never assume a
fixed count.

---

# 8. Bundle

Represents a predefined set of wines sold at a fixed price.

Example:

    Carton découverte 2026

## Fields

    id
    campaignId

    name
    slug
    shortDescription
    description
    imageUrl

    priceAmount
    active
    displayOrder

    createdAt
    updatedAt

## Rules

- Bundle belongs to exactly one campaign in V1.
- Bundle has its own fixed selling price.
- Bundle price is not calculated dynamically from its components.
- Customer cannot modify bundle composition.

---

# 9. BundleItem

Represents one product contained inside a bundle.

## Fields

    id
    bundleId
    productId
    quantity

## Example

Discovery Box:

    BundleItem
    Product = Chasselas
    Quantity = 1

    BundleItem
    Product = Pinot Noir
    Quantity = 1

    BundleItem
    Product = Rosé
    Quantity = 1

## Rules

Quantity must be a positive integer.

BundleItems are used for:

- displaying bundle composition;
- calculating bottle requirements.

## Bundle integrity (Phase 4 Gate 1/2)

`BundleItem.productId` references `Product`, not `CampaignProduct` —
nothing at the schema level guarantees a bundle's components are
actually offered in that bundle's own campaign. The public catalogue
query enforces this at the application level instead: every
BundleItem's product must resolve to an active, visible
CampaignProduct of the bundle's own campaign (or a Bundle with no items
at all). If any component fails, the **entire bundle** is excluded
from the public catalogue — never displayed with a partial or broken
composition. Displayed composition order follows each component's own
`CampaignProduct.displayOrder`, not insertion order or a separate
field on BundleItem.

---

# 10. Seller

Represents an ECM member who can receive sales attribution and deliver
orders.

## Fields

    id

    firstName
    lastName

    active

    createdAt
    updatedAt

## Notes

Seller is intentionally separate from AdminUser.

A seller does not require application credentials in V1.

---

# 11. CampaignSeller

Associates a Seller with a Campaign.

This allows:

- different active sellers each year;
- campaign-specific objectives;
- historical seller participation.

## Fields

    id
    campaignId
    sellerId

    active
    targetAmount

    createdAt
    updatedAt

## Target

If `targetAmount` is null, the campaign default may be used.

Example:

    Campaign default = CHF 1'000.–

Seller-specific override:

    CHF 1'200.–

The exact implementation of default resolution is technical and will be
defined later.

---

# 12. Customer modelling

V1 does not require persistent customer accounts.

Customer information is primarily stored as an immutable order-time
snapshot directly on the Order.

Therefore, a dedicated Customer entity is not required for V1.

This intentionally avoids:

- customer account complexity;
- accidental coupling between historical orders;
- modifying historical addresses when a customer changes address.

A future V2 may introduce a Customer entity if a legitimate use case
appears.

---

# 13. Order

Order is the central business entity.

## Identity

    id
    orderNumber
    campaignId

## Source

    source

Values:

    ONLINE
    MANUAL

## Customer snapshot

    customerFirstName
    customerLastName
    customerAddress
    customerPostalCode
    customerCity
    customerEmail
    customerPhone

## Delivery

    deliveryNote

## Seller

    sellerId

Seller may initially be null.

## Financial summary

    currency
    subtotalAmount
    totalAmount

For V1:

    currency = CHF

No separate payment-method surcharge is included.

## Operational status

    status

Values:

    NEW
    CONFIRMED
    PREPARED
    HANDED_TO_SELLER
    DELIVERED
    CANCELLED

## Payment summary

    customerPaymentStatus

Values:

    PENDING
    PAID
    REFUNDED

## Seller settlement summary

    sellerSettlementStatus

Values:

    NOT_APPLICABLE
    PENDING
    SETTLED

## Metadata

    createdAt
    updatedAt
    confirmedAt
    preparedAt
    handedToSellerAt
    deliveredAt
    cancelledAt

## Rules

- Every order belongs to one campaign.
- Order number is unique.
- Customer snapshot is preserved.
- Seller may be assigned later.
- Order state is independent from payment state.
- Payment state is independent from seller settlement state.

---

# 14. Order number

Human-readable format:

    ECM-YYYY-NNNN

Example:

    ECM-2026-0042

This value is intended for:

- customer communication;
- administration;
- invoices/documents;
- preparation sheets.

It is not the database primary key.

## Requirements

- unique;
- generated server-side;
- safe under concurrent order creation.

Exact sequence generation is defined during implementation.

---

# 15. OrderItem

Represents a commercial line in an Order.

An OrderItem can represent:

- an individual wine;
- a predefined bundle.

## Fields

    id
    orderId

    itemType

    productId
    bundleId

    nameSnapshot
    unitPriceAmount
    quantity
    lineTotalAmount

    createdAt

## itemType

Values:

    PRODUCT
    BUNDLE

## PRODUCT example

    itemType = PRODUCT
    productId = <Chasselas ID>

    nameSnapshot = "Chasselas"
    unitPriceAmount = 1800
    quantity = 3
    lineTotalAmount = 5400

## BUNDLE example

    itemType = BUNDLE
    bundleId = <Discovery Box ID>

    nameSnapshot = "Carton découverte"
    unitPriceAmount = 10000
    quantity = 2
    lineTotalAmount = 20000

## Rules

Only the appropriate source reference is populated.

Conceptually:

    PRODUCT → productId set, bundleId null
    BUNDLE  → bundleId set, productId null

This invariant must be validated by the application and, where practical,
by the database.

---

# 16. OrderItem snapshot

The OrderItem must preserve commercial information applicable at order
time.

Minimum snapshot:

    nameSnapshot
    unitPriceAmount
    quantity
    lineTotalAmount

Future product price changes must not alter the order.

---

# 17. Bundle fulfilment snapshot

This is critical.

If a bundle composition changes after an order is placed, historical
bottle requirements must remain correct.

Therefore an ordered bundle must preserve its order-time component
composition.

Recommended entity:

    OrderBundleComponent

## Fields

    id
    orderItemId

    productId
    productNameSnapshot
    quantityPerBundle

## Example

Order:

    2 × Discovery Box

OrderBundleComponent:

    Chasselas
    quantityPerBundle = 1

Total fulfilment contribution:

    2 × 1 = 2 Chasselas

## Why this exists

The system must not calculate historical requirements by reading the
current BundleItem configuration.

Changing a bundle later must not modify old orders.

---

# 18. Payment

Represents a payment attempt or completed payment associated with an
order.

An order may potentially have more than one payment attempt.

Therefore Payment must be a separate entity rather than storing only a
provider transaction ID directly on Order.

## Fields

    id
    orderId

    method
    provider

    amount
    currency

    status

    providerPaymentId
    providerSessionId

    createdAt
    updatedAt
    paidAt
    failedAt
    refundedAt

## Payment method

Conceptual values:

    TWINT
    CARD
    SELLER

Depending on PSP integration, online payment method may initially be
unknown until provider confirmation.

## Provider

Examples:

    STRIPE
    WORLDLINE
    OTHER
    OFFLINE

The final provider is TBD.

The business logic must not depend unnecessarily on a specific provider.

---

# 19. Payment status

Payment entity status may require more detail than the Order payment
summary.

Recommended conceptual values:

    PENDING
    PROCESSING
    SUCCEEDED
    FAILED
    CANCELLED
    REFUNDED
    PARTIALLY_REFUNDED

The exact list may be adapted to the selected PSP.

## Order summary mapping

Order:

    customerPaymentStatus = PAID

when the authoritative payment state indicates the required amount has
been successfully paid.

The Order summary is intended for operational simplicity.

Payment contains provider-level detail.

---

# 20. Offline seller payment

For seller payments, a Payment record may be created with:

    method = SELLER
    provider = OFFLINE
    status = PENDING

When administrator confirms that customer paid seller:

    status = SUCCEEDED
    paidAt = timestamp

Order becomes:

    customerPaymentStatus = PAID

Seller settlement remains:

    PENDING

until ECM receives the money.

---

# 21. SellerSettlement

Represents money collected by a seller that must be remitted to ECM.

The purpose is to distinguish:

    Customer → Seller

from:

    Seller → ECM Treasurer

## Recommended model

A settlement may group multiple seller-paid orders.

Example:

Anthony has collected:

    ECM-2026-0042     CHF 120
    ECM-2026-0061     CHF 180
    ECM-2026-0097     CHF 100

Anthony remits:

    CHF 400

This should ideally be represented as one settlement rather than three
unrelated boolean flags.

## Fields

    id
    campaignId
    sellerId

    amount
    status

    settledAt
    recordedByAdminUserId

    note

    createdAt
    updatedAt

## Status

    PENDING
    SETTLED

---

# 22. SellerSettlementOrder

Associates seller settlements with the orders included in the settlement.

## Fields

    id
    sellerSettlementId
    orderId
    amount

## Purpose

This makes it possible to answer:

- which orders were included in a remittance;
- how much was remitted;
- when;
- by which seller;
- who recorded it.

This is safer than maintaining only a generic seller balance.

---

# 23. Order seller settlement summary

Order may expose:

    sellerSettlementStatus

for operational convenience.

Conceptual mapping:

### Online payment

    NOT_APPLICABLE

### Seller payment not yet remitted

    PENDING

### Seller payment included in completed settlement

    SETTLED

The source of truth should remain the underlying financial records where
possible.

---

# 24. AdminUser

Represents the stable domain/audit identity of an administrator — every
OrderEvent/SellerSettlement audit reference points at `AdminUser.id`,
never at the authentication identity below.

## Fields

    id
    email
    name
    active
    authUserId

    createdAt
    updatedAt
    lastLoginAt

`active` is the single authoritative authorization flag (Phase 3). It is
checked on every request server-side, independent of whether a session
also happens to exist.

`authUserId` (nullable, unique, `ON DELETE RESTRICT`) links to Better
Auth's own `auth_users.id` (Phase 3, `src/infrastructure/auth/`) — a
resolved TBD, see docs/09-SECURITY.md §83 TBD-SEC-001. Authorization
lookups use `authUserId`, never `email`; `AdminUser.email`/`name` are
domain/profile snapshots, not kept in lockstep with the authentication
identity's own email.

## Authentication tables (Phase 3, Better Auth-owned)

Better Auth's own schema — `auth_users`, `auth_sessions`,
`auth_accounts`, `auth_verifications`, `auth_rate_limits` — lives
alongside `AdminUser` but is not part of the domain model described in
this document: it is protocol state Better Auth creates/expires/deletes
as part of normal operation, not a historical/financial/audit record.
Unlike this document's RESTRICT-everywhere FK policy, `auth_sessions`
and `auth_accounts` CASCADE from `auth_users` (see
`src/infrastructure/database/schema/auth.ts` for the full rationale).

## V1 permissions

All active administrators have equivalent application permissions.

---

# 25. OrderEvent

Represents important administrative or automated changes to an order.

This provides a lightweight audit trail.

## Fields

    id
    orderId

    type
    actorType
    adminUserId

    metadata

    createdAt

## Possible event types

    ORDER_CREATED
    ORDER_CONFIRMED

    SELLER_ASSIGNED
    SELLER_CHANGED

    ORDER_PREPARED
    ORDER_HANDED_TO_SELLER
    ORDER_DELIVERED
    ORDER_CANCELLED

    CUSTOMER_PAYMENT_MARKED_PAID
    PAYMENT_CONFIRMED_BY_PROVIDER

    SETTLEMENT_CREATED
    SETTLEMENT_COMPLETED

    ORDER_EDITED

The exact event list may evolve.

---

# 26. Actor type

Possible conceptual values:

    SYSTEM
    ADMIN
    PAYMENT_PROVIDER

Customer actions that create an order may be represented as system/order
creation events rather than requiring a persistent customer actor.

---

# 27. Audit philosophy

The application does not need a heavyweight enterprise audit system.

However, important actions involving:

- money;
- order cancellation;
- seller assignment;
- fulfilment;
- administrative edits;

should leave enough information to understand what happened.

Example:

    15 Dec 2026 14:32
    Order marked PREPARED
    by Anthony Admin

    16 Dec 2026 09:14
    Order handed to seller
    by Example Admin

    20 Dec 2026 18:42
    Customer payment marked PAID
    by Example Admin

---

# 28. Wine requirement calculation

Wine requirements must use order-time fulfilment data.

For each eligible Order:

## Individual product

    required quantity += OrderItem.quantity

## Bundle

For each OrderBundleComponent:

    required quantity +=
        OrderItem.quantity × OrderBundleComponent.quantityPerBundle

Cancelled orders are excluded.

---

# 29. Seller sales calculation

Seller sales are derived from Orders.

Conceptually:

    seller sales =
        sum eligible order totals
        - refunded amounts

Excluded:

    CANCELLED orders

Seller target logic must not be stored as a manually editable accumulated
number.

It must be calculated from underlying data.

---

# 30. Seller collection calculation

For seller-payment orders:

## Still to collect from customers

Orders where:

    payment method = SELLER
    customerPaymentStatus = PENDING

## Collected from customers

Orders where:

    payment method = SELLER
    customerPaymentStatus = PAID

## Still to remit to ECM

Seller-paid amounts where:

    customerPaymentStatus = PAID

and the corresponding amount is not yet included in a completed
SellerSettlement.

---

# 31. Product deletion policy

Products referenced by historical orders should not normally be
physically deleted.

Use:

    active = false

where appropriate.

The same principle applies to:

- sellers;
- campaigns;
- bundles.

---

# 32. Seller deletion policy

If a seller leaves ECM:

    active = false

Historical orders remain linked to that seller.

Their historical sales remain available.

---

# 33. Campaign deletion policy

Campaigns containing orders must not be physically deleted through normal
administration.

Use:

    ARCHIVED

instead.

---

# 34. Image storage

Product and bundle records store a reference such as:

    imageUrl

The actual image storage provider is an architecture decision.

Images must not be stored directly as large binary values inside the main
relational database unless a future architectural decision explicitly
requires it.

---

# 35. Timestamps

Important entities should use timestamps consistently.

Typical fields:

    createdAt
    updatedAt

Domain-specific timestamps should exist when they carry business meaning.

Examples:

    paidAt
    preparedAt
    deliveredAt
    settledAt

A generic `updatedAt` must not replace meaningful business timestamps.

---

# 36. Time zone

Business operations occur primarily in Switzerland.

Application presentation should use the appropriate Swiss local time.

Database storage should use a consistent timezone-safe representation.

Exact technical implementation will be defined in the architecture.

---

# 37. Personal data

Orders contain personal information:

- name;
- address;
- email;
- telephone.

Access to this data must be restricted to authenticated administrators
and necessary application processes.

Personal information must not appear unnecessarily in:

- logs;
- URLs;
- analytics;
- payment metadata.

Detailed security/privacy requirements are defined in `09-SECURITY.md`.

---

# 38. Payment provider metadata

Only identifiers and metadata required for payment reconciliation should
be stored.

Examples:

    order internal ID
    public order number

Sensitive card information must never be stored by Melodia Wine Shop.

Card details must remain handled by the payment service provider.

---

# 39. Derived data

The following values should generally be calculated rather than manually
maintained:

- seller total sales;
- seller target percentage;
- total bottles sold;
- wine requirements;
- campaign revenue;
- number of orders;
- outstanding seller collections;
- outstanding seller remittances.

Avoid duplicated mutable totals where they can become inconsistent with
source records.

Caching or materialized summaries may be introduced later for
performance, but source-of-truth data remains authoritative.

---

# 40. Conceptual entity diagram

    ┌─────────────────┐
    │    Campaign     │
    └────────┬────────┘
             │
             ├──────────────────────┐
             │                      │
             ▼                      ▼
    ┌─────────────────┐    ┌─────────────────┐
    │ CampaignProduct │    │ CampaignSeller  │
    └────────┬────────┘    └────────┬────────┘
             │                      │
             ▼                      ▼
    ┌─────────────────┐    ┌─────────────────┐
    │     Product     │    │     Seller      │
    └────────┬────────┘    └────────┬────────┘
             │                      │
             │                      │
             ▼                      │
    ┌─────────────────┐             │
    │   BundleItem    │             │
    └────────┬────────┘             │
             │                      │
             ▼                      │
    ┌─────────────────┐             │
    │     Bundle      │             │
    └─────────────────┘             │
                                    │
             ┌──────────────────────┘
             │
             ▼
    ┌─────────────────┐
    │      Order      │
    └────────┬────────┘
             │
             ├──────────────────────────┐
             │                          │
             ▼                          ▼
    ┌─────────────────┐        ┌─────────────────┐
    │    OrderItem    │        │     Payment     │
    └────────┬────────┘        └─────────────────┘
             │
             ▼
    ┌──────────────────────┐
    │ OrderBundleComponent │
    └──────────────────────┘

             Order
               │
               ├───────────────► OrderEvent
               │
               └───────────────► SellerSettlementOrder
                                      │
                                      ▼
                              SellerSettlement
                                      │
                                      ▼
                                    Seller

---

# 41. Expected database invariants

The implementation should enforce important invariants wherever
reasonable.

Examples:

## Campaign

- campaign slug unique;
- only valid status values;
- opening/closing dates logically consistent.

## CampaignProduct

- one Product should not appear twice in the same Campaign;
- price cannot be negative.

## BundleItem

- quantity > 0;
- product must belong to the relevant campaign.

## CampaignSeller

- one Seller should not appear twice in the same Campaign;
- target cannot be negative.

## Order

- order number unique;
- total cannot be negative;
- campaign required.

## OrderItem

- quantity > 0;
- unit price >= 0;
- line total >= 0;
- item reference matches itemType.

## Payment

- amount >= 0;
- provider transaction identifiers unique where required.

## SellerSettlement

- amount > 0;
- seller belongs to relevant campaign.

---

# 42. Transaction boundaries

Operations affecting multiple financial or commercial records should be
atomic where appropriate.

Examples:

## Order creation

Conceptually:

    create Order
    create OrderItems
    create OrderBundleComponents
    create initial Payment record

These records must not result in a partially created commercial order.

## Payment webhook

Conceptually:

    validate provider event
    update Payment
    update Order payment summary
    create OrderEvent

These updates should remain consistent.

## Settlement

Conceptually:

    create SellerSettlement
    associate eligible orders
    calculate settlement amount
    complete settlement
    update operational summaries

Partial inconsistent settlement data must be avoided.

Exact transaction implementation depends on the selected ORM/database.

---

# 43. Idempotency

The data model must support idempotent processing for operations such as:

- payment webhooks;
- payment session creation;
- repeated checkout submissions where appropriate.

Provider event IDs or equivalent unique identifiers should be stored when
required to ensure that the same external event cannot be processed
twice.

Exact implementation belongs in `08-PAYMENTS.md`.

---

# 44. Future compatibility

The V1 model should not implement unnecessary V2 features.

However, it should remain reasonably extensible toward:

- seller accounts;
- customer accounts;
- multiple delivery waves;
- inventory limits;
- discounts;
- postal delivery;
- multiple campaigns;
- richer refund workflows.

Extensibility must not justify premature complexity.

---

# 45. Explicit V1 non-entities

The following entities are intentionally not required in V1:

    CustomerAccount
    SellerUser
    DeliveryWave
    Shipment
    Inventory
    Discount
    Coupon
    NewsletterSubscription

They should only be introduced when an actual requirement exists.

---

# 46. Open data-model decisions

## TBD-DATA-001 — PSP — PARTIALLY RESOLVED (Phase 2)

Worldline is the selected/preferred provider direction (see
`08-PAYMENTS.md` DECIDED list). Exact contract, API product and enabled
payment methods remain open (TBD-PAY-001/002) and do not block the
schema: `Payment.provider` is plain text, not tied to Worldline
specifically.

## TBD-DATA-002 — Refund depth — RESOLVED for V1 (Phase 2)

Full-refund workflow only, per `08-PAYMENTS.md` §41/§68. `Payment.status`
keeps `PARTIALLY_REFUNDED` as an available value for provider/data
fidelity, but no V1 workflow exposes triggering a partial refund.

## TBD-DATA-003 — Invoice model

Determine whether invoice data requires a dedicated Invoice entity or
whether documents can initially be generated directly from Order data.

Still open — out of scope until Phase 12 (Documents and exports).

## TBD-DATA-004 — Settlement workflow — RESOLVED (Phase 2)

Grouped SellerSettlement model, implemented as `SellerSettlement` +
`SellerSettlementOrder` exactly as described in §21/§22 above, confirmed
sufficient by the admin UX already specified in `06-ADMIN-SPEC.md`
§18/§38-§39 and `08-PAYMENTS.md` §34-§38.

## TBD-DATA-005 — Image storage

Provider TBD. Still open — does not block the schema (`imageUrl` is a
plain string column regardless of provider).

## TBD-DATA-006 — Admin authentication storage — RESOLVED (Phase 3)

Better Auth 1.7.5's own schema (`auth_users`, `auth_sessions`,
`auth_accounts`, `auth_verifications`, `auth_rate_limits`), integrated
alongside the Phase 2 `AdminUser` table via a new nullable unique
`AdminUser.authUserId` FK. See §24 above and
docs/09-SECURITY.md §83 TBD-SEC-001.

## TBD-DATA-007 — Bottle volume

Not modeled in Phase 4. `shortDescription`/`description` deliberately
do not carry volume — it is conceptually structured product data, not
prose. If the final wine selection requires representing a non-standard
bottle size, add a structured `volumeMl` (or similar) column in a
dedicated future migration rather than encoding it in free text.

---

# 47. Decisions

- DECIDED: Campaign is a first-class entity.
- DECIDED: Products can participate in multiple campaigns.
- DECIDED: Campaign-specific product prices are supported.
- DECIDED: Bundles belong to campaigns.
- DECIDED: Bundle compositions are snapshotted on orders.
- DECIDED: Customer data is snapshotted on Order.
- DECIDED: No Customer entity is required for V1.
- DECIDED: Seller and AdminUser are separate concepts.
- DECIDED: Seller participation is campaign-specific.
- DECIDED: Seller targets are campaign-specific.
- DECIDED: Order status and payment status are separate.
- DECIDED: Customer payment and seller settlement are separate.
- DECIDED: Seller-to-treasurer settlement is tracked in V1.
- DECIDED: Settlement should support grouping multiple orders.
- DECIDED: Payment is a separate entity.
- DECIDED: Multiple payment attempts must be supportable.
- DECIDED: Order commercial data must remain historically reproducible.
- DECIDED: Monetary values use precise representation.
- DECIDED: Important administrative actions receive a lightweight audit trail.
- DECIDED: Historical commercial records are not normally physically deleted.
- DECIDED: V1 implements a full-refund workflow only; no partial-refund
  UI/workflow (TBD-DATA-002, resolved Phase 2).
- DECIDED: SellerSettlement/SellerSettlementOrder implement the grouped
  settlement model (TBD-DATA-004, resolved Phase 2).
- DECIDED: Foreign keys from Order/OrderItem/OrderBundleComponent/
  Payment/PaymentEvent/OrderEvent/SellerSettlement/SellerSettlementOrder
  toward the master or parent record they reference use RESTRICT, not
  CASCADE — an accidental delete must never silently remove historical,
  financial or audit data (Phase 2 Gate 2; see also §2.4/§31-§33 above).
- DECIDED: At most one campaign may be ACTIVE at a time, enforced by a
  database partial unique index, not just application logic (Phase 4
  Gate 2).
- DECIDED: Campaign `status` alone determines public catalogue
  visibility; dates never automatically gate it (Phase 4 Gate 1).
- DECIDED: `CLOSED` campaigns are not publicly browsable in V1; they
  remain available administratively (Phase 4 Gate 2 — resolves the
  prior conflict between this document and
  `10-IMPLEMENTATION-PLAN.md`).
- DECIDED: A Bundle with any invalid/out-of-campaign/inactive component
  is excluded from the public catalogue in its entirety, never
  partially displayed (Phase 4 Gate 1/2).
- DECIDED: No public product-detail route (`/vins/[slug]`) in Phase 4
  (Phase 4 Gate 1 — deferred, not excluded permanently).
