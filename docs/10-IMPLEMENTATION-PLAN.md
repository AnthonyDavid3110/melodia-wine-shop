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

## Phase 12 Gate 12B — Preparation PDFs (verified complete)

Implements the two preparation-oriented PDFs: individual order
(`/admin/commandes/[id]/documents/preparation.pdf`) and per-seller
(`/admin/preparation/documents/seller/[sellerId]`), both authenticated,
generated on demand, never persisted. Resolves `TBD-ARCH-007` — see
`05-ARCHITECTURE.md` §34 for the adopted `@react-pdf/renderer`
architecture and the compatibility evidence gathered before adoption
(React 19, Next.js 16 Turbopack dev + build, no `serverExternalPackages`
needed).

Content, eligibility, and snapshot/live mapping match the approved
Step 1 plan exactly: both documents reuse the identical
`PreparationSheetContent` per-order model (never two representations
of an order); eligibility reuses `listOrdersForCampaignExport()`
filtered to non-`CANCELLED` orders (the same scope `/admin/
preparation`'s fulfilment view already uses, `NEW` orders included
deliberately); seller-level totals reuse `listCampaignSellerSalesSummaries()`
verbatim (Gate 12A), never recalculated. Seller display name remains a
live reference (same accepted V1 limitation as Gate 12A/Gate 11C, no
migration).

A real, visually-inspected pagination bug was found and fixed during
implementation: an initial partial-`wrap={false}` strategy left the
`fixed` page footer overlapping flowing content at page breaks (the
footer doesn't reserve space in react-pdf's own content-flow height
calculation). Fixed by reserving extra `paddingBottom` and by making
each order's entire section unbreakable (`wrap={false}` on the whole
section) rather than just its identity block — verified by regenerating
and visually inspecting representative PDFs (ordinary order, a
Discovery Box/bundle order, a 6-order seller document, an 18-order/
10-page seller document including one 8-line-item order) until clean.

Verified: `pnpm test` (557/557 across 55 files, +11 new document test
files), `pnpm test:db` (271/271 across 24 files, unchanged — no new
query semantics needed, existing Gate 12A infrastructure reused
verbatim), `pnpm test:e2e` (73/73, +5 new preparation-document
scenarios, all pre-existing specs unaffected), `pnpm build`, `pnpm
lint`, `pnpm format:check` all clean (only the pre-existing Gate 11C
warnings remain).

**Deliberately not done in this gate**: invoice/receipt PDF (Gate
12C), any font embedding (built-in Helvetica only), combined
"all campaign orders" PDF.

## Phase 12 Gate 12C — Customer-facing commercial documents (verified complete)

Implements the final Phase 12 artifact — resolved as **two** documents,
not the "invoice" originally anticipated by §73/§23.2/§37/BR-DOC-003:
**`Confirmation de commande`** (any non-`CANCELLED` order) and
**`Reçu`** (only once `customerPaymentStatus === "PAID"`). This gate
was blocked purely on real organisation/wording/accounting validation
(§75) — never on anything technical — and unblocks only once ECM
provided that content directly: real organisation name/address, ECM is
not VAT-registered, no bank-transfer/QR-bill payment model exists, and
the existing order number is used only as a plain `Référence de
commande`, never labelled or treated as a legally authoritative
invoice number. No placeholder content was ever rendered — implementation
did not begin until the real content was provided.

Both documents share one content model
(`src/domain/documents/build-order-document-content.ts`) and one
React-PDF component (`src/infrastructure/documents/order-document.tsx`),
rendered via a new `renderOrderDocumentPdf()` added to the existing
`pdf-renderer.tsx` — no new dependency, no migration, reusing Gate
12B's entire React-PDF infrastructure unchanged. The RECEIPT variant's
"never claim payment when not paid" requirement is enforced at compile
time: `buildReceiptContent()`'s parameter type only accepts an order
already narrowed to `customerPaymentStatus: "PAID"`, and
`canGenerateReceipt()` is a TypeScript type predicate that performs
that narrowing automatically at every call site — not merely a runtime
check. Routes: `/admin/commandes/[id]/documents/confirmation.pdf`,
`/admin/commandes/[id]/documents/receipt.pdf`, both on the existing
order-detail Documents section (never `/admin/exports`), both
independently `getAdminOrNull()`-gated exactly like every prior Gate
12A/12B route.

Verified: `pnpm test` (580/580 across 56 files, +9 new document test
files), `pnpm test:db` (271/271 across 24 files, unchanged — no new
query semantics needed), `pnpm test:e2e` (79/79, +6 new order-document
scenarios, all pre-existing specs unaffected), `pnpm build`, `pnpm
lint`, `pnpm format:check` all clean (only the pre-existing Gate 11C
warnings remain).

**Deliberately not done in this gate**: anything resembling a
traditional bank-transfer invoice, VAT/TVA handling of any kind, a
Swiss QR-bill payment slip, a dedicated `Invoice` database entity, a
sequential invoice-numbering counter — all explicitly rejected by ECM's
own decision, not deferred as a technical gap.

**Phase 12 is now COMPLETE.** All of §73's goal list (order
confirmation/receipt, preparation PDF, seller preparation summary, all
4 CSV exports) is implemented, tested, and verified. §77's completion
criterion — "ECM can prepare physical orders and export campaign data
without manual database access" — is met.

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

## Phase 13 Gate 13B implementation (adopted) — operational `/admin` dashboard

Phase 13 was split into two gates at approval time:

    Gate 13B — operational `/admin` dashboard (implemented here)
    Gate 13C — `/admin/statistiques` (not yet implemented)

**Phase 13 is NOT complete.** Gate 13B answers "what is happening now,
and what needs attention?" (docs/06-ADMIN-SPEC.md §4-§7). Gate 13C —
"how is/was the campaign performing?" (§50: sales by wine/bundle/seller,
TWINT vs. card, broader historical campaign selection) — remains a
separate, later gate.

