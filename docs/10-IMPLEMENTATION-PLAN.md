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
    Phase 10  Online payments                      Gate 10B IN PROGRESS
    Phase 11+ Not started

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
