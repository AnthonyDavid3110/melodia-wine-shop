# Melodia Wine Shop — Implementation Plan

> Version: 0.1
> Status: Draft
> Related documents:
> - `01-PRODUCT-SPEC.md`
> - `02-BUSINESS-RULES.md`
> - `03-USER-FLOWS.md`
> - `04-DATA-MODEL.md`
> - `05-ARCHITECTURE.md`
> - `06-ADMIN-SPEC.md`
> - `07-DESIGN-SYSTEM.md`
> - `08-PAYMENTS.md`
> - `09-SECURITY.md`

---

# 1. Purpose

This document defines how Melodia Wine Shop should be implemented.

It exists to prevent a common failure mode:

    generate the entire application
        ↓
    discover architectural problems
        ↓
    rewrite large parts of the project

Implementation must instead proceed through small, coherent and
testable phases.

Each phase should leave the repository in a healthy state.

---

# 2. Implementation philosophy

The project should be built:

    foundation first
        ↓
    domain logic
        ↓
    operational workflows
        ↓
    public experience
        ↓
    payment integration
        ↓
    production hardening

Do not optimize for:

    number of files generated
    speed of first visual result
    quantity of code

Optimize for:

    correctness
    maintainability
    clarity
    recoverability
    design quality

---

# 3. Rule for Claude Code

Claude Code must not attempt to implement the complete specification in
one operation.

Work phase by phase.

Before starting a phase:

1. read relevant documentation;
2. inspect existing implementation;
3. identify dependencies;
4. identify unresolved decisions;
5. create a concise implementation plan.

After completing a phase:

1. run formatting;
2. run linting;
3. run type checking;
4. run relevant tests;
5. run production build where appropriate;
6. summarize changes;
7. identify remaining issues.

Do not continue silently through multiple major phases.

---

# 4. Documentation authority

Implementation must follow the project documentation.

Priority:

    security and financial invariants
        ↓
    business rules
        ↓
    data model
        ↓
    user flows
        ↓
    admin specification
        ↓
    design system
        ↓
    implementation details

If documents contradict each other:

    do not guess silently

Identify the contradiction and resolve it before implementing the
affected behaviour.

---

# 5. TBD handling

A `TBD` is not permission to invent an irreversible business decision.

If a TBD blocks implementation:

    stop
    explain the decision required
    propose reasonable options

If a TBD does not block implementation:

    use a clearly isolated placeholder
    document it
    continue

Examples:

Final wine photography:

    does not block architecture

Payment-provider credentials:

    blocks production payment integration
    but does not block PaymentProvider abstraction

---

# 6. V2 handling

Features marked `V2` must not be implemented unless explicitly requested.

Examples:

    customer accounts
    seller accounts
    inventory management
    multiple delivery waves
    discounts
    shipping
    newsletters

Do not build speculative infrastructure for these features unless the V1
architecture genuinely requires an extension point.

---

# 7. Phase overview

Recommended implementation phases:

    Phase 0   Repository foundation

    Phase 1   Design foundation

    Phase 2   Database and domain model

    Phase 3   Admin authentication

    Phase 4   Public catalogue

    Phase 5   Campaign and catalogue administration

    Phase 6   Customer cart

    Phase 7   Checkout and order administration

    Phase 8   Offline payment and seller workflows

    Phase 9   Preparation and fulfilment

    Phase 10  Online payments

    Phase 11  Emails

    Phase 12  Documents and exports

    Phase 13  Statistics and dashboard

    Phase 14  Security and resilience hardening

    Phase 15  Production preparation

    Phase 16  Campaign content and launch

---

# 8. Phase 0 — Repository foundation

## Goal

Create a clean, reproducible development environment.

## Tasks

Initialize:

    Next.js
    TypeScript
    Tailwind CSS

Configure:

    package manager
    ESLint
    formatting
    TypeScript strictness
    environment validation
    Git ignore rules

Add:

    .env.example

Create initial application structure.

Do not implement business features yet.

---

# 9. Phase 0 — Package manager

Use one package manager consistently.

Recommended:

    pnpm

Commit:

    pnpm-lock.yaml

Do not mix:

    npm
    yarn
    pnpm

inside the same project.

---

# 10. Phase 0 — Required commands

Repository should expose predictable scripts.

Conceptually:

    pnpm dev
    pnpm build
    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm test:e2e

Exact script names may evolve but should remain obvious.

---

# 11. Phase 0 — Environment validation

Environment variables should be validated at application startup where
appropriate.

Separate:

    server-only variables

from:

    public variables

Missing required production configuration should fail clearly rather
than creating obscure runtime errors.

---

# 12. Phase 0 — Completion criteria

Phase is complete when:

    application starts locally
    TypeScript passes
    lint passes
    production build passes
    repository structure is clean
    no secrets exist in Git

No business UI is required yet.

---

# 13. Phase 1 — Design foundation

## Goal

Establish the visual language before building many screens.

Read:

    07-DESIGN-SYSTEM.md

Do not begin by implementing the complete homepage.

---

# 14. Phase 1 — Visual exploration

Create 2–3 compact visual directions.

Each should demonstrate:

    campaign identity
    typography
    palette
    button
    product card
    wine image treatment
    basic hero
    cart element

These may initially exist as dedicated development/design pages.

Do not duplicate the whole application for each concept.

---

# 15. Phase 1 — Select direction

After review, choose one direction.

Then define:

    design tokens
    typography
    spacing
    radius
    border treatment
    shadows
    motion
    status colours

Remove abandoned design experiments once no longer useful.

---

# 16. Phase 1 — Core components

Implement foundational components such as:

    Button
    Input
    Textarea
    Checkbox
    RadioGroup
    Select
    Combobox
    Dialog
    Sheet
    Badge
    QuantitySelector

shadcn/ui may provide primitives.

The final styling must be project-specific.

---

# 17. Phase 1 — Representative screens

Before scaling the design, create representative prototypes for:

    public homepage
    wine card
    cart
    checkout form
    admin order list

Verify that the design works across:

    mobile
    tablet
    desktop

---

# 18. Phase 1 — Completion criteria

Phase is complete when:

    visual direction is coherent
    typography is selected
    palette is selected
    design tokens exist
    core components exist
    mobile direction is validated
    admin direction is validated

Do not build dozens of pages before this point.

---

# 19. Phase 2 — Database and domain model

## Goal

Implement the authoritative data model.

Read:

    02-BUSINESS-RULES.md
    04-DATA-MODEL.md
    09-SECURITY.md

---

# 20. Phase 2 — ORM decision

Before implementation, finalize:

    Drizzle

or:

    Prisma

Current preferred candidate:

    Drizzle

Document the final decision.

Do not maintain two ORMs.

---

# 21. Phase 2 — Database entities

Implement required entities including:

    Campaign
    Product
    CampaignProduct
    Bundle
    BundleItem
    Seller
    CampaignSeller
    Order
    OrderItem
    OrderBundleComponent
    Payment
    SellerSettlement
    SellerSettlementOrder
    AdminUser
    OrderEvent

Additional technical entities may be introduced when justified.

Example:

    PaymentEvent

---

# 22. Phase 2 — Constraints

Implement important database constraints.

Examples:

    unique order number
    unique campaign/product relation
    unique campaign/seller relation
    positive quantities
    non-negative monetary amounts
    foreign-key integrity

Do not rely solely on forms.

---

# 23. Phase 2 — Seed data

Create development seed data.

Example campaign:

    Les Vins de Mélodia 2026

Example sellers:

    realistic fictional/test names

Example wines:

    approximately six representative placeholder wines

Example bundle:

    Carton découverte

Seed data must be clearly development data.

Do not accidentally seed production with fictional orders.

---

# 24. Phase 2 — Domain services