Architecture: every KPI/alert/seller-objective figure is composed from
existing pure domain calculators (`calculateSellerSales`,
`calculateSellerCollections`, `calculateSellerProgress`) and existing
batched infrastructure queries (`listCampaignSellerSalesSummaries`,
`getCampaignWineRequirements`, `selectAuthoritativePaymentForExport`,
`resolveRequestedCampaign`) — see `src/domain/dashboard/` (five small,
independently tested pure functions) and
`src/infrastructure/dashboard/dashboard.ts` (one new batched query,
`getCampaignDashboardOrders`, mirroring `listOrdersForCampaignExport`'s
shape minus item/bundle detail the dashboard doesn't need). No new
aggregation/exclusion rule was invented — `outstandingCustomerPayments`
and `outstandingSellerSettlements` both come from the same
`calculateSellerCollections()` call, so they structurally cannot be
inferred from one another (CLAUDE.md §11).

No migration. No new dependency. No chart — tables/numbers only
(docs/07-DESIGN-SYSTEM.md §48, §80 above).

**`/admin/commandes` filter extension (Gate 13A preflight finding):**
the order list had no URL-driven filters at all — `OrderSearchList` was
a purely client-side, in-memory filter with no query-param wiring, and
had no seller/unassigned filter. Extended minimally: `?status=`,
`?paymentStatus=` now seed the existing filters' initial state, and a
new "Vendeur" filter (`?seller=unassigned`) was added — a plain
all/unassigned toggle, not a full seller picker. The order list itself
remains deliberately NOT campaign-scoped (unchanged Phase 7 decision,
`orders.ts`'s own comment) — so an alert's linked view is not itself
scoped to the dashboard's selected campaign. This is a known, accepted
limitation, not a defect: at this campaign's scale there is normally at
most one ACTIVE and one recently-CLOSED campaign with live orders.

**Deferred: payment-anomaly alert.** `PAYMENT_ANOMALY_DETECTED` is a
plain append-only `orderEvents` log entry (`online-payments.ts`) with no
"resolved" state and no anomaly table — the data cannot reliably
distinguish a current, actionable anomaly from a historical one that was
already handled. Per the Gate 13B brief's own instruction, this alert is
deferred rather than shown with invented/unreliable semantics. No
persistence or state-machine was added to support it.

**Known limitation: outstanding-settlements alert destination.** No
filtered "sellers who still owe money this campaign" view exists.
The alert links to `/admin/vendeurs` (the closest real destination,
per the approved brief) rather than a fake/invented filtered link.
Building that filtered view is out of Gate 13B's scope.

**Companion fix:** `/admin/exports` (built in Gate 12A) had no admin
nav link; added one, since Gate 13B already touches the nav area.

---

## Phase 13 Gate 13C implementation (adopted) — `/admin/statistiques`

Implements the full §50 statistics list: total revenue, orders,
bottles, average order value (reusing Gate 13B's `buildPrimaryKpis()`
unchanged), sales by wine, sales by bundle, sales by seller, online vs
seller payment (reusing Gate 13B's `buildPaymentKpis()` unchanged),
TWINT vs card, and seller target progress. Also delivers BR-COL-002's
previously-deferred "online-paid sales" per seller.

Campaign selection deliberately covers ACTIVE ∪ CLOSED ∪ ARCHIVED (not
ACTIVE ∪ CLOSED like `/admin`/`/admin/preparation`/`/admin/exports`) —
a new, purpose-specific resolver pair
(`listStatisticsRelevantCampaigns()`/`resolveDefaultStatisticsCampaign()`
in `src/infrastructure/campaign/campaigns.ts`, plus
`resolve-requested-statistics-campaign.ts`), justified directly by
BR-CAM-003. This is the first page in the application to actually
deliver on that requirement for ARCHIVED campaigns specifically.

New: `src/infrastructure/statistics/statistics.ts`
(`getCampaignItemSalesBreakdown`), `src/domain/statistics/*`
(`buildWineSalesTable`, `buildBundleSalesTable`,
`buildTwintVsCardBreakdown`, each with its own test file),
`src/app/admin/(protected)/statistiques/page.tsx`,
`src/infrastructure/database/integration/statistics.db.test.ts`,
`e2e/statistics.spec.ts`. Modified:
`src/infrastructure/settlements/settlements.ts`
(`listCampaignSellerSalesSummaries` gained `onlinePaidSales`),
`src/infrastructure/campaign/campaigns.ts` (new resolver functions),
`src/app/admin/(protected)/layout.tsx` (nav link, between Préparation
and Exports).

The wine table's bottles-vs-direct-revenue distinction (see
docs/06-ADMIN-SPEC.md §50's implementation note) and the refund-
semantics decision (no blanket `REFUNDED == CANCELLED` rule invented —
see docs/05-ARCHITECTURE.md) were both explicit, approved product
decisions, not implementation shortcuts.

No migration. No new dependency. No chart.

Verified: `pnpm test` (615/615 across 64 files, +13 new), `pnpm test:db`
(288/288 across 26 files, +13 new), `pnpm test:e2e` (all passing,
+4 new statistics scenarios, all pre-existing specs unaffected),
`pnpm build`, `pnpm lint`, `pnpm format` all clean (only the
pre-existing Gate 11C `_prevState`/`_formData` warnings remain).

**Phase 13 is now COMPLETE.** Every item in §78's goal list is
delivered across Gate 13B (`/admin`) and Gate 13C
(`/admin/statistiques`), and §81's completion criterion — the dashboard
answers the main operational questions defined in
`06-ADMIN-SPEC.md` — is met by the two pages together.

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

**Met (Gate 14G):** the checklist in `docs/09-SECURITY.md` §79 has no
known critical gap — every item Phase 14 was responsible for verifying
is checked with evidence; every remaining open item is explicit Phase
15/legal/operational scope, not a critical gap.

---

## Phase 14 Gate 14A — full security & resilience audit (verified complete)

A full read-only audit against every requirement area named in this
phase — authentication, authorization/IDOR, validation, price/order
integrity, payment security, offline settlement, CSRF, XSS/content-
injection, redirects, security headers, secrets, logging/PII, CSV, PDF,
email, uploads, dependencies, error handling/resilience, DB concurrency,
data retention, monitoring, CI — found **no CRITICAL findings and
exactly one HIGH finding**: no rate limiting on public checkout/
payment-initiation. Two MEDIUM findings (security headers/CSP absent;
fulfilment-transition concurrency has no DB-level backstop). See
`docs/09-SECURITY.md` for the full requirements matrix and prioritized
findings. Approved direction: Gate 14B (rate limiting) → 14C (headers/
CSP) → 14D (fulfilment concurrency) → 14E (formal abuse tests) → 14F
(CI) → 14G (checklist/docs, Phase 14 completion). MFA deferred for V1;
monitoring/error tracking deferred to Phase 15.

## Phase 14 Gate 14B — checkout/payment rate limiting (verified complete)

Closes the Gate 14A HIGH finding. PostgreSQL-backed fixed-window
limiter, three independent buckets (order creation 8/10min, online-
payment initialization 5/10min, non-terminal status polling 25/1min),
opaque `HMAC-SHA-256` identity (never the raw IP), dedicated
`RATE_LIMIT_SECRET`. Client-IP trust model verified against Vercel's own
current official documentation before implementation (prefers
`x-vercel-forwarded-for`, falls back to `x-forwarded-for` — both
Vercel-overwritten, not attacker-spoofable on this project's deployment
shape). No secondary per-recipient-email bucket (would itself be
weaponizable against a real customer) — explicitly not a defence
against a distributed many-IP attack, documented as a platform/CDN-level
concern. The existing checkout idempotency mechanism remains the sole
correctness boundary for "only one Order is ever created" — the limiter
only decides whether a genuinely new idempotency key gets to try at all.

New: `src/domain/rate-limit/rate-limit-identity.ts`,
`src/infrastructure/rate-limit/{rate-limit,policies,current-identity}.ts`,
`src/lib/rate-limit-client-ip.ts`, one additive migration
(`checkout_rate_limits`). Modified: `src/app/commande/actions.ts`,
`src/app/commande/retour/actions.ts`, `src/app/commande/checkout-form.tsx`,
`src/lib/env.ts`, `.env.example`, `src/infrastructure/orders/
create-order.ts` (new `orderExistsForIdempotencyKey()` pre-check),
`playwright.config.ts` (fixed test-only `RATE_LIMIT_SECRET`). See
`docs/05-ARCHITECTURE.md` for the full architecture.

## Phase 14 Gate 14C — HTTP security headers/CSP (verified complete)

Closes the Gate 14A MEDIUM finding (security headers/CSP absent) and
resolves TBD-SEC-004. Static CSP via `next.config.ts`'s `headers()`
(no nonces — approved direction; the app has no browser-rendered
`dangerouslySetInnerHTML`, no third-party analytics, self-hosted fonts,
same-origin auth traffic, and a Saferpay Payment Page that's a
top-level redirect, never an iframe). Adopted policy: `default-src
'self'; script-src 'self' 'unsafe-inline'` (+ `'unsafe-eval'` in
development only); `style-src 'self' 'unsafe-inline'; img-src 'self'
data: blob:; font-src 'self'; connect-src 'self'; object-src 'none';
base-uri 'self'; form-action 'self'; frame-ancestors 'none'` — plus
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy: camera=(), microphone=(), geolocation=()`.
`Strict-Transport-Security` deliberately not set — Vercel already
applies HSTS and forces HTTPS on custom domains (verified against
current official Vercel documentation).

Accepted, honestly-documented limitation: `'unsafe-inline'` is weaker
than a nonce/hash-based strict CSP against inline-script XSS; nonces
were rejected because they'd force every page to dynamic rendering,
removing this app's existing static optimization for no demonstrated
V1 threat. `img-src` stays same-origin-only pending TBD-ARCH-006
(image storage provider, still unresolved) — a pre-existing,
untested gap was found where the admin image-URL forms validate an
absolute `http(s)://` URL but `next.config.ts` has no
`images.remotePatterns`, so `next/image` already rejects any such URL
today regardless of this CSP; not fixed here, flagged for separate
attention.

New: `src/lib/security-headers.ts` (pure, unit-tested policy).
Modified: `next.config.ts` (`headers()` wiring). New tests:
`src/lib/security-headers.test.ts` (17 unit tests), `e2e/security-
headers.spec.ts` (7 E2E tests, public + admin routes, no DB state).
Verified via a real browser across public catalogue, cart, checkout,
design-system interactive primitives, and admin routes — zero CSP
console violations. See `docs/05-ARCHITECTURE.md` and
`docs/09-SECURITY.md` §50/§51/§52 for the full architecture and
rationale.

## Phase 14 Gate 14D — fulfilment concurrency (verified complete)

Closes the Gate 14A MEDIUM finding ("fulfilment-transition concurrency
has no DB-level backstop, only domain-code guards"). Every fulfilment
transition (`markOrderPrepared`/`handOrderToSeller`/`markOrderDelivered`
and their bulk equivalents) and `cancelOrder` — a direct competing
writer on the same `orders.status` column — now use a conditional
atomic `UPDATE ... WHERE id = ? AND status = <exact expected source>
RETURNING ...` as the authoritative concurrency boundary, in the same
transaction as the pre-existing initial `SELECT` + domain-guard
validation (which remains business validation only, not the
concurrency guarantee). A lost race throws a new typed
`FulfilmentConflictError` before any event is written; a losing
attempt may also legitimately surface the pre-existing
`InvalidFulfilmentTransitionError` instead, depending on whether its
own initial read happened before or after the winner committed — both
are truthful rejections (docs/02-BUSINESS-RULES.md BR-STA-009). Bulk
transitions remain one bounded, single-statement `UPDATE`, never a
per-row loop; any mismatch between the validated selection and the
conditional UPDATE's returned rows rolls back the entire batch.

No `SELECT ... FOR UPDATE`, no version column, no `SERIALIZABLE`
isolation, no retry loop, no migration, no new dependency.

New: `src/infrastructure/database/integration/
fulfilment-concurrency.db.test.ts` (5 tests, genuinely independent
real-committed transactions — `withRollback` cannot represent this
class of race). Modified: `src/infrastructure/fulfilment/fulfilment.ts`,
`src/infrastructure/orders/orders.ts` (new `FulfilmentConflictError`),
`src/app/admin/(protected)/commandes/[id]/actions.ts` (the three
single-order fulfilment actions gained typed `{ formError }` results —
previously unhandled), `src/app/admin/(protected)/commandes/[id]/
fulfilment-section.tsx` (client component, `useActionState`),
`src/app/admin/(protected)/preparation/actions.ts` (bulk actions' catch
lists extended). New E2E coverage in `e2e/preparation-fulfilment.spec.ts`
proving the stale-state UX no longer crashes unhandled; the true
concurrency invariant is proven exclusively at the DB/integration
level. See `docs/05-ARCHITECTURE.md` and `docs/09-SECURITY.md` (near
§70) for the full architecture.

## Phase 14 Gate 14E — formal abuse-test verification (verified complete)

Not tied to a remaining Gate 14A finding — all three (HIGH rate
limiting, MEDIUM headers/CSP, MEDIUM fulfilment concurrency) were
already closed by Gates 14B/14C/14D. Gate 14E instead formalizes the
abuse scenarios named in `docs/09-SECURITY.md` §80 and this document's
own §84 against actual executable evidence, in a new formal matrix
(`docs/09-SECURITY.md`, after §80) mapping each documented abuse case
to its control and evidence — 30 rows total: 25 `VERIFIED`, 2
`VERIFIED — code audit` (admin Server Action authorization — a single
centralized `requireAdmin()` boundary, proven by code audit + the
shared resolver's own DB test, deliberately not a fragile raw
Server-Action-wire-protocol test; and XSS/delivery-note handling —
React's default JSX escaping is a framework guarantee, backed by the
email-HTML-escaping function's own exhaustive unit tests and the CSP
layer as defense-in-depth), and 3 `NOT APPLICABLE` (open redirect — no
dynamic redirect surface exists; image upload — no file-upload feature
exists in V1; session expiration — delegated entirely to Better Auth).

Architecture: Option B (domain-specific test additions, no dedicated
abuse/security test file — see `docs/05-ARCHITECTURE.md`). Of the full
scenario list, only three genuine executable gaps were found and
closed: `create-order.db.test.ts` (campaign closure between checkout
page load and submission), `order-input-schema.test.ts` (quantity-999
boundary-acceptance case), `order-admin.db.test.ts` (a PAID order's
monetary fields proven untouched by the ordinary edit path, using a
real order in the PAID state). Gate 14B/14C/14D's own suites, and the
pre-existing checkout/payment/export/document/email/settlement suites,
are referenced as evidence, never recreated.

No production code was changed. No migration, no new dependency.

## Phase 14 Gate 14F — CI (verified complete)

One sequential `quality` job (`.github/workflows/ci.yml`) reproduces the
existing local quality gate on GitHub Actions: install (frozen
lockfile) → format check → lint → generate Next.js types → typecheck →
unit tests → PostgreSQL 18 service → migrate → seed → DB integration
tests → Playwright Chromium install → E2E tests → (upload
`playwright-report/`/`test-results/` only on failure) → build. One
disposable PostgreSQL service is shared sequentially by migrations,
seed, DB tests, and E2E — never reset in between, matching this
project's own established local development/test architecture (the
same database DB tests just seeded is the one E2E runs against).
Chosen over a multi-job architecture because the DB/E2E suites already
run non-parallel (`fileParallelism: false`, `workers: 1`) for
shared-state-safety reasons specific to this codebase's own history.

Triggers: `pull_request`, `push` to `main`, `workflow_dispatch`.
Permissions: `contents: read` only. Concurrency cancels obsolete runs
on the same ref (`cancel-in-progress: true`, grouped by
`github.ref` — different branches/PRs never cancel each other). Job
timeout: 30 minutes. Node 22 is the CI reference runtime; pnpm is not
pinned a second time — both come from `pnpm/setup`'s
`runtime: node@22` plus the version already declared in
`package.json`'s `packageManager` field. `pnpm/setup` is used instead
of the previously-proposed `pnpm/action-setup` + `actions/setup-node`
pair — a genuine Step 2 discovery: `pnpm/action-setup`'s own current
documentation states it "remains the action to use for installing
pnpm v10 and older," and this repository pins pnpm 12.

**Zero GitHub repository secrets** — every CI environment value is a
fixed, already-documented-as-non-secret synthetic value (matching
`compose.yaml`/`.env.example`'s own local-development convention).
Saferpay/Resend credentials are never provided; the E2E suite's
existing fake-provider flags mean no CI run ever contacts a real
provider. See `docs/05-ARCHITECTURE.md` §48 and `docs/09-SECURITY.md`
§56 for the full architecture and security rationale.

Local verification (initial implementation): format/lint/typecheck/
unit/DB/E2E/build all pass, exactly matching the pre-existing baseline
(0 new lint warnings, no test-count regression). Workflow YAML
structurally validated (parses correctly, passes the project's own
Prettier check). Playwright retry/trace behavior deliberately left
unchanged (Step 1 found `trace: "on-first-retry"` currently never
fires locally since retries default to 0 — not addressed
pre-emptively).

**Remote verification, real GitHub Actions runs**: the first run on
the initial commit (`f5f99f1e30c1b1c5e237abc7e9e8653b2e4cac2d`, run
`36702768094`) failed at the typecheck step. Root cause: this
application's `src/app/layout.tsx` and
`src/app/admin/(protected)/layout.tsx` use the Next.js-generated
`LayoutProps` type helper, produced only as a side effect of a prior
`next build`/`next dev`; `tsconfig.json`'s own `include` list depends
on it. A fresh CI checkout has never run either, so the types did not
exist — a condition local development never hit, since `.next/`
had always already existed there. This was reproduced locally by
temporarily removing `.next/` and confirming the identical failure.
The deterministic fix — a dedicated `next typegen` step immediately
before `typecheck` — was added in a separate corrective commit
(`06eb8ccf959a378b9faa6410f028c2a81bd44b8b`), verified locally from a
genuinely absent `.next/` state first, then confirmed by a second real
GitHub Actions run (`36740067466`), which **succeeded end-to-end**:
format check, lint, type generation, typecheck, unit tests, Postgres
migrate/seed, DB integration tests, Chromium install, E2E tests, and
build all passed on a standard GitHub-hosted runner. No application or
test behavior was changed by either commit; no new dependency; no
migration; zero GitHub repository secrets were needed at any point.

**Gate 14F is COMPLETE.**

## Phase 14 Gate 14G — checklist/docs and Phase 14 completion (COMPLETE)

Final read-only traceability audit (Step 1) confirmed: all three Gate
14A findings (1 HIGH, 2 MEDIUM) traceably closed with implementation
and executable evidence; the Gate 14E formal abuse matrix has 30 total
rows with 0 unresolved (25 `VERIFIED`, 2 `VERIFIED — code audit`, 3
`NOT APPLICABLE`), all 24 referenced test files confirmed to still
exist; Gate 14F's CI verification (run `36740067466`) remains intact;
no application/test/schema/security code changed between the Gate 14E
checkpoint (`3206c2b7009d33ec8e889f321388e81dd6c9e4bb`) and Gate 14G,
so no abuse evidence needed revisiting. The audit found Gate 14G to be
documentation/checklist closure only — no production code, test,
workflow, migration, or dependency change required.

Step 2 synchronized `docs/09-SECURITY.md` §79's production launch
security checklist: 7 items (admin authorization; payment amount
mismatch; price manipulation; marking payment paid; settlement
duplication; CSV export authorization; CSV formula injection) were
checked off with concise evidence citations into the existing Gate 14E
abuse matrix, reflecting verification Phase 14 had already performed
but the checklist had not yet recorded. The file-upload item was
recorded as an explicit **N/A** (no upload feature exists in V1,
ABUSE-MISC-002) rather than a checkmark, so it cannot be misread as a
tested validation path. Every remaining checklist item that Phase 14
did not verify — HTTPS, production secrets/backups, individual
production admin accounts, production Worldline/Saferpay callback
registration, email-domain authentication, dependency review, restore
procedure, privacy/legal pages, error-page/log-PII review — was left
open, as genuine Phase 15/legal/operational scope, not Phase 14
documentation staleness. A closure checklist was added directly below
the Gate 14E matrix in `docs/09-SECURITY.md`. All residual/future TBDs
(`TBD-SEC-002` MFA, `TBD-SEC-005` data retention, `TBD-SEC-006`
privacy/legal docs, `TBD-SEC-007` backup provider, `TBD-ARCH-006`
image storage, `TBD-ARCH-008` monitoring) were preserved exactly as
open — none were closed merely because Phase 14 is ending.

No production code, test, workflow, migration, or dependency changed.

**Gate 14G is COMPLETE.**

**Phase 14 — Security and resilience hardening: COMPLETE.** Rate
limiting, security headers/CSP, and fulfilment-transition concurrency
were hardened and verified; the formal abuse-case matrix was fully
resolved; CI reproducibility was verified on a real GitHub-hosted
runner; no unresolved Phase 14 security blocker remains. This marks
Phase 14 hardening complete, not production readiness — production
deployment, DNS/HTTPS, production credentials, backups, and
operational readiness remain Phase 15 scope.

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

## Phase 15 Gate 15A — repository production-config readiness (verified complete)

Repository-local readiness review before any external infrastructure
action (Neon/Vercel/DNS/Resend/Worldline), per the approved Phase 15
audit. `.env.example` was reconciled against the full `src/lib/env.ts`
schema and found already complete and accurate — no change needed.
Node runtime: `package.json`'s `"node": ">=20.9.0"` stays an unpinned
floor; no `.nvmrc`/`.node-version`/`vercel.json` added — Node 22 will
be selected manually in Vercel's project settings during Gate 15C,
matching CI's own pin. Migration path (`drizzle-kit migrate` against
`DATABASE_URL_UNPOOLED`, never chained to seed) and admin bootstrap
(`pnpm bootstrap:admin`, interactive-only, public signup hard-disabled)
were both re-confirmed ready for Gates 15B/15E with no change needed.

**Payment fake-provider production-safety**: added
`src/infrastructure/payments/online-payments.test.ts`, proving the
exported `isOnlinePaymentAvailable()` — which shares the textually
identical `NODE_ENV !== "production" && E2E_FAKE_PAYMENT_PROVIDER === "true"`
guard as the private `getProvider()` — cannot report the fake provider
as available when `NODE_ENV=production`, even with the opt-in set and
all real `SAFERPAY_*` variables cleared first (since `serverEnv` is a
module-load-time singleton). This executes the exported availability
guard; the private provider-selection path shares the same guard by
direct code inspection, not by this test. A single inert
`vi.mock("../database/client", () => ({ db: {} }))` neutralizes
`online-payments.ts`'s unrelated eager `db` import (a value import,
unlike `order-confirmation.ts`'s type-only one) so the module can load
in a DB-less unit-test process — never dereferenced by the function
under test.

**Dependency audit**: `pnpm audit` found 11 findings, including one
**CRITICAL** direct-runtime finding — RCE in `next/og`'s
`ImageResponse` (GHSA-vcvr-r3jv-pc5j), affecting the then-installed
`next@16.3.5`. `ImageResponse`/`next/og` is not used anywhere in this
application's own code, but `next` is a direct runtime dependency, so
this was treated as blocking per the gate's own stop condition.
**Remediation**: upgraded `next` to `16.3.8` (the current Active-LTS
security release at the time, beyond the `16.3.6` minimum fix) via a
single targeted `pnpm add next@16.3.8` — `package.json`/`pnpm-lock.yaml`
changed only for `next` itself (all platform `@next/swc-*` binaries,
`@next/env`) and `better-auth`'s peer-resolution key updating to
reference the new `next` version (not a `better-auth` version change).
Re-running the audit confirmed the CRITICAL finding fully resolved,
with no new finding introduced by the upgrade. The remaining 10
findings (4 HIGH, 6 moderate — all `brace-expansion`/`esbuild`/
`fast-uri`/`ip-address`) are confirmed, via `pnpm why`, to be entirely
devDependency/build-tooling (eslint/minimatch lint chains, `drizzle-kit`'s
dev-only esbuild loader, the `shadcn` CLI's own toolchain) — never
present in the production runtime bundle. Documented here as an
accepted, non-blocking residual finding, not hidden.

Full validation after the upgrade: `next typegen` regenerated (new
Next.js version), `format:check`/`lint` (0 errors, the same 6
pre-existing warnings)/`typecheck` all clean; unit (68 files, 651
tests), DB (29 files, 309 tests), and E2E (96 tests, 1 isolated
environmental flake — `net::ERR_NETWORK_IO_SUSPENDED`, reproduced as
passing deterministically when re-run in isolation, not a Next.js
regression) all green; `pnpm build` clean, identical route structure.
No application/business/test behavior changed by the upgrade itself —
one new test file only.

No external service was accessed. No production infrastructure was
created.

**Gate 15A is now fully verified.** A fresh GitHub Actions run against
the exact commit carrying this Next.js upgrade
(`a6e7a3b6bf8b0ab6b914a7d539447853a1e2a534`) completed successfully —
run `37055659995` (#5), commit SHA matched exactly, every step green:
format, lint, type generation, typecheck, unit tests, migrations,
seed, DB integration tests, Chromium install, E2E tests, and build.
This supersedes the prior Gate 14F run (`36740067466`), which predated
the Next.js upgrade and could not evidence it.

**Gate 15A is COMPLETE** — implementation, local validation, remote CI
verification, and final verification all complete.

**Phase 15 is IN PROGRESS.** Gate 15A is complete; Gate 15B
(production database / Neon provisioning) is complete — see below.
Gate 15C (Vercel production deployment) is in progress.

---

## Phase 15 Gate 15B — production database / Neon provisioning (COMPLETE)

Step 1 (repository inspection) found no implementation change required
for provisioning itself. The Gate 10C-B2 staging Neon project
(`05-ARCHITECTURE.md` §11) still exists, was not touched, and must not
be reused as production.

**Production database.** A separate Neon project,
`melodia-wine-shop-production`, was provisioned manually by the project
owner: branch `production` (default), region AWS Europe Central 1
(Frankfurt), PostgreSQL 18, database `neondb`, role `neondb_owner`.
Connection strings were never pasted in chat, written to `.env.local`,
or committed: the direct connection string was entered through a
hidden PowerShell prompt into a single process environment and cleared
afterwards (`drizzle-kit`'s own `.env.local` loading does not override
an already-set variable, so the local development value was not used).

Verification used a read-only check script outside the repository that
printed only non-secret facts. Before migration it confirmed: a
non-local Neon host, the direct (non-`-pooler`) endpoint, region
`eu-central-1`, `sslmode=require`, the expected database/role/major
version, TLS active (TLSv1.3), and no tables in any user schema — which
also ruled out the staging project. A first attempt was stopped by
this check because the pooled string had been supplied; nothing ran
against the database until the direct endpoint passed.

`pnpm db:migrate` then applied the 7 committed migrations
(`0000_fuzzy_masked_marvel` → `0006_medical_elektra`) successfully. The
post-migration check confirmed `drizzle.__drizzle_migrations` holds 7
rows matching the committed journal, exactly the 24 expected `public`
tables with no other user schemas, and **0 rows across every `public`
table** — no development/demo data. `pnpm db:seed` was not run against
production. No migration, schema, or application code changed.

**Recovery capability (current).** Neon Free plan: point-in-time
restore with 6-hour history retention, plus manual snapshots;
scheduled snapshots are not available on this plan. This is acceptable
for provisioning and pre-launch testing, but **the production
backup/restore policy remains an open launch requirement**
(`09-SECURITY.md` §72/§73, TBD-SEC-007): it must be resolved before
real customer orders are accepted. 6-hour PITR does not close it.

Noted for later: `pg` prints a deprecation warning that
`sslmode=require` is currently treated as `verify-full` and will adopt
weaker libpq semantics in `pg` v9 — revisit the connection-string
`sslmode` when upgrading `pg`.

**Safety prerequisite — development seed hardening (complete — commit
`15c54c1`, CI run `37157716404`).** The seed script previously refused only when
`NODE_ENV === "production"`, a check that ran after the database client
had already been imported. `pnpm db:seed` runs through `tsx` from a
local shell where `NODE_ENV` is normally unset, so a shell whose
database URL accidentally pointed at a real database would have been
seeded with fictional demo data. Inspection also established that the
seed writes through `./client`, i.e. the pooled `DATABASE_URL` with the
`DATABASE_DRIVER`-selected driver — not `DATABASE_URL_UNPOOLED` as
`.env.example`/`env.ts` comments previously stated (corrected).

Seeding is now forbidden unless explicitly authorized
(`src/infrastructure/database/seed-guard.ts`), evaluated before the
database client or schema is imported:

- `NODE_ENV=production` → always refused (kept as defense in depth);
- `ALLOW_DATABASE_SEED=true` absent from the invoking shell → refused;
- the value is captured before `.env.local` is loaded, so an
  authorization stored in `.env.local` is ignored (and the refusal says
  so) — it can never silently apply to a later run whose URL changed;
- any value other than exactly `true` → refused.

Local usage: `ALLOW_DATABASE_SEED=true pnpm db:seed`. CI sets the
variable on its "Seed database" step only. Neither Playwright nor any
test invokes the seed. Target-hostname inspection was considered and
rejected as the primary safeguard: it needs hard-coded provider
identifiers and cannot distinguish the staging Neon project from the
production one. `seed-guard.test.ts` covers the decision function and
runs the real `seed.ts` entry point in a child process (throwaway
working directory, unreachable database URL, an invalid
`DATABASE_DRIVER` tripwire proving refusal happens before the client
module loads) — no test connects to any database.

---

## Phase 15 Gate 15C — Vercel production deployment (COMPLETE)

**15C-A — readiness inspection (complete).** Read-only review found no
application or security change required for a first deployment on the
generated `*.vercel.app` domain: with an empty production database no
campaign is active, so nothing is orderable, and `/admin` is reachable
only through login (sign-up disabled, no admin yet). The only
repository change identified was the Node runtime pin below.

**15C-B — production runtime pin (COMPLETE).**
`package.json` `engines.node` is now `22.x` (major only), superseding
the Gate 15A decision to keep `>=20.9.0` and select Node 22 in Vercel's
project settings. Current Vercel documentation states that
`engines.node` overrides the project-settings Node version and that an
open range resolves to the latest available major — so `>=20.9.0`
could have deployed on Node 24. Node 22 is the validated runtime for
the application's `fr-CH` CHF formatting: Node 22.23.3 produces the
expected `10'000`, whereas Node 24.15.0 produced a different grouping
separator in the existing CHF tests. CI already runs Node 22.

pnpm stays pinned as `pnpm@12.4.2` through `packageManager`; the
lockfile is unchanged. Because Vercel's automatic lockfile detection
does not cover pnpm 12, `ENABLE_EXPERIMENTAL_COREPACK=1` will be set as
a Vercel project environment variable during provisioning so Vercel
uses `packageManager`. No custom install command and no `vercel.json`
are needed.

**15C-C — first production deployment (COMPLETE).** The project owner
created the Vercel project (`melodia-wine-shop`, Production
environment, production branch `main`, framework Next.js, root
directory `./`), connected it to this GitHub repository, and set
`ENABLE_EXPERIMENTAL_COREPACK=1` plus the production environment
variables (`DATABASE_URL`, `DATABASE_DRIVER`, `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL`, `RATE_LIMIT_SECRET`, `APP_BASE_URL`) — names only
recorded here, values never pasted anywhere in this repository or in
chat. `DATABASE_URL` is the production Neon **pooled** connection
string (`melodia-wine-shop-production`, Gate 15B); `DATABASE_DRIVER` is
`neon`. `BETTER_AUTH_URL`/`APP_BASE_URL` are temporarily set to the
Vercel-assigned origin below, pending the final domain.
`DATABASE_URL_UNPOOLED`, `ALLOW_DATABASE_SEED`,
`E2E_FAKE_PAYMENT_PROVIDER`, and `E2E_FAKE_EMAIL_PROVIDER` are
deliberately **not** configured in Vercel — migrations and the
development seed are never run through the deployed app, and the fake
providers must never exist outside CI/Playwright. `NODE_ENV` is
Vercel-managed, not set manually. Saferpay and Resend production
credentials are intentionally not part of this deployment stage.

Commit `48e68c8481c2314673c548a0285f2c39687f8f7e` ("chore: pin Node 22
runtime") built and deployed successfully: Next.js 16.3.8, pnpm 12.4.2
activated via Corepack (`engines.node: "22.x"` respected), TypeScript
compilation, static generation, and deployment all succeeded.

The initial deployment surfaced a Better Auth warning that the
configured `BETTER_AUTH_SECRET` was not accepted as sufficiently
strong for production. The secret was rotated (never pasted here); the
redeployment completed with no secret-length or low-entropy warning.

**Production smoke test** (read-only, against the temporary Vercel
origin below — see §9 "Deferred" for the final-domain cutover):

| Check | Request | Result | Status |
|---|---|---|---|
| Public homepage | `GET /` | `200`, renders "La vente de vins n'est actuellement pas ouverte." (no active campaign — expected) | PASS |
| Checkout protection | `HEAD /commande` | `307` → `/` (no active campaign) | PASS |
| Admin auth boundary | `/admin` | redirects to `/admin/connexion?from=%2Fadmin` (no admin bootstrapped yet) | PASS |
| Fake Saferpay isolation | `GET /test/fake-saferpay` | `404` (the route can appear in the build's route manifest; the production runtime refuses it regardless) | PASS |
| Security headers | `GET /` | CSP (`object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`), `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` all present | PASS |

This is a deployment smoke/security-header verification, not a
penetration test or a complete production security audit.

**Production Neon verification** (read-only, via Neon's SQL Editor,
post-deployment): `melodia-wine-shop-production`, branch `production`,
database `neondb`, region AWS Europe Central 1 (Frankfurt), PostgreSQL
18 — the same project Gate 15B provisioned, confirmed not re-migrated
or reseeded. Business row counts: `campaigns` 0, `products` 0,
`sellers` 0, `orders` 0, `order_items` 0 — no demo data, no real
customer data. No migration or seed was run as part of this gate.

**Current production exposure state**: the application is reachable at
`https://melodia-wine-shop.vercel.app` (temporary Vercel-assigned
origin, **not** the final public domain) with no active campaign, no
orderable checkout, no production admin account, no Saferpay/Resend
production configuration, and zero business data. This is a controlled
production infrastructure deployment, **not** the public launch of the
wine sale — no campaign was or should be activated.

Repository changes required for this gate: **NONE** — Gate 15C-A/15C-B
already made the repository fully deployment-ready; 15C-C was entirely
external Vercel/Neon verification.

**Remaining before public launch** (not exhaustive — see each
referenced item's own section for authoritative scope): final domain/
DNS for `vins.ecmelodia.ch` and the corresponding `BETTER_AUTH_URL`/
`APP_BASE_URL` cutover (§87); production admin bootstrap via
`pnpm bootstrap:admin` (§89); Resend production activation/
verification; Saferpay LIVE configuration (gated on `TBD-PAY-001`,
`08-PAYMENTS.md`); **`TBD-SEC-007` backup/restore policy — still
OPEN, not resolved by this gate** (Neon Free-plan 6-hour PITR only, no
scheduled snapshots — see Gate 15B above); final production content
review; campaign creation and activation.

## Phase 15 Gate 15D — final domain cutover (COMPLETE)

**Final / authoritative production origin:** `https://vins.ecmelodia.ch`.
**Vercel-generated deployment/project origin:** `https://melodia-wine-shop.vercel.app`
— still reachable (not removed, no redirect configured or claimed), but no
longer the authoritative application origin.

**15D-A — preflight (complete).** Read-only inspection established: the
application derives every authoritative absolute URL from exactly two
server-only environment variables, never from `VERCEL_URL`,
`VERCEL_PROJECT_PRODUCTION_URL`, any `NEXT_PUBLIC_*` variable, or
request `Host`/`X-Forwarded-Host` headers. `BETTER_AUTH_URL` is
Better Auth's `baseURL` and its sole `trustedOrigins` entry
(`src/infrastructure/auth/config.ts`), read once at module load.
`APP_BASE_URL` builds Saferpay's `ReturnUrl`
(`/commande/retour?rt=...`) and `NotifyUrl`
(`/api/payments/saferpay/notify/...`) via `src/lib/app-url.ts`'s
`appUrl()`, read at runtime on each online-payment initialization.
Security headers/CSP are same-origin (`'self'`) rules, unaffected by
which domain serves the app. **No application code change was
required for the domain cutover.**

This step also found and resolved a repository documentation
contradiction on DNS authority: `README.md` previously stated
Infomaniak handled DNS for `vins.ecmelodia.ch`, while
`docs/09-SECURITY.md`'s Gate 11A record documented the authoritative
zone as Wix. External verification confirmed:

**Authoritative DNS provider: Wix.** Nameservers for `ecmelodia.ch`:
`ns10.wixdns.net`, `ns11.wixdns.net`. `README.md` has been corrected
accordingly. Infomaniak's role, where documented elsewhere, remains
limited to existing mail infrastructure — not DNS hosting — and that
distinction is unchanged by this gate.

**15D-B — Vercel domain attachment + DNS record (complete).**
`vins.ecmelodia.ch` was added to the existing `melodia-wine-shop`
Vercel project (Production environment). Vercel requested exactly one
record:

    CNAME  vins  ->  50b80014429e32ac.vercel-dns-017.com.

That single record was added to the authoritative Wix DNS zone — no
root-domain record, `www` record, MX record, or existing
Resend-related DNS record was changed; no nameserver migration was
performed. Public resolution confirmed propagation
(`dig CNAME vins.ecmelodia.ch +short` → the value above); Vercel
reported `vins.ecmelodia.ch` as a valid configuration in Production.
The existing ECM Wix website remained unaffected throughout.

**15D-C — final-origin environment cutover + redeployment (complete).**
Once the domain was DNS-valid and HTTPS-reachable, exactly two
Production environment variables were changed in Vercel:

    BETTER_AUTH_URL=https://vins.ecmelodia.ch
    APP_BASE_URL=https://vins.ecmelodia.ch

(no trailing slash, Production scope only). `DATABASE_URL`,
`DATABASE_DRIVER`, `BETTER_AUTH_SECRET`, `RATE_LIMIT_SECRET`, and
`ENABLE_EXPERIMENTAL_COREPACK` were not touched.
`DATABASE_URL_UNPOOLED`, `ALLOW_DATABASE_SEED`,
`E2E_FAKE_PAYMENT_PROVIDER`, `E2E_FAKE_EMAIL_PROVIDER` remain
intentionally absent from Vercel; `NODE_ENV` remains Vercel-managed.

A clean production redeployment (no build cache) was triggered from
`main` at commit `e3cac2d`: pnpm 12.4.2 activated via
`ENABLE_EXPERIMENTAL_COREPACK`, lockfile verified (979 entries, up to
date), Next.js 16.3.8 build compiled successfully, TypeScript checked
successfully, static generation completed for all 27 pages, deployment
completed — no Better Auth secret warning, no configuration error, no
missing-`BETTER_AUTH_URL` error, no missing-database error. No
migration and no seed ran as part of this redeployment. (Repository
pin: `engines.node = "22.x"`; exact Vercel-runtime Node patch version
not independently recorded here.)

Minimal post-cutover runtime verification against the final domain:
homepage (`200`), `/admin` (`307` → `/admin/connexion?from=%2Fadmin`,
auth boundary intact), `/commande` (`307` → `/`, no active campaign).
No admin was created, no campaign was created or activated, no order
was created.

**15D-D — final-domain smoke/security verification (complete).**
Repeated against `https://vins.ecmelodia.ch`:

| Check | Result | Status |
|---|---|---|
| DNS (`dig CNAME`) | resolves to the Vercel target above | PASS |
| Homepage / TLS | `200`, valid TLS | PASS |
| Admin auth boundary | `307` → `/admin/connexion?from=%2Fadmin` | PASS |
| Checkout protection | `307` → `/` (no active campaign) | PASS |
| Fake Saferpay isolation | `404` (route may exist in the build manifest; production refuses it regardless) | PASS |
| Security headers | CSP (`object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, same policy as the temporary origin), `Permissions-Policy`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` all present | PASS |

This is a deployment smoke/security-header verification, not a
penetration test or a complete production security audit.

**Better Auth final state.** `https://vins.ecmelodia.ch` is now the
sole Better Auth `baseURL`/`trustedOrigins` entry. The implementation
was not changed to trust both domains. No production admin existed
before or during the cutover, so there was no admin-session migration
concern.

**Saferpay final-domain behavior.** Future `initiateOnlinePayment()`
calls will construct `ReturnUrl`/`NotifyUrl` under
`https://vins.ecmelodia.ch`. **Saferpay LIVE remains unconfigured** —
no real LIVE callback has been tested, and Saferpay production
readiness is not claimed. Any Saferpay Backoffice requirement to
separately register callback/domain URLs remains subject to
verification during the later Saferpay LIVE gate (`TBD-PAY-001`).

**Resend/`EMAIL_FROM`.** The domain cutover required no Resend DNS
change — Resend's verified domain is the root `ecmelodia.ch`, already
configured in the same authoritative Wix DNS zone, unaffected by the
`vins` subdomain record added in 15D-B. The `.env.example` /
`docs/09-SECURITY.md` sender-address inconsistency identified in
15D-A is **resolved from authoritative repository evidence**:
`docs/09-SECURITY.md` §61 records `vins@ecmelodia.ch` as the actual
address verified and smoke-tested in Resend during Gate 11A;
`.env.example`'s previous `commandes@vins.ecmelodia.ch` was an
illustrative example that had never been verified. `.env.example` has
been corrected to match. **No production `EMAIL_FROM`/Resend
configuration was changed** — Resend production activation remains
future work, unaffected by this documentation correction.

Repository changes required for Gate 15D: a documentation-only
correction (`README.md`'s stale DNS-provider claim, `.env.example`'s
sender-address example) — **no application code changed**.

**Gate 15D is COMPLETE. This is not a public-launch declaration.**
No campaign exists or was activated; no production admin was
bootstrapped; Saferpay LIVE is not configured; Resend production
activation/validation remains outstanding; final production content
review remains outstanding; campaign configuration and activation
remain outstanding — activation is effectively the public-sale launch
switch. **`TBD-SEC-007` (backup/restore policy) remains OPEN** — Neon
Free-plan 6-hour PITR only, no scheduled snapshots (Gate 15B); the
domain cutover does not resolve, close, or downgrade this requirement.

## Phase 15 Gate 15E — production admin bootstrap (ready to close)

**15E-A — preflight (complete).** Repository inspection confirmed
`pnpm bootstrap:admin` (`src/infrastructure/auth/bootstrap-admin.ts` +
`bootstrap-admin-core.ts`) collects email/name/password interactively
(masked, confirmed-twice password prompt), never as a CLI argument,
never logged or persisted in plaintext, with hashing delegated entirely
to Better Auth. It uses the application's standard `DATABASE_URL`
(pooled) via the normal `db` client — **not** `DATABASE_URL_UNPOOLED`,
which only migrations use. It refuses a duplicate administrator for an
existing email, and can recover an orphaned auth identity from the
documented interrupted-run scenario (both proven by real DB
integration tests, not just asserted). The authorization model has no
role hierarchy in V1 — an active `admin_users` row linked to its auth
identity is the sole authorization record. The permissive Better Auth
instance the bootstrap script builds exists only inside that
standalone process; `bootstrap-isolation.test.ts` proves by source
inspection that the deployed HTTP auth route never imports it and that
public signup stays hard-disabled in the real deployed instance. No
repository change was required.

**15E-B — production database precheck (complete).** Verified directly
via the Neon SQL Editor before any mutation: database `neondb`, role
`neondb_owner`, PostgreSQL 18.6, the expected 24 `public` tables
present. All admin/auth/business-data row counts were `0`
(`admin_users`, `auth_users`, `auth_accounts`, `auth_sessions`,
`auth_verifications`, `campaigns`, `campaign_products`,
`campaign_sellers`, `campaign_events`, `products`, `sellers`,
`bundles`, `bundle_items`, `orders`, `order_items`,
`order_bundle_components`, `order_events`, `payments`,
`payment_events`, `seller_settlements`, `seller_settlement_orders`) —
no administrator, no Better Auth identity, no business data, and
therefore **no temporary development administrator to remove** (none
has ever existed — no seed or migration path creates one). No
mutation occurred during this precheck.

**15E-C — production administrator bootstrap (complete).** Executed
manually by the operator (`pnpm bootstrap:admin`), production
connection supplied locally by the operator, never pasted or recorded
here. Administrator created: email `communications@ecmelodia.ch`, name
`communications`. Post-bootstrap Neon SQL Editor verification:
`admin_users = 1`, `auth_users = 1`, `auth_accounts = 1`,
`auth_sessions = 0`; the `admin_users` row has `active = true` and a
populated `auth_user_id`, confirming the administrator is correctly
linked to its Better Auth identity. A real authentication smoke test
at `https://vins.ecmelodia.ch/admin` with the new credentials
succeeded — login successful, admin interface reachable. This is an
authentication/access smoke test, not a penetration test. No password,
hash, session token, or connection string is recorded anywhere in this
repository. Public signup remains disabled in the deployed
application; the bootstrap-only instance remains unreachable via HTTP
(§15E-A).

Repository changes required for Gate 15E: **none** beyond this
documentation record.

**Gate 15E is ready to close. This is not a public-launch
declaration.** Production admin bootstrap is no longer an open item —
production administrator access now exists — but no campaign exists or
was activated; Saferpay LIVE is not configured; Resend production
activation/validation remains outstanding; final production content
review remains outstanding; campaign configuration and activation
remain outstanding (activation is effectively the public-sale launch
switch). **`TBD-SEC-007` (backup/restore policy) remains OPEN**,
unaffected by this gate.

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
    Phase 12  Documents and exports                  COMPLETE
    Phase 13  Statistics and dashboard        COMPLETE
    Phase 14  Security and resilience hardening  COMPLETE (Gate 14A/14B/14C/14D/14E/14F/14G all done)
    Phase 15  Production preparation             IN PROGRESS (Gate 15A/15B/15C/15D done, 15E ready to close — production admin exists, no active campaign, TBD-SEC-007 open — remaining Phase 15 work pending)
    Phase 16+ Not started

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