Implement and test pure business logic before UI dependency where
practical.

Priority functions:

    calculateOrderTotal()
    calculateWineRequirements()
    calculateSellerSales()
    calculateSellerProgress()
    calculateOutstandingCustomerPayments()
    calculateOutstandingSellerSettlements()

Names are conceptual.

---

# 25. Phase 2 — Money utilities

Create centralized monetary utilities.

Responsibilities:

    minor-unit conversion
    addition
    multiplication
    CHF formatting

Do not scatter money formatting throughout React components.

---

# 26. Phase 2 — Tests

High-priority tests:

    product totals
    bundle totals
    bundle decomposition
    wine requirements
    seller sales
    cancelled order exclusion
    refunded amount behaviour
    settlement totals

---

# 27. Phase 2 — Completion criteria

Phase complete when:

    migrations work
    development DB can be created from scratch
    seed works
    domain calculations are tested
    database constraints exist
    typecheck passes
    tests pass

---

# 28. Phase 3 — Admin authentication

## Goal

Protect administration before building sensitive admin workflows.

Finalize authentication solution.

Current preferred candidate:

    Better Auth

---

# 29. Phase 3 — Requirements

Implement:

    admin login
    authenticated session
    logout
    protected admin routes
    server-side authorization
    disabled-admin handling

Do not implement customer or seller authentication.

---

# 30. Phase 3 — Initial admin

Provide a safe mechanism to create the first administrator.

Do not hardcode production credentials in source code.

---

# 31. Phase 3 — Security testing

Verify:

    anonymous admin page access denied
    anonymous admin mutation denied
    disabled admin denied
    valid admin allowed
    session expiration handled

---

# 32. Phase 3 — Completion criteria

No sensitive admin endpoint is accessible without authentication.

---

# 33. Phase 4 — Public catalogue

> **Reordering note (Phase 4 Gate 1, adopted for this project):** this
> phase and the next were swapped from the sequence originally sketched
> below. The public catalogue was built before the admin
> campaign/catalogue editor, so that the catalogue's real read model
> and public pages exist before an editor is built for them, and so a
> visitor-facing result exists sooner. "Phase 4" refers to the public
> catalogue in every gate report, commit, and later document from this
> point onward; "Phase 5" refers to the admin campaign/catalogue editor
> described further below. Phases 0–3 are unaffected by this swap.

## Goal

Build the customer-facing campaign experience.

Implement:

    campaign homepage
    wine catalogue
    wine details
    discovery bundle
    campaign explanation
    delivery explanation

Product detail pages (`/vins/[slug]`) were deliberately deferred out of
this phase — see docs/05-ARCHITECTURE.md §8 and the Phase 4 Gate 1
report. The editorial wine rows on the homepage already show full
description/tasting content inline, and there is no "add to cart"
destination yet to make a separate detail page worth visiting.

---

# 34. Phase 4 — Data source

Public pages must use database campaign data.

Do not hardcode production wines into React components.

Placeholder data should come through the same data model as final data.

The catalogue must render correctly for any product count — it must
never assume a fixed number of wines (the original ~six-wine V1
estimate is not a code-level constraint).

---

# 35. Phase 4 — Campaign state

Public behaviour (Phase 4 Gate 1/2 — resolves the conflict that existed
between this section and `01-PRODUCT-SPEC.md` §4.3 about `CLOSED`):

    DRAFT
        not publicly browsable

    ACTIVE
        catalogue browsable; the only status the public site ever shows
        in full

    CLOSED
        NOT publicly browsable in V1 — remains available
        administratively for history/reporting
        (matches 01-PRODUCT-SPEC.md §4.3)

    ARCHIVED
        not publicly browsable

`/` always represents the single ACTIVE campaign directly — there is no
public campaign slug/ID route in V1 (docs/05-ARCHITECTURE.md §8). A
PostgreSQL partial unique index (`campaigns_one_active_idx`,
drizzle/0002) enforces "at most one ACTIVE campaign" at the database
level; the application never silently picks one if that invariant is
ever violated. Campaign `status` is the sole authority for public
visibility — `openingDate`/`closingDate` are informational only and
never automatically gate the catalogue.

Product visibility additionally requires `products.active = true AND
campaignProducts.active = true`; ordering comes from
`campaignProducts.displayOrder` (see docs/04-DATA-MODEL.md §6/§7). A
Bundle is excluded from the public catalogue in its entirety if any of
its components is not an active CampaignProduct of the same active
campaign — never partially rendered.

Bottle volume is intentionally not modeled or displayed in this phase —
if the final wine selection requires it, a structured `volumeMl` field
can be added in a future migration; it does not belong in
`shortDescription`/`description`.

---

# 36. Phase 4 — SEO and metadata

Implement appropriate:

    title
    description
    social sharing metadata

Campaign links shared through WhatsApp/social networks should present
professionally.

`/admin/**` is excluded from indexing (robots.txt and per-page
`robots: noindex`).

---

# 37. Phase 4 — Completion criteria

A customer can browse the complete campaign comfortably on a smartphone.

No checkout required yet.

---

# 38. Phase 5 — Campaign and catalogue administration

## Goal

Allow administrators to configure the sale without editing source code.

Implement:

    campaign management
    product management
    campaign pricing
    bundle management
    seller management
    seller targets

---

# 39. Phase 5 — Product images

Integrate selected image storage or provide a clean temporary abstraction.

Do not block catalogue implementation if final photography is unavailable.

Use replaceable placeholders.

> **Gate 1/2A decision (adopted):** image *upload* is explicitly deferred
> past Phase 5 Gates 2A/2B. `imageUrl` fields on Product/Bundle remain in
> the schema and are preserved verbatim by every admin edit form (the
> field is part of the normal edit form, submitted back unchanged unless
> the administrator edits it), but no upload UI, no Vercel Blob
> dependency, and no `next.config.ts` `remotePatterns` were added. The
> Phase 4 editorial placeholder remains the real behaviour whenever
> `imageUrl` is absent. Real image management is a later, separate
> decision once a storage provider is actually configured.

---

# 40. Phase 5 — Validation

Admin forms must validate server-side.

Test:

    invalid price
    duplicate campaign product
    invalid bundle quantity
    invalid seller target
    inactive campaign behaviour

---

# 41. Phase 5 — Completion criteria

Admin can configure a complete campaign without database editing.

---

# 42. Phase 6 — Customer cart

> **Reordering note (Phase 6 Gate, adopted for this project):** this
> phase was narrowed to cart only. The original scope below bundled
> cart, checkout, customer information, seller selection,
> payment-method selection, and order review into one "Phase 6." In
> practice cart is a self-contained, low-risk, purely client-side
> feature with no Order creation, while checkout/order creation is a
> financial-state-creating operation that deserves its own gate and
> closer alignment with `08-PAYMENTS.md`/`09-SECURITY.md`. Checkout,
> customer information, seller selection, payment-method selection,
> order review, and transactional order creation (previously §44/§45/§46
> below) move to Phase 7, folded into what was "Order administration" —
> renamed "Checkout and order administration" — since admin order
> management needs Orders to exist first regardless of who creates them
> (customer checkout or admin manual entry). No previously planned
> functionality was dropped, only relocated: see §44/§45/§46/§48 below.
> Phases 0–5 and 8–16 are unaffected by this split.

## Goal

Let a customer build and adjust a cart against the live campaign
catalogue — no order is created in this phase.

Implement:

    cart
    quantity management

No checkout, no customer information collection, no seller selection,
no payment-method selection, and no Order of any kind. Those move to
Phase 7 (§44/§45/§46/§48 below).

---

# 43. Phase 6 — Cart

Cart may use client-side state.

Server remains authoritative for pricing/availability at every read (the
cart itself never stores or trusts a price — see
`05-ARCHITECTURE.md`'s cart storage/trust-boundary section) and will
remain authoritative at checkout once Phase 7 implements it.

Test:

    quantities
    bundle
    empty cart
    stale products
    changed price
    closed campaign / no active campaign
    campaign change discards a stale stored cart

---

# 44. Phase 7 — Seller selector

Implement searchable seller combobox.

Support:

    selected seller
    no seller

Server revalidates seller eligibility during order creation.

---

# 45. Phase 7 — Order creation

Implement transactional order creation.

Must snapshot:

    customer data
    item names
    prices
    bundle composition

Generate:

    ECM-YYYY-NNNN

safely under concurrency.

---

# 46. Phase 7 — Duplicate protection

Introduce checkout duplicate-submission protection.

Test double-click and request retry scenarios.

---

# 47. Phase 6 — Completion criteria

A customer can build a cart from the live catalogue, adjust or remove
quantities, and see an accurate subtotal computed from current
prices — comfortably on a smartphone.

No order is created yet. No checkout entry point is reachable yet
(`docs/03-USER-FLOWS.md` checkout flow begins in Phase 7).

---

# 48. Phase 7 — Checkout and order administration

> See the Phase 6 Gate reordering note at §42: this phase now begins
> with customer checkout/order creation (§44 Seller selector, §45 Order
> creation, §46 Duplicate protection above — physically still numbered
> under their original position in this document, retitled to Phase 7)
> before its originally-scoped order administration work below. Allow
> creation of valid unpaid/offline orders is this phase's opening goal;
> online PSP integration may still be mocked/disabled at this stage
> (that is Phase 10).

## Goal

Implement customer checkout (customer information, seller selection,
payment-method selection, order review, transactional order creation —
§44/§45/§46 above) and make the resulting orders operationally
manageable.

Implement:

    checkout
    customer information
    seller selection
    payment-method selection
    order review
    order list
    search
    filters
    order detail
    manual order creation
    seller assignment
    allowed editing
    cancellation
    order history

---

# 49. Phase 7 — Manual orders

Manual orders must use the same order creation/domain logic as online
orders wherever possible.

Avoid:

    createOnlineOrder()
    createTotallyDifferentPaperOrder()

Prefer shared business services with different source/input context.

---

# 50. Phase 7 — Paid order protection

Implement restrictions so monetary fields of successfully paid online
orders cannot be casually changed.

Non-monetary edits may remain possible.

---

# 51. Phase 7 — Completion criteria

A customer can create a valid seller-payment order end-to-end. The
resulting Order is visible in the database with correct snapshots and
totals.

Paper and online orders can be managed from one admin interface.

---

# 52. Phase 8 — Offline payment and seller workflows

## Goal

Implement:

    customer → seller

and:

    seller → ECM

as separate workflows.

---

# 53. Phase 8 — Customer payment

Admin can explicitly mark seller payment as collected.

Must record:

    payment status
    paidAt
    administrator/audit event

Confirmation required.

---

# 54. Phase 8 — Seller settlement

Implement:

    eligible order selection
    calculated settlement amount
    settlement creation
    completion
    administrator
    timestamp
    audit history

Prevent double settlement.

---

# 55. Phase 8 — Seller financial view

Display:

    sales
    target
    progress
    to collect
    collected
    remitted
    to remit

All values derived from source data.

---

# 56. Phase 8 — Completion criteria

Treasurer can understand offline money position without a parallel
spreadsheet.

---

# 57. Phase 9 — Preparation and fulfilment

## Goal

Support the physical preparation and delivery process.

Implement:

    wine requirements
    preparation by seller
    individual preparation status
    hand-to-seller status
    delivered status

---

# 58. Phase 9 — Wine requirements

Calculate from:

    individual OrderItems
    +
    OrderBundleComponents

Exclude:

    CANCELLED orders

Use order-time bundle snapshots.

---

# 59. Phase 9 — Seller grouping

Default preparation organization:

    Seller
        ├── Order
        ├── Order
        └── Order

Also expose:

    Unassigned orders

Unassigned orders must not disappear from operational views.

---

# 60. Phase 9 — State transitions

Implement audited actions:

    CONFIRMED
        ↓
    PREPARED
        ↓
    HANDED_TO_SELLER
        ↓
    DELIVERED

Do not infer payment from fulfilment.

---

# 61. Phase 9 — Completion criteria

ECM can run the physical preparation session from the application.

---

# 62. Phase 10 — Online payments

## Goal

Integrate production-target online payment architecture.

Read carefully:

    08-PAYMENTS.md
    09-SECURITY.md

Do not implement from memory.

Use current official provider documentation.

---

# 63. Phase 10 — Provider gate

Before production integration verify:

    Worldline merchant setup
    exact API product
    TWINT availability
    Visa availability
    Mastercard availability
    sandbox credentials
    callback mechanism
    refund mechanism

If unavailable:

    implement/test abstraction
    do not invent production configuration

---

# 64. Phase 10 — Integration

Implement:

    WorldlinePaymentProvider
    payment creation
    payment attempt records
    browser return
    provider callback/webhook
    signature/authenticity verification
    status mapping
    retry
    reconciliation identifiers

---

# 65. Phase 10 — Payment tests

Mandatory:

    TWINT success
    card success
    failure
    cancellation
    abandonment
    retry
    duplicate callback
    invalid callback
    amount mismatch
    currency mismatch
    browser closes after payment
    callback/browser race conditions

---

# 66. Phase 10 — Refunds

Implement full refund only if validated for V1 and supported by final
provider integration.

Never fake provider refund completion.

---

# 67. Phase 10 — Completion criteria

No online order becomes paid without authoritative provider confirmation.

Every successful transaction can be reconciled to an ECM order.

---

# 68. Phase 11 — Transactional email

## Goal

Send reliable order confirmations.

Finalize provider.

Current preferred candidate:

    Resend

---

# 69. Phase 11 — Templates

Implement at minimum:

    online paid order confirmation
    seller-payment order confirmation

Use campaign visual identity where practical.

Email content should remain simpler than web pages.

---

# 70. Phase 11 — Reliability

Order success must not depend on email success.

Log/observe email failures.

Provide an admin mechanism to inspect or resend confirmation if useful
and simple enough.

---

# 71. Phase 11 — DNS

Configure sender authentication:

    SPF
    DKIM
    DMARC

according to provider requirements.

Do this before production email launch.

---

# 72. Phase 11 — Completion criteria

Customer receives correct confirmation for both payment paths.

---

# 73. Phase 12 — Documents and exports

## Goal

Provide operational and accounting artifacts.

Implement:

    order invoice/receipt PDF
    preparation PDF
    seller preparation summary
    CSV exports

---

# 74. Phase 12 — PDF design

PDF documents should reuse campaign typography/identity where technically
reasonable.

Operational readability takes priority over decorative design.

Preparation sheets must print clearly in black-and-white if necessary.

---

# 75. Phase 12 — Invoice gate

Before final invoice implementation, validate:

    organisation details
    document wording
    numbering expectations
    accounting requirements

Do not invent legal/accounting wording.

---

# 76. Phase 12 — CSV security

Implement:

    UTF-8
    correct quoting
    formula-injection protection
    authenticated access

Test with common spreadsheet software.

---

# 77. Phase 12 — Completion criteria

ECM can prepare physical orders and export campaign data without manual
database access.

## Phase 12 Gate 12A — CSV export foundation (verified complete)

Implements the CSV half of Phase 12: an authenticated `/admin/exports`
page and four Route Handlers (`orders.csv`, `order-items.csv`,
`seller-sales.csv`, `wine-requirements.csv`), generated on demand from
authoritative persisted data — no PDF work, no migration, no new
dependency. Full detail (schemas, dialect, formula-injection defense,
payment-attempt selection rule, bundle representation, cancelled-order
semantics per export) is documented in `05-ARCHITECTURE.md` §35 and
`09-SECURITY.md` §49.

New: `src/domain/csv/*` (pure builders + tests),
`src/app/admin/(protected)/exports/*` (page + 4 Route Handlers),
`src/components/admin/campaign-selector.tsx` (moved from
`preparation/`, generalized with a `basePath` prop),
`src/infrastructure/database/integration/exports.db.test.ts`,
`e2e/exports.spec.ts`. Modified: `src/infrastructure/orders/orders.ts`
(`listOrdersForCampaignExport`), `src/infrastructure/settlements/
settlements.ts` (`listCampaignSellerSalesSummaries`),
`src/app/admin/(protected)/preparation/page.tsx` (import path only).

Verified: `pnpm test` (529/529 across 51 files, +8 new CSV test files),
`pnpm test:db` (271/271 across 24 files, +1 new file), `pnpm test:e2e`
(68/68, +5 new exports scenarios, all pre-existing specs — including
Gate 11B/11C's own email/resend scenarios — unaffected), `pnpm build`,
`pnpm lint`, `pnpm format:check` all clean (only the pre-existing
Gate 11C `_prevState`/`_formData` warnings remain).

**Deliberately not done in this gate**: PDF documents (invoice/
receipt, preparation sheet, seller preparation summary — Gate 12B/
12C), `ARCHIVED`-campaign export (deferred, scope reuses
`/admin/preparation`'s exact ACTIVE/CLOSED campaign-selection pattern).

**Phase 12 is NOT complete** — Gates 12B (preparation/seller-summary
PDF) and 12C (invoice/receipt PDF, explicitly gated behind organisation/
wording/numbering validation per §75) remain.

---

# 78. Phase 13 — Statistics and dashboard

## Goal

Provide useful campaign visibility.

Implement:

    revenue
    order count
    bottle count
    average order
    payment breakdown
    seller performance
    outstanding collections
    outstanding settlements
    actionable alerts

---

# 79. Phase 13 — Derived data

Statistics must be calculated from authoritative data.

Do not introduce manually maintained counters unless justified by
measured performance requirements.

---

# 80. Phase 13 — Charts

Only introduce charts that improve understanding.

Do not delay operational functionality to build decorative analytics.

---

# 81. Phase 13 — Completion criteria

Dashboard answers the main operational questions defined in
`06-ADMIN-SPEC.md`.

---

# 82. Phase 14 — Security and resilience hardening

## Goal

Review the complete application against:

    09-SECURITY.md

This is not the first time security is considered.

It is the final systematic pass.

---

# 83. Phase 14 — Review

Review:

    authentication
    authorization
    server validation
    secrets
    price integrity
    payment callbacks
    XSS
    CSRF
    redirects
    uploads
    CSV exports
    logging
    security headers
    dependencies
    error handling

---

# 84. Phase 14 — Abuse tests

Attempt intentionally:

    price manipulation
    quantity manipulation
    unauthorized admin calls
    fake payment callbacks
    duplicate callbacks
    duplicate settlements
    direct URL access
    malformed input
    XSS payloads
    CSV formula payloads

Fix findings before launch.

---

# 85. Phase 14 — Completion criteria

Production launch checklist in `09-SECURITY.md` can be completed without
known critical gaps.

---

# 86. Phase 15 — Production preparation

## Goal

Prepare real infrastructure.

Configure:

    Vercel
    production PostgreSQL
    authentication
    Worldline
    email
    storage
    DNS

---

# 87. Phase 15 — Domain

Configure:

    vins.ecmelodia.ch

Verify:

    DNS
    HTTPS
    canonical URL
    payment callback URLs
    email links
    social metadata

The existing Wix website must remain unaffected.

---

# 88. Phase 15 — Database

Before production use verify:

    backups
    migration process
    production credentials
    connection security
    restore procedure

Do not populate production with development orders.

---

# 89. Phase 15 — Admin accounts

Create real individual administrators.

Remove or disable temporary development accounts.

---

# 90. Phase 15 — Production payment test

Perform controlled real-payment testing if provider setup permits.

Verify end-to-end:

    order
    payment
    provider back office
    application reconciliation
    email
    refund if applicable

Use small controlled amounts where possible.

---

# 91. Phase 15 — Completion criteria

Production infrastructure is operational but campaign does not need to be
publicly launched yet.

---

# 92. Phase 16 — Campaign content

Replace all placeholders.

Finalize:

    wines
    producers
    vintages
    descriptions
    prices
    bundle
    images
    seller list
    seller target
    campaign dates
    delivery information
    ECM organisation information

---

# 93. Phase 16 — Content audit

Search repository/application for:

    TODO
    TBD
    placeholder
    example.com
    lorem ipsum
    fake wine names
    test prices
    development credentials

Every remaining occurrence must be intentional.

---

# 94. Phase 16 — Flyer

Create final A4 folded flyer using the validated design system.

Include:

    campaign identity
    wine selection
    prices
    discovery box
    support message
    QR code
    paper order form

QR code points to:

    https://vins.ecmelodia.ch

Test QR code from printed output before mass printing.

---

# 95. Phase 16 — Final customer tests

Test complete customer flow on:

    iPhone Safari
    Android Chrome
    desktop Chrome
    desktop Firefox

Where practical also verify:

    Safari desktop
    Edge

Prioritize real mobile devices.

---

# 96. Phase 16 — Final admin test

Simulate campaign operations:

    create manual order
    assign seller
    mark customer payment
    prepare
    hand to seller
    deliver
    create settlement
    export CSV
    generate PDF

This should be tested with realistic sample volume.

---

# 97. Launch decision

Launch only when:

    public content complete
    products correct
    prices correct
    payment tested
    emails tested
    admin tested
    backups active
    legal/privacy information reviewed
    QR code tested
    production domain working

Do not launch merely because the application builds.

---

# 98. Post-launch monitoring

During first days monitor:

    failed checkouts
    failed payments
    webhook errors
    duplicate orders
    email failures
    unassigned orders
    unusual customer questions

Fix operational friction quickly.

Avoid large architectural refactors during active campaign unless
necessary.

---

# 99. Campaign closure

At campaign closing:

    disable new orders
    preserve existing orders
    calculate final wine requirements
    export backup data

Then continue:

    producer ordering
    preparation
    seller handoff
    delivery
    customer collection
    seller settlement

Campaign closure is not operational completion.

---

# 100. Campaign completion

Campaign can be considered operationally complete when:

    all valid orders processed
    deliveries resolved
    customer payments resolved
    seller settlements resolved
    refunds resolved
    exports archived

Only then should the campaign eventually move toward archival state.

---

# 101. Annual reuse

For the next campaign:

Do not duplicate the entire application.

Create:

    new Campaign
    new CampaignProducts
    new Bundles
    new CampaignSellers
    new dates
    new prices
    new content

Historical campaign data remains intact.

---

# 102. Git workflow

Prefer small coherent commits.

Examples:

    feat: add campaign catalogue
    feat: implement seller settlement workflow
    fix: prevent duplicate payment callbacks
    test: cover bundle requirement calculations
    docs: document Worldline integration

Avoid commits such as:

    stuff
    fixes
    update
    final final

---

# 103. Refactoring rule

Refactoring is encouraged when it improves:

    clarity
    correctness
    maintainability

Do not refactor unrelated areas during a sensitive payment or production
fix without need.

Keep changes scoped.

---

# 104. Dependency rule

Before adding a dependency, ask:

1. Is it necessary?
2. Is it maintained?
3. Does the platform already solve this?
4. Does it create significant client bundle weight?
5. Does it affect security?
6. Is it justified for this project's scale?

Avoid dependency accumulation.

---

# 105. Performance rule

Do not prematurely optimize.

But avoid obvious problems such as:

    huge client bundles
    unoptimized product images
    unnecessary client components
    N+1 database queries in admin tables
    loading entire order history when not required

Measure before introducing complex caching infrastructure.

---

# 106. Accessibility rule

Accessibility is checked during each UI phase.

Do not postpone all accessibility work until Phase 14.

Verify continuously:

    keyboard
    focus
    labels
    contrast
    semantic structure
    mobile touch targets

---

# 107. Responsive rule

Every public feature must be tested mobile-first.

Admin features should be tested at least on:

    desktop
    tablet
    mobile

Do not complete a desktop page and leave mobile as unspecified future
work.

---

# 108. Error-state rule

Every significant flow must intentionally design:

    loading
    empty
    success
    validation error
    server error

Payment flows additionally require:

    cancelled
    failed
    pending verification

---

# 109. No fake completion

Claude Code must not report a feature as complete when:

    implementation is stubbed
    tests are failing
    provider integration is mocked
    security requirement is skipped
    production dependency remains unresolved

Instead state clearly:

    implemented
    mocked
    blocked
    remaining

---

# 110. No silent scope expansion

Claude Code must not independently add:

    customer accounts
    reviews
    wishlist
    coupon system
    newsletter
    shipping calculator
    dark mode
    AI chatbot
    recommendation engine

These are outside V1.

---

# 111. Definition of done — feature

A feature is done when applicable:

    functionality works
    server validation exists
    authorization exists
    error states exist
    responsive behaviour exists
    accessibility considered
    tests cover critical logic
    lint passes
    typecheck passes
    build passes
    documentation remains accurate

---

# 112. Definition of done — project

V1 is done when ECM can:

1. configure a campaign;
2. publish wines and bundle;
3. receive individual-bottle orders;
4. receive bundle orders;
5. accept TWINT;
6. accept card payments;
7. accept seller payments;
8. enter paper orders;
9. attribute orders to sellers;
10. calculate seller targets;
11. reconcile customer cash payments;
12. reconcile seller remittances;
13. calculate exact wine requirements;
14. prepare orders by seller;
15. track delivery;
16. generate required PDFs;
17. export campaign data;
18. administer the campaign securely;
19. reuse the system for a future campaign.

without maintaining a parallel operational order spreadsheet.

---

# 113. Current implementation status

At the time this document is written:

    Product specification        COMPLETE
    Business rules               COMPLETE
    User flows                   COMPLETE
    Data model                   COMPLETE
    Architecture                 COMPLETE
    Admin specification          COMPLETE
    Design specification         COMPLETE
    Payment specification        COMPLETE
    Security specification       COMPLETE
    Implementation plan          COMPLETE

Application implementation:

    Phase 0   Repository foundation           COMPLETE
    Phase 1   Design foundation                COMPLETE
    Phase 2   Database/domain                  COMPLETE
    Phase 3   Admin authentication              COMPLETE
    Phase 4   Public catalogue                  COMPLETE
    Phase 5   Campaign/catalogue administration COMPLETE
    Phase 6   Customer cart                     COMPLETE
    Phase 7   Checkout and order administration COMPLETE
    Phase 8   Offline payment and seller workflows COMPLETE
    Phase 9   Preparation and fulfilment           COMPLETE
    Phase 10  Online payments                      COMPLETE
    Phase 11  Transactional email                   COMPLETE
    Phase 12  Documents and exports                  Gate 12A COMPLETE (Gate 12B/12C pending)
    Phase 13+ Not started

Phase 5 covers campaign identity/lifecycle, Product master data,
CampaignProduct configuration, Bundle administration, Seller master
data, and CampaignSeller participation — see §38 below for scope and
the Phase 5 gate reports (1, 2A, 2B, 2C) for what was implemented and
verified. Reviewed and approved across all gates, including manual
visual review of the admin UI.

Phase 6 covers the customer cart only — see §42/§43 above for scope and
the reordering note explaining the split from the originally-bundled
"cart and checkout." No Order is created in Phase 6; checkout and order
creation are Phase 7. Cart storage format and trust boundary are
documented in `05-ARCHITECTURE.md`.

Phase 7 covers public checkout (seller-payment method only — no
Worldline/TWINT/card, see §48's note), the shared authoritative
order-creation core (`createOrder()`, used identically by ONLINE
checkout and MANUAL admin entry), duplicate-submission idempotency
(§14a in `04-DATA-MODEL.md`), and basic order administration (list,
detail, customer/delivery-note editing, seller assign/reassign/
unassign, cancellation, manual order entry) — see §42/§44/§45/§46/§48
above for scope. Explicitly excluded: marking payments received, seller
settlement, preparation/fulfilment status transitions beyond creation,
refunds, and everything else listed as a later-phase concern in the
Phase 7 implementation gate. Checkout trust boundary and order-creation
transaction are documented concretely in `05-ARCHITECTURE.md` §20/§21.

Phase 8 covers the offline money flow end to end: marking a customer's
seller-payment order as paid (`markCustomerPaymentReceived()`,
`payments`/`orders.customerPaymentStatus` updated atomically), and
seller → ECM settlement (`createSettlement()`, authoritative
server-derived amount, all-or-nothing across every selected order, the
pre-existing `seller_settlement_orders_order_id_unique` constraint as
the final concurrency backstop). Reuses the Phase 2 pure calculators
(`calculateSellerSales`, `calculateSellerCollections`,
`calculateSellerProgress`, `calculateSettlementAmount`,
`isEligibleForSettlement`) unchanged apart from adding the CANCELLED
guard to the last one. Tightens two Phase 7 mutations once financial
state becomes reachable: cancellation is blocked once
`customerPaymentStatus = PAID` or `sellerSettlementStatus = SETTLED`,
and seller reassignment is blocked once `sellerSettlementStatus =
SETTLED` — see BR-CAN-004/BR-SEL-005 in `02-BUSINESS-RULES.md`. No
migration was required — every column already existed. No
`/admin/paiements` dashboard, no Worldline/TWINT/card, no refunds; see
§56 above for the full non-goal list.

Phase 9 covers the physical preparation/delivery workflow: exact
campaign wine requirements (`getCampaignWineRequirements()`, wiring the
already-existing Phase 2 pure `calculateWineRequirements()`/
`decomposeBundle()` into a real, campaign-scoped, batched query for the
first time), an informational carton breakdown
(`calculateCartonBreakdown()`, never rounding the authoritative
requirement), and the strictly sequential fulfilment state machine
`CONFIRMED -> PREPARED -> HANDED_TO_SELLER -> DELIVERED`
(`canPrepareOrder`/`canHandOrderToSeller`/`canMarkOrderDelivered` in
`src/domain/orders/order-guards.ts`, enforced by
`markOrderPrepared()`/`handOrderToSeller()`/`markOrderDelivered()` and
their all-or-nothing bulk counterparts in
`src/infrastructure/fulfilment/fulfilment.ts`). An unassigned order may
be `PREPARED` but not handed to a seller — see BR-STA-006/007 in
`02-BUSINESS-RULES.md`. Fulfilment progress never changes the Phase 8
financial guards (BR-STA-008): an unpaid order remains cancellable
regardless of fulfilment status, and seller reassignment remains
blocked only once `SETTLED` — the admin UI adds a contextual warning
when reassigning a `HANDED_TO_SELLER`/`DELIVERED` order, but does not
block it. `/admin/preparation` provides the three documented views (par
vendeur, toutes les commandes, besoins en vin) with an explicit
campaign selector (`listFulfilmentRelevantCampaigns()`/
`resolveDefaultFulfilmentCampaign()`) that keeps preparation reachable
for a `CLOSED` campaign, never only an `ACTIVE` one. No migration was
required — the `order_status` enum values and the `preparedAt`/
`handedToSellerAt`/`deliveredAt` timestamp columns already existed. No
PDF, no CSV export, no inventory/procurement system; see §38 of the
Phase 9 implementation gate for the full non-goal list.

Phase 10 Gate 10B (online payments, Saferpay) is **in progress, not
complete**. Implemented: the full architecture and Saferpay JSON API
integration against the real Saferpay TEST environment — provider-
neutral orchestration (`initiateOnlinePayment()`/`confirmOnlinePayment()`
in `src/infrastructure/payments/online-payments.ts`), the
`saferpay-client.ts` adapter (Initialize/Assert, no signed-webhook
abstraction — see `08-PAYMENTS.md` §70), the approved online Order
lifecycle (`NEW` → trusted-success transaction → `CONFIRMED`/`PAID`,
`sellerSettlementStatus` always `NOT_APPLICABLE`), multi-attempt Payment
history with retry, the opaque public return-correlation token
(`payments.return_token`, migration `0005`), the `/commande/retour`
return route, checkout's TWINT/Carte bancaire/Paiement au membre
selector, and admin visibility into online payment attempts. Verified
end-to-end against the real Saferpay TEST account and covered by
automated tests (unit, DB, provider-contract, and Playwright via a
double-gated fake test provider). **Deliberately not yet done**, per the
gate's own scope: production Saferpay account/credentials (deployment
dependency, not started), refunds (out of scope), `NotifyUrl`/webhook
registration (needs a publicly reachable HTTPS deployment — a local dev
server cannot receive it), transactional email (Phase 11), and a full
rich order-confirmation view on the return page (the current one is
intentionally minimal per the gate's "no giant checkout redesign"
instruction). Phase 10 must not be marked COMPLETE until these are
addressed in a future gate.

Phase 10 Gate 10C read-only inspection (following Gate 10B) found a
**financial correctness blocker** in the already-shipped Gate 10B
mapping: the real Saferpay TEST smoke test observed
`Transaction.Status = AUTHORIZED`, which Gate 10B's code treated as
equally successful to `CAPTURED` — per official Saferpay documentation,
`AUTHORIZED` means funds are merely reserved, not yet transferred;
`Transaction/Capture` must be called and must itself confirm a captured
state first. Gate 10C-A (online-payments-capture-correctness) fixes
exactly this, before any notification/recovery work (Gate 10C-B)
proceeds. Implemented: `saferpay-client.ts`'s `capturePayment()`
(`Transaction/Capture`, full capture only, no partial capture);
`normalize-saferpay-outcome.ts`'s `REQUIRES_CAPTURE` outcome (distinct
from `SUCCEEDED`) and `normalizeSaferpayCaptureOutcome()`;
`confirmOnlinePayment()` now calls `Transaction/Capture` (outside any DB
transaction) whenever `Assert` reports `AUTHORIZED`, and only a
genuinely captured result reaches the existing local trusted-success
transaction (unchanged, reused as-is); `initiateOnlinePayment()` now
refuses to silently supersede an attempt Saferpay has already
authorized but whose capture is still unresolved (using the existing
`providerPaymentId` field, recorded as soon as `AUTHORIZED` is
observed — no schema change). Saferpay's own documented
`TRANSACTION_ALREADY_CAPTURED` error is treated as a success signal, not
a failure — this is Saferpay's own Capture idempotency mechanism, and
combined with the existing `SELECT ... FOR UPDATE` lock it makes two
concurrent confirmations of the same `AUTHORIZED` transaction safe
(proven by a dedicated real-committed-connections concurrency test).
Verified against the real Saferpay TEST account for both TWINT and
CARD, and covered by automated tests (unit, DB including the
concurrency proof, provider-contract, and Playwright — the fake test
provider now models `AUTHORIZED` requiring capture, not a `CAPTURED`
shortcut). No migration.

Phase 10 Gate 10C-B1 (Saferpay notification + manual reconciliation) is
**in progress, not complete**. Implemented: a dedicated `APP_BASE_URL`
server env var (`src/lib/app-url.ts`) replacing Gate 10B's incidental
`BETTER_AUTH_URL` reuse for `ReturnUrl` construction; the
`GET /api/payments/saferpay/notify/[token]` route (registered as the
identical URL for both `SuccessNotifyUrl` and `FailNotifyUrl`,
delegating entirely to the existing `confirmOnlinePayment()` — no second
financial mutation path); an HTTP response strategy distinguishing
genuinely reconciled/terminal/anomaly outcomes (200) from transport-
level transient failures (503, via a new `ConfirmOnlinePaymentResult
.transient` flag) so Saferpay's own callback-retry mechanism can help;
a real gap found and fixed in `initiateOnlinePayment()` (it would have
silently superseded an attempt Saferpay had already authorized but
whose capture confirmation was still uncertain — closed using the
existing `providerPaymentId` field, no migration); the admin "Vérifier
auprès de Saferpay" manual reconciliation action
(`reconcileOnlinePaymentForOrder()`, also delegating to
`confirmOnlinePayment()`, never a "mark paid" shortcut, precise
single-eligible-attempt selection with explicit failure on zero/
multiple candidates); and the mandatory Return-vs-Notify concurrency
proof (real committed connections, one caller via `confirmOnlinePayment`
directly, the other via the real notify route handler). Covered by
automated tests (unit — including the route handler's HTTP-response
mapping and the new `appUrl()` helper; DB — including cases A–F for the
notify path and the admin reconciliation function; the mandatory
concurrency test; Playwright — four new scenarios proving Notify-only
confirmation/cancellation without ever visiting `/commande/retour`, and
both callback orderings). No migration. Explicitly not done in this
gate (deferred to Gate 10C-B2): real Saferpay TEST `NotifyUrl` delivery
against a publicly reachable deployment (Neon + Vercel staging), Vercel
Deployment Protection bypass configuration, refunds, abandoned-order
cleanup (TBD-PAY-006, unchanged).

Phase 10 Gate 10C-B2 (Saferpay staging acceptance testing) is
**complete**. A temporary, isolated Neon PostgreSQL project and a
temporary Vercel HTTPS deployment were created solely to give
Saferpay's `NotifyUrl` a real, publicly reachable endpoint
(`05-ARCHITECTURE.md` §11/§42) — disposable validation infrastructure,
not production. Using the real Saferpay TEST environment throughout (no
simulated/faked provider interaction anywhere in this gate), three
acceptance scenarios were run against a real browser and independently
re-verified against Saferpay's own `PaymentPage/Assert` record
(`08-PAYMENTS.md` §73): (1) a real TWINT payment reconciled by
`NotifyUrl` alone, with the browser's `ReturnUrl` request deliberately
intercepted and blocked, proving genuine server-to-server recovery;
(2) a real Visa payment, including a genuine 3-D Secure challenge,
completed with both `ReturnUrl` and `NotifyUrl` left enabled and
unsuppressed, proving exactly-once local finalization under a real (not
simulated) race — exactly one Payment, one final PaymentEvent, one
`PAYMENT_CONFIRMED_BY_PROVIDER` event, zero anomalies; (3) a real TWINT
session genuinely cancelled via Saferpay's own hosted "Cancel" control,
independently confirmed `TRANSACTION_ABORTED` with no `Transaction`
object ever created, proving a cancellation can never produce a locally
paid/confirmed Order. A Dynamic Currency Conversion (DCC) prompt was
observed on the TEST Visa flow — a terminal/provider presentation
choice unaffected by, and requiring no change to, application code;
production onboarding should confirm ECM's DCC preference
(`08-PAYMENTS.md` §73.4). No source code was modified during this gate —
every finding was confirmatory of the Gate 10C-A/10C-B1 implementation.
The temporary staging resources remain alive only until final
review/cleanup (`05-ARCHITECTURE.md` §11/§42) and are not part of the
eventual production deployment.

Phase 10, as scoped by this document (integration architecture, the
full Saferpay JSON API protocol, and verification against the real
Saferpay TEST environment — §62/§64/§67 above), is now **COMPLETE**.
The Phase 10 completion criteria (§67: no online order becomes paid
without authoritative provider confirmation; every successful
transaction is reconcilable to an ECM order) are met and have now been
proven against a real deployment, not only against the automated
Playwright suite's fake test provider. Deliberately remaining open, and
explicitly **not** Phase 10 blockers because they belong to later
phases already defined in this document: production Worldline/Saferpay
merchant onboarding, production credentials, and the production
terminal's DCC configuration (all TBD-PAY-001, Phase 15 — see
§86/§87/§90 below); refunds (TBD-PAY-005, unchanged, not required for
V1 per `08-PAYMENTS.md` §41); abandoned-order cleanup (TBD-PAY-006,
unchanged); transactional email and a richer order-confirmation view
(Phase 11, per this document's own phase ordering).

Phase 11 Gate 11A (transactional email foundation) is **in progress,
not complete**. Implemented: TBD-ARCH-005 resolved to Resend
(`05-ARCHITECTURE.md` §29/§61); a minimal `EmailProvider` boundary
(`src/infrastructure/email/email-provider.ts`) so domain/application
code never imports the `resend` package directly; a real Resend
adapter (`resend-provider.ts`, the official `resend` npm package,
server-only, three normalized error types —
`EmailConfigurationError`/`EmailProviderRejectedError`/
`EmailNetworkError` — derived from the installed SDK's own
`RESEND_ERROR_CODE_KEY` union, consulted directly from
`node_modules/resend/dist/index.d.mts` and cross-checked against
current official Resend documentation, not assumed from memory); a
double-gated fake test provider (`fake-test-provider.ts`, mirroring
`src/infrastructure/payments/fake-test-provider.ts`'s exact safety
model — `NODE_ENV !== "production"` AND explicit
`E2E_FAKE_EMAIL_PROVIDER=true`); `RESEND_API_KEY`/`EMAIL_FROM` added to
`src/lib/env.ts`'s `serverSchema` (optional, asserted only at the point
a real send is attempted); a pure order-confirmation content builder
(`src/domain/email/order-confirmation-content.ts`) producing both HTML
and plain-text output from one shared computed-fields object so the
two can never diverge on a business fact, covering both required
variants (ONLINE_PAID for TWINT/CARD, SELLER_PAYMENT for SELLER,
derived from a single `paymentMethod` field rather than a separately
supplied variant flag); a dedicated `escapeHtml()`
(`src/domain/email/escape-html.ts`) applied to every interpolated
value in the HTML output, with dedicated tests proving HTML special
characters cannot inject markup; a composed entry point
(`order-confirmation.ts`'s `sendOrderConfirmationEmail()`). No database
migration — `EMAIL_SENT`/`EMAIL_FAILED` OrderEvent recording is
deferred to Gate 11B, matching the existing `orderEvents.type` plain-
text column (no schema change needed either way).

**Deliberately not done in this gate** (all explicitly out of scope
per the gate's own brief): no automatic dispatch wired into
`createOrder()`, `submitCheckoutAction()`,
`applySuccessfulOnlinePayment()`, `confirmOnlinePayment()`, the
Saferpay Return/Notify routes, or admin reconciliation — the
`sendOrderConfirmationEmail()` entry point exists but is not called
from any of them yet; no admin resend button (deferred to optional
Gate 11C); no password-reset email (deferred, unchanged); no
`EMAIL_SENT`/`EMAIL_FAILED` OrderEvent recording yet; no real Resend
API call was made at any point during this gate; no DNS configuration.
Resend idempotency support (`Idempotency-Key` header, 24-hour window,
confirmed present in the installed SDK) is documented but not used —
Gate 11B's structural placement of the dispatch call (inside the
already-proven idempotent transition points, never on every retry/
replay) remains the authoritative correctness mechanism; a stable
`Idempotency-Key` (e.g. `order-confirmation/<orderId>`) may be added
later as defense-in-depth once dispatch actually exists to key it to.
Covered by unit tests only (content builder, HTML escaping, both
provider adapters, provider-selection guard) — no DB integration test
was added, since Gate 11A performs no DB mutation of its own. Gate 11A
is now **complete** — validated with a real, manually authorized Resend
smoke test (real adapter, real `buildOrderConfirmationEmail()` content,
delivered to a real inbox and visually confirmed) before Gate 11B wired
any automatic dispatch.

Phase 11 Gate 11B (transactional email dispatch integration) implements
automatic dispatch for both customer-facing payment paths. Wired,
exactly at the two proven idempotent transition points identified by
the Gate 11B inspection, never at every retry/replay:

- `createOrder()` (`src/infrastructure/orders/create-order.ts`) —
  dispatches the SELLER_PAYMENT confirmation after its own transaction
  commits, gated on `result.status === "created" && source === "ONLINE"
  && result.order.status === "CONFIRMED"` — explicitly excludes MANUAL
  admin-entered orders (`source`, not order status alone, is the
  distinguishing signal — no schema change needed) and excludes an
  ONLINE order that chose TWINT/CARD (status `NEW` here; that order
  gets its confirmation later, from the path below).
- `applySuccessfulOnlinePayment()`
  (`src/infrastructure/payments/online-payments.ts`) — its internal
  transaction now distinguishes an idempotent "already SUCCEEDED"
  observation from the one call that genuinely performs the trusted
  success transition (`justTransitioned`); only the latter, after the
  transaction resolves, dispatches the ONLINE_PAID confirmation. Used
  identically by the Return route, the Notify route, and admin manual
  reconciliation — none of them needed their own dispatch logic.

Both call sites share the `dbHandle === db` architectural guard
(external post-commit side effects may only run when the function owns
the durable top-level DB handle — see `05-ARCHITECTURE.md` §31 for the
full reasoning), and both wrap the entire post-commit block in a
top-level try/catch so a failure anywhere in the email path (seller
lookup, send, or event recording) can never alter the already-committed
business result.

`EMAIL_SENT`/`EMAIL_FAILED` `OrderEvent`s are recorded by a new shared
`dispatchOrderConfirmationEmail()` (`order-confirmation.ts`), with
`{emailType, variant}` / `{emailType, variant, category}` metadata only
— never a raw provider message, body, or secret. A deterministic,
non-PII `order-confirmation/<orderId>` Resend `Idempotency-Key` is
forwarded as defense-in-depth only, explicitly documented as not a
substitute for the DB-level exactly-once guarantee. `commandes/[id]/
page.tsx`'s admin event-label map gained the two new French labels. No
database migration — `orderEvents.type` remains plain text.

**Real-credential test-safety, verified structurally:**
`playwright.config.ts`'s `webServer.env` now also sets
`E2E_FAKE_EMAIL_PROVIDER=true`; the four pre-existing DB integration
suites that use the real, durably-committing `db` handle (required for
the `dbHandle === db` guard to ever fire) now `vi.mock(
"@/infrastructure/email/resend-provider", ...)`, mirroring the
pre-existing Saferpay-client mock pattern in those same files. The
remaining ~15 DB suites needed no change — the `dbHandle === db` guard
itself already excludes every `withRollback()`-based test.

**Test coverage added:** unit tests for `dispatchOrderConfirmationEmail`
(variant selection, idempotency-key derivation, all four failure
categories, never-throws guarantee) and the Resend adapter's
idempotency-key passthrough; a dedicated DB integration suite
(`order-confirmation-email.db.test.ts`) proving, against real committed
connections: exactly-one dispatch for a genuinely created SELLER order,
zero dispatch for an idempotent checkout replay, zero dispatch for a
MANUAL order, EMAIL_FAILED recorded (order otherwise unaffected) on a
simulated send failure, exactly-one dispatch for the first authoritative
online success, zero on a subsequent idempotent confirmation call, and
exactly-one even under a genuine concurrent Return/Notify-style race;
the pre-existing `create-order-concurrency.db.test.ts` idempotency-key
race test was also extended with a dispatch-count assertion. A new
Playwright suite (`e2e/order-confirmation-email.spec.ts`) drives both
real customer-facing flows through an actual browser (SELLER checkout,
TWINT success, a cancelled payment, and a repeated Return-then-Notify
sequence) and verifies dispatch through the same DB-observable
`EMAIL_SENT`/`EMAIL_FAILED` events and `variant` metadata other specs
already use for OrderEvent verification — never a new test-only
inspection route, and never the real Resend API. All of the above is
**verified, not just written**: `pnpm test` (425/425), `pnpm test:db`
(253/253 across 22 files), and `pnpm test:e2e` (60/60, including the 4
new browser-driven email scenarios and all 56 pre-existing specs
unaffected) all pass against a real local PostgreSQL instance.

**Known, deliberately accepted limitation (no outbox, unchanged from
Gate 11A's own framing):** a process crash between the business
transaction's commit and the (best-effort) email attempt can lose a
single confirmation with no automatic retry; a crash between a
successful send and the `EMAIL_SENT` write leaves local observability
incomplete without affecting delivery. Neither is a duplicate-send or
financial-correctness risk — both are closed at the DB level (row lock
+ idempotency-key unique constraint), independent of email. No
migration/outbox was introduced to close these narrower gaps, per the
gate's own explicit scope.

**Deliberately not done in this gate**, unchanged/still deferred: admin
resend UI (Gate 11C); password-reset email; seller notification email
(not V1); marketing/broadcast email; PDF/CSV/invoice/refund/shipment
email content.

Gate 11B was **verified complete** and committed
(`8e64eaabe2d61edacb442c8817e8c5c2e568aad6`).

## Phase 11 Gate 11C — Admin manual resend (verified complete)

Adds a single admin-facing action — "Renvoyer la confirmation" on the
existing order-detail page (`/admin/commandes/[id]`) — for the two
operational cases Gate 11B's best-effort automatic dispatch cannot
cover: the narrow no-outbox crash window (§ above), and a customer
reporting non-receipt. This is explicitly a manual, admin-initiated
action, not an automatic retry/outbox system.

Eligibility and email variant (`ONLINE_PAID` vs `SELLER_PAYMENT`) are
always re-derived server-side from currently persisted order/payment
state by a new pure function,
`resolveOrderConfirmationEligibility()`
(`src/domain/email/resolve-confirmation-eligibility.ts`) — never from
prior `EMAIL_SENT` history, the browser, or `order.source`. A
`SELLER`-payment order already marked `customerPaymentStatus = PAID` is
ineligible (the original "payment still due" wording would be stale);
a `CANCELLED` order is always ineligible; fulfilment progression
(`PREPARED`/`HANDED_TO_SELLER`/`DELIVERED`) never affects eligibility,
matching the existing order-status/payment-status independence
principle (§ Order status above). `MANUAL` orders are eligible under
the identical `SELLER_PAYMENT` predicate as public checkout orders —
this does not change Gate 11B, which still sends zero automatic email
for `MANUAL` orders.

The duplicated order→email-input construction logic from Gate 11B's two
automatic call sites was extracted into a small shared
`buildOrderConfirmationEmailInput()`
(`src/infrastructure/email/order-confirmation.ts`), used unchanged by
both the automatic paths and the new manual path — a mechanical
refactor verified not to change Gate 11B's own behaviour (its full
existing regression suite passes unchanged). `dispatchOrderConfirmationEmail()`
now records `trigger: "AUTOMATIC" | "ADMIN_RESEND"` in `OrderEvent`
metadata (pre-Gate-11C events have no `trigger` key and are treated as
legacy/automatic by the admin UI — never rewritten); for
`ADMIN_RESEND`, `actorType`/`adminUserId` reuse the existing
`orderEvents` actor columns for the authenticated admin, no new PII.

**Manual-resend idempotency is intentionally narrower than the
automatic path**, an explicit, approved scope decision: each invocation
generates a fresh, server-side, non-PII `randomUUID()` and derives the
Resend idempotency key as
`order-confirmation/resend/${orderId}/${attemptId}` (vs. the automatic
path's stable `order-confirmation/${orderId}`). This protects a single
invocation from internal retries but does not guarantee cross-request
exactly-once delivery — a genuinely replayed/duplicate Server Action
invocation can send a second email. No table, lock, or durable request
token was added to close this gap; the UI mitigates the common case by
disabling the confirm button while pending.

New/changed files: `src/domain/email/resolve-confirmation-eligibility.ts`
(+ test), `src/infrastructure/email/order-confirmation.ts` (extended,
+ test updates), `src/infrastructure/orders/create-order.ts` and
`src/infrastructure/payments/online-payments.ts` (mechanical refactor
to the shared builder), `src/app/admin/(protected)/commandes/[id]/
actions.ts` (new `resendOrderConfirmationAction`), `.../
resend-confirmation-button.tsx` (new), `.../page.tsx` (button/history
wiring). No migration, no new dependency.

Verified: `pnpm test` (450/450 across 42 files), `pnpm test:db`
(262/262 across 23 files, including the new
`resend-confirmation.db.test.ts`), `pnpm test:e2e` (63/63, including 3
new browser-driven scenarios and all pre-existing specs — including
Gate 11B's own 4 email scenarios — unaffected), `pnpm build`,
`pnpm lint`, `pnpm format:check` all clean. The new DB suite
`vi.mock`s the real Resend adapter (the one `withRollback()`-based
suite able to reach dispatch code, since manual resend has no
`dbHandle === db` gate); the new E2E spec runs against
`E2E_FAKE_EMAIL_PROVIDER=true` like every other spec — no automated
test reaches the real Resend API.

**Phase 11 — Transactional email: COMPLETE.** All three gates (11A
foundation, 11B automatic dispatch, 11C admin manual resend) are
implemented and verified. Deferred, unchanged: password-reset email,
seller notification email (not V1), marketing/broadcast email,
PDF/CSV/invoice/refund/shipment email content, and the no-outbox crash
window documented above (accepted, not a financial-correctness risk).

The project was specified before implementation.

---

# 114. Immediate next step

After documentation review:

    create CLAUDE.md

Then:

    Phase 0 — Repository foundation

Do not start by generating the full application.

---

# 115. Decisions

- DECIDED: Implementation is phased.
- DECIDED: Claude Code must not implement the whole application at once.
- DECIDED: Each major phase is validated before broad continuation.
- DECIDED: Documentation is authoritative.
- DECIDED: TBD decisions are not silently invented.
- DECIDED: V2 features are not implemented.
- DECIDED: Design foundation precedes broad UI implementation.
- DECIDED: Domain calculations are tested early.
- DECIDED: Admin authentication precedes sensitive admin workflows.
- DECIDED: Seller-payment workflow is implemented before online PSP complexity.
- DECIDED: Worldline integration occurs only after provider details are confirmed.
- DECIDED: Production payment success is provider-authoritative.
- DECIDED: Security is continuous and receives a final dedicated review.
- DECIDED: Production launch requires operational simulation.
- DECIDED: Annual campaigns reuse the same application.
