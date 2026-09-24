# Melodia Wine Shop — Architecture

> Version: 0.1
> Status: Draft
> Related documents:
> - `01-PRODUCT-SPEC.md`
> - `02-BUSINESS-RULES.md`
> - `03-USER-FLOWS.md`
> - `04-DATA-MODEL.md`

---

# 1. Purpose

This document defines the technical architecture of Melodia Wine Shop.

The architecture must support:

- a public mobile-first wine shop;
- online TWINT and card payments;
- offline seller payments;
- an authenticated administration interface;
- manual order entry;
- campaign management;
- preparation and delivery workflows;
- seller financial reconciliation;
- PDF generation;
- CSV exports;
- transactional emails;
- annual reuse.

The application is expected to handle hundreds or a few thousand orders,
not millions.

The architecture should therefore prioritize:

- correctness;
- maintainability;
- simplicity;
- security;
- operational reliability;

over unnecessary distributed-system complexity.

---

# 2. Architecture principles

## 2.1 One application

V1 should be implemented as one application rather than multiple
independent services.

Conceptually:

    Browser
       │
       ▼
    Next.js application
       │
       ├── Public storefront
       ├── Checkout
       ├── Admin interface
       ├── Server-side business logic
       ├── API / server actions
       └── Webhook endpoints
       │
       ▼
    PostgreSQL

External services:

    Payment provider
    Email provider
    Image/file storage

This is a modular monolith.

---

# 3. Why a modular monolith

The expected scale does not justify microservices.

A modular monolith provides:

- one repository;
- one deployment;
- one database;
- easier local development;
- easier transactions;
- simpler debugging;
- lower operational complexity.

Application modules should still have clear responsibilities.

Possible modules:

    campaign
    catalogue
    cart
    checkout
    orders
    payments
    sellers
    settlements
    fulfilment
    documents
    exports
    admin
    notifications

These are code boundaries, not independent services.

---

# 4. Proposed stack

Current recommended baseline:

    Framework       Next.js
    Language        TypeScript
    UI              React
    Styling         Tailwind CSS
    Components      shadcn/ui where appropriate
    Database        PostgreSQL
    ORM             TBD
    Authentication  TBD
    Hosting         Vercel
    Payments        TBD
    Email           TBD
    File storage    TBD
    PDF             Server-side generation

This stack is intentionally conservative.

---

# 5. Frontend framework

## Decision

    Next.js

## Rationale

Next.js provides in one project:

- React UI;
- server-side rendering;
- server components;
- server-side business logic;
- route handlers;
- webhook endpoints;
- metadata and SEO;
- deployment compatibility with Vercel.

A separate frontend and backend would add unnecessary complexity for V1.

---

# 6. Language

## Decision

    TypeScript

TypeScript should be used throughout the application.

Benefits:

- shared domain types;
- safer refactoring;
- better ORM integration;
- better payment-provider integration;
- fewer invalid states reaching runtime.

Strict TypeScript configuration should be preferred.

Avoid excessive use of:

    any

---

# 7. Rendering strategy

The application may combine:

- Server Components;
- Client Components;
- Server Actions or server-side handlers;
- Route Handlers.

The exact mechanism should depend on the use case.

## Principle

Use server-side execution for operations involving:

- database access;
- authentication;
- authorization;
- prices;
- order creation;
- payments;
- administrative mutations.

Do not expose trusted business logic only in browser code.

---

# 8. Public storefront

The public storefront should be optimized for:

- smartphone use;
- fast loading;
- simple navigation;
- QR-code traffic;
- social-media traffic.

Expected routes may include:

    /
    /vins
    /vins/[slug]
    /panier
    /commande
    /commande/confirmation/[reference]

Exact route naming may evolve during design.

**DECIDED (Phase 4 Gate 1):** `/` directly represents the single
ACTIVE campaign — there is no public campaign slug/ID route in V1. This
matches the product spec's "one active sales cycle at a time" (V1) and
keeps the Campaign concept itself (already in the database) as what
carries reusability into future years, not the URL structure.
`/vins/[slug]` (individual product detail pages) is deferred past
Phase 4: the homepage's editorial wine rows already show full
description/tasting content inline, and (since Phase 6) the add-to-cart
control lives directly on each row too — there is still no distinct
content or action a separate detail page would add.

Public route names should be French where useful because the public
application is French-only.

---

# 9. Administration

Expected routes:

    /admin
    /admin/campagne
    /admin/campagne/[id]
    /admin/campagne/[id]/bundles/[bundleId]
    /admin/commandes
    /admin/commandes/[id]
    /admin/produits
    /admin/vendeurs
    /admin/preparation
    /admin/paiements
    /admin/statistiques
    /admin/exports
    /admin/parametres

> **Gate 1/2B implementation note (adopted):** `/admin/campagne` was
> missing from this list in the original spec — added here to match
> `06-ADMIN-SPEC.md` §44. `/admin/campagne/[id]` is the campaign
> configuration hub (general fields, CampaignProduct, Bundle summary,
> CampaignSeller, lifecycle); Bundle administration lives under it
> (`/admin/campagne/[id]/bundles/...`), scoped to that campaign, never
> under `/admin/produits`.

Admin pages require authentication.

Authorization must be enforced server-side.

Hiding a button in the UI is not authorization.

Routes only ever navigate to admin surfaces that actually exist for the
current implementation phase — no placeholder links to not-yet-built
routes (`/admin/commandes`, `/admin/preparation`, `/admin/paiements`,
`/admin/statistiques`, `/admin/exports`, `/admin/parametres` are not
yet built as of Phase 5).

---

# 10. Database

## Decision

    PostgreSQL

## Rationale

The application contains strongly relational data:

- campaigns;
- products;
- bundles;
- orders;
- payments;
- sellers;
- settlements.

PostgreSQL provides:

- relational integrity;
- transactions;
- constraints;
- indexes;
- mature tooling;
- excellent compatibility with modern TypeScript ORMs.

A document database is not justified for this application.

---

# 11. Database hosting

The application should use a managed PostgreSQL service.

Possible providers include:

- Neon;
- Supabase;
- another managed PostgreSQL provider.

DECIDED (Phase 2, TBD-ARCH-002): Neon is the planned production
PostgreSQL provider.

Selection criteria:

- Swiss/EU data considerations;
- pricing;
- backups;
- reliability;
- Vercel compatibility;
- connection management;
- ease of administration.

The application must not depend heavily on provider-specific database
features unless justified.

## Development database (Phase 2, Gate 3)

DECIDED: local development runs PostgreSQL in Docker (`compose.yaml`,
PostgreSQL 18 — matching Neon's current default major version), never
against a real Neon project. Migrations, the development seed, and
PostgreSQL integration tests (`pnpm test:db`) all run against this
local database. Neon is not required to develop this application.

Production is not yet deployed. Nothing in this document should be
read as confirming a live production database exists — see
`10-IMPLEMENTATION-PLAN.md` Phase 15 for production readiness.

## Staging database (Phase 10 Gate 10C-B2)

A temporary, isolated Neon PostgreSQL project was created solely to give
a real Saferpay TEST `NotifyUrl` callback a publicly reachable target to
call — see `08-PAYMENTS.md` §73. It held only fictional seed/test data,
was migrated and seeded the same way any Neon-driver deployment is
(`DATABASE_DRIVER=neon`, `pnpm db:migrate` / `pnpm db:seed`), and is not,
and never became, the production database. It remains alive only until
final review/cleanup and must not be read as a rehearsal of permanent
production data or infrastructure.

## Database driver selection

DECIDED: the application supports two PostgreSQL drivers behind one
Drizzle schema — `drizzle-orm/node-postgres` (plain TCP, local Docker
Postgres and tests) and `drizzle-orm/neon-serverless` (WebSocket,
Neon). Both implement Drizzle's common `PgDatabase` interface, so
every query and transaction in the domain/infrastructure layers is
identical source code regardless of which driver is active
(`src/infrastructure/database/client.ts`).

Which driver is active is selected by an explicit server-only
environment variable, `DATABASE_DRIVER` (`postgres` | `neon`) —
deliberately **not** inferred from the hosting platform (e.g. a
`VERCEL` variable). Hosting (Vercel) and database provider (Neon) are
separate architectural concerns: a future deployment target other than
Vercel would still need `neon-serverless` to talk to Neon, and a
Vercel deployment could in principle point at plain Postgres. Coupling
the driver choice to the hosting platform would hide that distinction.

    Local development / tests     DATABASE_DRIVER=postgres
    Production (Neon)             DATABASE_DRIVER=neon

`drizzle-orm/neon-http` (the commonly-cited default for serverless
apps) was deliberately not chosen for the Neon path: it does not
support `db.transaction()`, and this application requires real
transactions (order creation, payment confirmation, settlement
completion must be atomic).

---

# 12. ORM

Two primary candidates:

    Prisma
    Drizzle

DECIDED (Phase 2, TBD-ARCH-001): Drizzle.

Evaluation criteria:

- schema clarity;
- migration workflow;
- transaction support;
- PostgreSQL support;
- TypeScript integration;
- maintainability;
- compatibility with deployment environment;
- development experience with Claude Code.

The domain model defined in `04-DATA-MODEL.md` must remain independent
from ORM-specific concepts.

---

# 13. Database migrations

Database schema changes must use version-controlled migrations.

Production schema must never be modified manually without corresponding
migration history.

Conceptually:

    source code
       +
    migrations
       =
    reproducible database schema

Migrations belong in Git.

---

# 14. Environment separation

At minimum:

    local development
    production

A preview/staging environment may also be useful.

Production credentials must never be reused casually in development.

---

# 15. Environment variables

Secrets and environment-specific configuration must use environment
variables.

Examples:

    DATABASE_URL

    AUTH_SECRET

    PAYMENT_SECRET_KEY
    PAYMENT_WEBHOOK_SECRET

    EMAIL_API_KEY

    STORAGE_TOKEN

These names are illustrative and may change depending on providers.

---

# 16. Git security

The repository must never contain real secrets.

Required:

    .env*

should be appropriately ignored, except safe example files.

Recommended:

    .env.example

Example:

    DATABASE_URL=
    AUTH_SECRET=
    PAYMENT_SECRET_KEY=
    PAYMENT_WEBHOOK_SECRET=
    EMAIL_API_KEY=

`.env.example` must contain variable names only, never real credentials.

---

# 17. Authentication

Only administrators authenticate in V1.

Customers:

    no account

Sellers:

    no account

Administrators:

    authentication required

Authentication provider is TBD.

Candidates may include:

- Auth.js;
- Better Auth;
- managed authentication associated with another selected platform.

Requirements:

- secure session management;
- server-side authorization;
- ability to disable an administrator;
- low operational complexity.

Social login is not required.

---

# 18. Authorization

V1 uses one administrator permission level.

Conceptually:

    authenticated admin
        → full admin access

Nevertheless, authorization checks must be centralized enough that roles
can be introduced later if required.

Example future roles:

    ADMIN
    TREASURER
    OPERATIONS

These roles must not be implemented prematurely.

---

# 19. Cart architecture

The shopping cart does not require database persistence before checkout.

V1 may maintain cart state client-side.

Possible storage:

    browser state
    +
    localStorage

The browser cart is never authoritative for pricing.

At checkout, the server must reload:

- products;
- bundle definitions;
- campaign;
- current prices;
- seller validity.

The server calculates the authoritative total.

## Phase 6 implementation (adopted)

The cart itself is pure client state — no request to the server ever
carries a cart. There is nothing to trust or distrust yet; the trust
boundary in §20 becomes load-bearing once Phase 7 submits a cart to
create an Order.

**Storage — what is persisted, and what never is.** `localStorage`
holds only identity and quantity, versioned so a future format change
can be detected and discarded rather than misread:

    {
      "version": 1,
      "campaignId": "<uuid, or \"\" if not yet known this session>",
      "items": [
        { "type": "PRODUCT" | "BUNDLE", "id": "<uuid>", "quantity": <positive integer> }
      ]
    }

Name and price are never persisted. Every render resolves each stored
`(type, id)` against a freshly-fetched `PublicCatalog` (the same read
model the homepage uses); an id absent from `catalog.wines`/
`catalog.bundles` is treated as unavailable (covers: product
deactivated, hidden from this campaign, removed, or — for a bundle —
composition no longer valid, since `PublicCatalog` already excludes
invalid bundles). A malformed, wrong-version, or unparseable stored
value is discarded entirely rather than partially trusted; a malformed
individual item within an otherwise valid stored cart is dropped, not
allowed to corrupt the rest.

**Client/server split.** A single `CartProvider` (React Context +
reducer, no new dependency) sits in the root layout and owns
`localStorage` read/write. It deliberately does not know the current
campaign at render time — the root layout has no reason to run a
catalogue database query. `campaignId: ""` is the "not yet known this
session" sentinel. A separate, tiny component (`CartCampaignSync`) is
rendered only by pages that already fetch the authoritative
`PublicCatalog` server-side (`/` and `/panier`) and reconciles the
hydrated cart's `campaignId` against the real one: matching campaign is
a no-op; the empty sentinel adopts the real campaign id and keeps
whatever items are already present; any other, already-known campaign
id is treated as a genuinely stale prior-session cart and is discarded
entirely — never merged with the new campaign's items. This keeps
campaign-awareness out of the provider while still guaranteeing a stale
cart can never silently carry into a different campaign.

**Hydration safety.** The first client render must render byte-for-byte
what the server rendered — `localStorage` is never read during render
or in a `useState` initializer, only inside a mount-only effect, after
which a second effect (gated on hydration having completed) begins
persisting. This ordering is unit- and e2e-tested; getting it backward
(initializing an empty cart, persisting it, and only then hydrating)
silently destroys a returning customer's real cart.

---

# 20. Checkout trust boundary

Implemented in Phase 7. The browser may submit:

    productId
    quantity
    bundleId
    sellerId
    customer information
    selected payment method

The browser must NOT be trusted to submit authoritative:

    product price
    bundle price
    order total
    payment status
    seller target
    fulfilment status

Server-side business logic determines those values.

## Phase 7 implementation (adopted)

`/commande`'s client leaf reads the hydrated Phase 6 cart and calls a
Server Action directly with a plain structured payload — items
(`type`/`id`/`quantity` only), customer fields, an optional `sellerId`,
the cart's own `campaignId` (for staleness detection), and a
client-generated `idempotencyKey` (§14a). No price ever appears in that
payload; there is no field for one to occupy. The action re-validates
every field with the same Zod schema used by `/admin/commandes/nouvelle`
(`domain/orders/order-input-schema.ts`) — one schema, one
`createOrder()` core (`infrastructure/orders/create-order.ts`), for
ONLINE and MANUAL alike (docs/10 §48's "SAME order-creation core").

Payment method is fixed to seller/offline for Phase 7 — TWINT/card are
not offered anywhere in the UI (no PSP integration exists yet), so
there is no payment-method trust boundary to enforce beyond "no other
method exists to submit."

---

# 21. Order creation

Order creation should occur inside a database transaction where
appropriate.

Conceptually:

    BEGIN

    validate campaign
    validate products
    validate seller

    calculate authoritative prices

    create order
    create order items
    snapshot bundle components
    create initial payment information
    create audit event

    COMMIT

A partially created commercial order must not be left behind because one
database operation failed.

## Phase 7 implementation (adopted)

`createOrder()` (`infrastructure/orders/create-order.ts`) is exactly
this pipeline, in one `db.transaction()`: acquire a Postgres advisory
lock on the idempotency key (§14a) → return the existing Order
immediately if that key was already used → resolve the active campaign
and reject a stale/mismatched one → resolve every submitted line
against the live catalog, rejecting the whole submission if any single
line is unavailable (never a partial order) → revalidate the seller,
if any, against currently-eligible `CampaignSeller`s → calculate
authoritative totals → reserve the order number (`reserveOrderNumber`,
already built in Phase 2) → insert Order/OrderItems/
OrderBundleComponents/Payment/OrderEvent. `reserveOrderNumber`'s
increment is plain transactional table DML, not a non-transactional
sequence, so a rollback anywhere in this pipeline also rolls back the
number reservation — confirmed by a dedicated DB test
(`create-order.db.test.ts`).

A freshly created Phase 7 order is `status: CONFIRMED` (nothing external
blocks it — that state is reserved for a future online-payment order
still awaiting provider confirmation), `customerPaymentStatus: PENDING`,
`sellerSettlementStatus: PENDING`, with one `Payment` row
(`method: SELLER, provider: OFFLINE, status: PENDING`).

---

# 22. Payment architecture

Payment integration must use an application abstraction.

Provider-specific code should stay isolated from the rest of the
application rather than scattered throughout checkout/admin code.

## Phase 10 Gate 10B implementation (adopted)

The originally-sketched generic `createPayment()`/`handleWebhook()`/
`getPaymentStatus()`/`refundPayment()` shape was deliberately **not**
implemented as written — Saferpay's actual Payment Page protocol has no
signed webhook to "handle" (see `08-PAYMENTS.md` §70.1), so forcing that
shape onto it would misrepresent the real mechanism. The implemented
boundary instead mirrors Saferpay's own two operations:

    src/infrastructure/payments/saferpay-client.ts
        initializePaymentPage()
        assertPaymentPage()
        capturePayment()            — Transaction/Capture (Gate 10C-A)

    src/infrastructure/payments/online-payments.ts
        initiateOnlinePayment()     — orchestration: validate, create
                                       local Payment attempt, call
                                       Initialize, persist session id.
                                       Refuses to silently supersede an
                                       attempt Saferpay has already
                                       authorized but whose capture is
                                       still unresolved (Gate 10C-A —
                                       see docs/08-PAYMENTS.md §71.4).
        confirmOnlinePayment()      — orchestration: call Assert,
                                       normalize, and — if AUTHORIZED —
                                       call Transaction/Capture before
                                       applying the trusted success
                                       transition (Gate 10C-A corrected
                                       this: AUTHORIZED alone is not
                                       financially final — see
                                       docs/08-PAYMENTS.md §71)

The domain layer (`src/domain/payments/`) never depends on raw Saferpay
response types — `saferpay-client.ts` translates every response into a
small explicit `SaferpayAssertOutcome` before any domain/guard code sees
it (docs/04-DATA-MODEL.md §19's "provider-specific states must be
translated into application domain states" principle).

A double-gated fake test provider
(`src/infrastructure/payments/fake-test-provider.ts`) implements the
identical function signatures for deterministic Playwright coverage —
selected only when `NODE_ENV !== "production"` AND an explicit
`E2E_FAKE_PAYMENT_PROVIDER=true` opt-in are both true (set only in
`playwright.config.ts`'s own `webServer.env`), so it can never activate
outside a test run.

`refundPayment()` was intentionally not added to the interface — refunds
are out of scope for Gate 10B (docs/08-PAYMENTS.md TBD-PAY-005) and
adding the surface now would be speculative against an unconfirmed
production contract.

## Phase 10 Gate 10C-B1 implementation (adopted)

Two further additions:

    src/app/api/payments/saferpay/notify/[token]/route.ts
        GET — Saferpay's SuccessNotifyUrl/FailNotifyUrl (same URL for
              both), delegating entirely to confirmOnlinePayment()

    online-payments.ts
        reconcileOnlinePaymentForOrder()  — admin manual reconciliation,
                                             also delegating to
                                             confirmOnlinePayment()

Neither introduces a second financial mutation path — both are thin
callers of the existing `confirmOnlinePayment()` (see
`08-PAYMENTS.md` §72). `ReturnUrl`/`SuccessNotifyUrl`/`FailNotifyUrl`
are now built from a dedicated `APP_BASE_URL` server env var
(`src/lib/app-url.ts`), not the incidental `BETTER_AUTH_URL` reuse
Gate 10B started with — see §15 below.

---

# 23. Payment provider requirements

The selected provider must support at minimum:

    TWINT
    cards

Important evaluation criteria:

- Swiss market support;
- TWINT support;
- card support;
- transaction pricing;
- no unnecessary fixed cost;
- API quality;
- TypeScript/Node integration;
- webhook quality;
- reconciliation;
- refund support;
- payment dashboard;
- accounting usability.

The final provider will be selected in `08-PAYMENTS.md`.

---

# 24. Payment source of truth

The application database is the source of truth for Melodia order state.

The PSP is authoritative regarding the external payment transaction.

Payment confirmation must therefore flow:

    Payment provider
          │
          ▼
       Webhook
          │
          ▼
    Application validation
          │
          ▼
       Database

The browser redirect is informational only.

---

# 25. Payment webhook

Expected endpoint conceptually:

    POST /api/webhooks/payment

The webhook handler must:

1. read the provider request;
2. verify provider signature/authenticity;
3. identify the provider event;
4. reject invalid requests;
5. handle duplicate events safely;
6. update Payment;
7. update Order payment summary where appropriate;
8. create an audit event;
9. return the appropriate provider response.

Webhook processing must be idempotent.

---

# 26. Payment provider isolation

Provider-specific fields must not leak unnecessarily into domain logic.

Avoid:

    if stripePayment...
    stripeOrder...
    stripeStatus...

throughout the application.

Prefer:

    Payment
    PaymentProvider
    PaymentStatus

Provider-specific IDs belong inside the payment integration layer and
payment records.

---

# 27. Offline payment

Seller payment does not involve the PSP.

Conceptually:

    PaymentProvider = OfflinePaymentProvider

or equivalent domain handling.

The same Order and Payment models remain usable.

Offline payment must not be implemented as an unrelated parallel order
system.

---

# 28. Seller settlements

Seller settlements are internal financial operations.

They do not involve the online PSP.

Settlement logic belongs in a dedicated application module.

Conceptually:

    SettlementService

Responsibilities:

- determine eligible collected orders;
- create settlement;
- associate orders;
- calculate amount;
- mark settlement complete;
- record administrator;
- generate audit events.

---

# 29. Transactional email

The application requires transactional email for:

- order confirmation;
- possibly administrative notifications later.

**DECIDED (Phase 11 Gate 11A, TBD-ARCH-005 resolved):** Resend. Selected
without a further Postmark/alternative-provider evaluation (an explicit
product decision for this gate — see §60/§61 below).

Email must be sent from an ECM-controlled domain or subdomain.

Exact sender address (`EMAIL_FROM`) is set via environment
configuration, not hardcoded — see §31 below. Production sending
additionally requires the sender's domain to be verified in Resend with
SPF/DKIM/DMARC configured (docs/09-SECURITY.md §61) — a Phase 15
deployment dependency, not resolved by Gate 11A.

---

# 30. Email reliability

Order creation must not depend on successful email delivery.

Correct sequence:

    create valid order
       ↓
    commit database transaction
       ↓
    attempt confirmation email

If email fails:

    order remains valid

The failure should be observable by administrators or logs.

---

# 31. Email abstraction

## Phase 11 Gate 11A implementation (adopted)

The originally-sketched generic `EmailProvider` with
`sendOrderConfirmation()`/`sendAdminNotification()` was narrowed to
exactly what Phase 11 needs (docs/10-IMPLEMENTATION-PLAN.md §5's "not a
general campaign-email platform"): a single-operation boundary,
mirroring the `PaymentProvider`-style isolation already established for
Saferpay (§22 above).

    src/infrastructure/email/email-provider.ts
        EmailProvider — sendEmail(input): Promise<SendEmailSuccess>

    src/infrastructure/email/resend-provider.ts
        sendEmail()              — real adapter, official `resend`
                                    npm package, server-only
        isResendConfigured()

    src/infrastructure/email/fake-test-provider.ts
        sendEmail()              — deterministic, no network, same
                                    double-gated safety model as
                                    src/infrastructure/payments/
                                    fake-test-provider.ts
                                    (NODE_ENV !== "production" AND
                                    explicit E2E_FAKE_EMAIL_PROVIDER
                                    opt-in)

    src/infrastructure/email/order-confirmation.ts
        sendOrderConfirmationEmail() — composed entry point (content
                                        builder + provider selection).
                                        NOT called by any order/payment
                                        code path yet — see Gate 11A/
                                        11B below.

    src/domain/email/order-confirmation-content.ts
        buildOrderConfirmationEmail() — pure: persisted order data in,
                                         {subject, html, text} out. No
                                         network, no DB access.

`sendAdminNotification()` was not built — no Phase 11 requirement
depends on it; adding it now would be speculative (docs/10-
IMPLEMENTATION-PLAN.md §16 scope-creep guidance).

Gate 11A built this foundation only — deliberately not wired into
`createOrder()`, checkout, or the online-payment trusted-success
transition. Gate 11B (below) wires dispatch at the proven idempotent
transition points.

## Phase 11 Gate 11B implementation (adopted)

Two further additions, both thin callers of the existing
`sendOrderConfirmationEmail()` — no second dispatch implementation:

    src/infrastructure/email/order-confirmation.ts
        dispatchOrderConfirmationEmail(dbHandle, orderId, input)
            — send + classify + record EMAIL_SENT/EMAIL_FAILED
              OrderEvent, never throws (docs/09-SECURITY.md §60's Gate
              11B subsection). Adds an optional, deterministic,
              non-PII `order-confirmation/<orderId>` Idempotency-Key,
              forwarded to Resend as defense-in-depth only.

    src/infrastructure/orders/create-order.ts
        createOrder() — after its own transaction commits, dispatches
            the SELLER_PAYMENT confirmation when, and only when,
            `source === "ONLINE"` AND the just-created order's status
            is `CONFIRMED` (i.e. public checkout choosing seller
            payment — never MANUAL admin entry, and never an ONLINE
            order that chose TWINT/CARD, whose `status` is `NEW` here).

    src/infrastructure/payments/online-payments.ts
        applySuccessfulOnlinePayment() — its internal transaction now
            distinguishes an idempotent "already SUCCEEDED" observation
            from the one call that genuinely performs the trusted
            success transition; only the latter, after the transaction
            resolves, dispatches the ONLINE_PAID confirmation. Reuses
            the exact `SELECT ... FOR UPDATE` lock (§22 above,
            `08-PAYMENTS.md` §71.3) already proven to make the
            transition itself exactly-once — no new locking primitive
            for email.

Both call sites share one architectural guard:

    dbHandle === db

External post-commit side effects (the Resend HTTP call) may only run
when the function owns the durable top-level DB handle. A `dbHandle`
passed in by a caller (e.g. a test's own transaction/savepoint) may
still be rolled back by that caller after the function returns — the
"commit" its own `dbHandle.transaction(...)` just resolved from would
then never have genuinely happened. This is not a test-only
accommodation: it is the only handle either function can be certain
represents a true commit, verified against the entire existing DB
integration test suite (four pre-existing "real committed connection"
suites needed a mocked email provider added; ~15 `withRollback`-based
suites needed no changes at all, because they never pass this handle).

No queue/worker and no dedicated email/outbox table were introduced
(docs/10-IMPLEMENTATION-PLAN.md Phase 11 Gate 11B scope) — the
documented, accepted remaining gap is that a process crash between
commit and the (best-effort) email attempt can lose a single
confirmation with no automatic retry; Gate 11C's admin resend is the
only recovery path — see below.

## Phase 11 Gate 11C implementation (adopted)

Manual admin recovery for the Gate 11B gap above — an authenticated
administrator can resend the appropriate confirmation from
`/admin/commandes/[id]`.

    src/domain/email/resolve-confirmation-eligibility.ts
        resolveOrderConfirmationEligibility(order, payments)
            — pure, mirrors payment-guards.ts's style. Derives
              eligibility/variant from CURRENT persisted state only
              (never prior email history, never source, never
              fulfilment status): a SUCCEEDED SAFERPAY payment ⇒
              ONLINE_PAID; a SELLER-method payment AND
              customerPaymentStatus = PENDING ⇒ SELLER_PAYMENT;
              CANCELLED orders and SELLER orders already marked PAID
              are always ineligible (the existing "payment still due"
              template would no longer be truthful — no third
              "already paid" template was added).

    src/infrastructure/email/order-confirmation.ts
        buildOrderConfirmationEmailInput(dbHandle, order, items, method)
            — the persisted-data → OrderConfirmationEmailInput mapping,
              extracted from what were two independent copies of the
              same logic in create-order.ts/online-payments.ts (both
              now call this instead — no behavior change, proven by
              the unchanged Gate 11B test suite). Reused a third time
              here.
        dispatchOrderConfirmationEmail(..., options?)
            — gained an optional 4th parameter, defaulting to exactly
              Gate 11B's prior behavior (`{trigger: "AUTOMATIC", actor:
              {type:"SYSTEM"}}`) so neither existing call site changed.
              `ADMIN_RESEND` uses actorType `ADMIN` +the authenticated
              admin's id (the existing OrderEvent audit columns, not a
              new field) and a FRESH `order-confirmation/resend/
              <orderId>/<randomUUID>` idempotency key per call —
              deliberately never the automatic per-order key (reusing
              it risks Resend treating an intentional resend as a
              retry of the original and returning its cached result
              instead of actually sending).
        resendOrderConfirmation(dbHandle, orderId, order, items, payments, adminUserId)
            — orchestrates eligibility → build → dispatch. Takes
              already-fetched order/items/payments (the caller — the
              admin Server Action — fetches via the same
              `getOrderDetail()` the page itself uses); never calls
              `getOrderDetail` itself, which keeps this module free of
              a value import of the database client (preserving its
              plain-unit-test importability — see the file's own
              comment on why `db` stays type-only here).

    src/app/admin/(protected)/commandes/[id]/actions.ts
        resendOrderConfirmationAction — requireAdmin() first line
            (same boundary as every sibling action), re-reads order
            state fresh, delegates entirely to the above. Only
            `orderId` ever crosses the browser→server boundary — the
            variant and recipient are always server-derived.

**Manual-resend idempotency — honestly limited, by design (approved
scope reduction from an earlier event-count-based proposal):** the
fresh `randomUUID()` per call means the ONLY protection against
accidental double-submission is the client's `disabled={isPending}`
submit button (`resend-confirmation-button.tsx`) — a genuinely separate
Server Action invocation (a second real click, a replayed request)
generates its own key and sends its own email. This is accepted for a
low-volume, authenticated, admin-only action; intentional resends must
always work, which a stable/shared key would have undermined.

No new database table, no migration, no queue.

Wine and bundle images require external or managed storage.

Database stores references:

    imageUrl

Possible approaches:

- Vercel Blob;
- Cloudinary;
- Supabase Storage;
- another object-storage provider.

Provider TBD.

Selection criteria:

- cost;
- image optimization;
- ease of upload;
- CDN;
- operational simplicity.

---

# 33. Static assets

Brand assets that change rarely may live directly in the repository.

Examples:

    ECM logo
    decorative SVG assets
    icons

Dynamic product photography should preferably use the selected storage
solution.

---

# 34. PDF generation

V1 requires server-generated PDFs for:

- invoice/receipt;
- preparation sheet;
- possibly seller preparation summary.

PDF generation must use authoritative server-side order data.

PDFs should not be generated from untrusted browser values.

Exact PDF library is TBD.

Selection criteria:

- Node.js compatibility;
- Vercel compatibility;
- typography;
- pagination;
- maintainability;
- ability to share the visual identity with the web application.

---

# 35. CSV exports

CSV exports are generated server-side.

Expected exports:

    orders.csv
    order-items.csv
    seller-sales.csv
    wine-requirements.csv

Exports must respect admin authentication and authorization.

CSV output must handle characters such as:

    é
    è
    à
    ü
    apostrophes

UTF-8 should be used.

Compatibility with common spreadsheet software should be considered.

## Phase 12 Gate 12A implementation (adopted)

All four exports are implemented as authenticated Route Handlers under
`/admin/exports/*.csv`, each independently calling `getAdminOrNull()`
(`src/lib/auth/dal.ts`) and returning a plain 401 on failure — not
`requireAdmin()`'s page-oriented `redirect()`, per that file's own
"Route Handlers need 401/403 semantics" guidance. The `(protected)`
folder/Proxy give optimistic UX only; the Route Handler's own check is
the actual boundary (verified in `e2e/exports.spec.ts` with both a
genuinely cookie-less request, caught by Proxy's redirect, and a
forged-but-present session cookie, caught only by the handler's own
`getAdminOrNull()`).

A small pure CSV domain layer (`src/domain/csv/`) — `csv-cell.ts`
(quoting + centralized formula-injection neutralization),
`format-csv-money.ts`/`format-csv-date.ts` (locale-independent
decimal/ISO formatting, dates resolved to Europe/Zurich),
`select-authoritative-payment-for-export.ts` (the one-row-per-order
payment-selection rule below), `generate-export-filename.ts`, and one
`build-*-csv.ts` per export — takes only already-fetched plain data, no
DB access, fully unit-tested. Dialect: `;` delimiter (Swiss/French
Excel default list separator), UTF-8 BOM, CRLF row endings, money as
plain two-decimal text (`18.00`, never locale-formatted), dates as
`YYYY-MM-DD`, datetimes as `YYYY-MM-DD HH:mm` (Europe/Zurich, 24h).

Formula-injection defense (`neutralizeFormulaPrefix()`) is centralized
and applied only to untrusted free-text columns (customer name/
address/phone/email/delivery note, product/bundle/seller display
names) — never to money, dates, counts, or codebase-produced labels. A
leading `=`/`+`/`-`/`@`, optionally preceded by space/tab/CR/LF, is
neutralized by prefixing the original value with `'` — the value's own
characters (e.g. a `+41…` phone number) are never stripped or altered.

`orders.csv` is one row per order (never one row per payment attempt).
`selectAuthoritativePaymentForExport()` picks the `SUCCEEDED` payment
if one exists (a second one is structurally prevented elsewhere in the
codebase — see `docs/08-PAYMENTS.md` anomaly handling), otherwise the
most recent attempt by `createdAt`; an equal-timestamp tie-break by
`id` is a purely technical determinism guard, not a chronology claim.
`orders.customerPaymentStatus`/`sellerSettlementStatus` always come
from the Order row itself, never from the selected payment.

New batched infrastructure (no N+1): `listOrdersForCampaignExport()`
(`src/infrastructure/orders/orders.ts`) — includes `CANCELLED` orders,
unlike the fulfilment-scoped query — and
`listCampaignSellerSalesSummaries()`
(`src/infrastructure/settlements/settlements.ts`), which reuses the
existing `calculateSellerSales`/`calculateSellerCollections`/
`calculateSellerProgress` calculators (never reimplements them),
sources sellers from `campaignSellers` directly rather than the
active-only picker (a deactivated seller's historical sales stay
visible), and adds one synthetic "Non attribuée" row for unassigned
orders when any exist.

`order-items.csv` keeps one row per commercial `orderItems` row; a
BUNDLE row's own snapshotted price/quantity/total is never split
across its components (no fabricated component prices) — components
are shown only as an informational `composition` text column.

Campaign selection reuses `listFulfilmentRelevantCampaigns()`/
`resolveDefaultFulfilmentCampaign()` verbatim (ACTIVE ∪ CLOSED — same
scope as `/admin/preparation`; `ARCHIVED` campaigns are not exportable
in this gate). `CampaignSelector`
(`src/components/admin/campaign-selector.tsx`, moved from
`preparation/` and given a `basePath` prop, default unchanged) is
shared by both pages rather than duplicated.

No PDF work is part of this gate (`TBD-ARCH-007` remains open, deferred
to Gate 12B).

---

# 36. Domain layer

Business rules should not live exclusively inside React components.

Example structure conceptually:

    src/
        domain/
        application/
        infrastructure/
        app/
        components/

Exact directory structure may evolve.

Responsibilities:

## Domain

Business concepts and rules.

## Application

Use cases and orchestration.

## Infrastructure

Database, payment, email and storage integrations.

## App

Next.js routes, pages and server entry points.

## Components

Reusable UI.

Avoid architecture ceremony that adds no practical value.

---

# 37. Suggested project structure

Conceptually:

    src/
    ├── app/
    │   ├── (public)/
    │   ├── admin/
    │   └── api/
    │
    ├── components/
    │   ├── ui/
    │   ├── public/
    │   └── admin/
    │
    ├── domain/
    │   ├── campaigns/
    │   ├── catalogue/
    │   ├── orders/
    │   ├── payments/
    │   ├── sellers/
    │   └── settlements/
    │
    ├── application/
    │
    ├── infrastructure/
    │   ├── database/
    │   ├── payments/
    │   ├── email/
    │   └── storage/
    │
    ├── lib/
    └── types/

This is guidance, not an immutable requirement.

Claude Code may refine the structure if it can justify a simpler or
clearer organization.

---

# 38. Validation

Inputs must be validated server-side.

A schema validation library should be used.

Recommended candidate:

    Zod

Validation applies to:

- checkout;
- admin forms;
- route parameters;
- webhook data where appropriate;
- environment configuration.

Client-side validation may improve UX but does not replace server-side
validation.

---

# 39. Error handling

Expected user-facing errors should produce understandable messages.

Examples:

- campaign closed;
- invalid product;
- payment failed;
- seller unavailable;
- invalid checkout information.

Unexpected internal errors should:

- not expose stack traces;
- not expose secrets;
- not expose database details;
- be logged appropriately.

---

# 40. Logging

Application logging should capture operationally useful events.

Examples:

    order created
    payment webhook failed
    payment confirmed
    email failed
    settlement completed
    PDF generation failed

Logs must not unnecessarily contain:

- full addresses;
- payment secrets;
- card information;
- authentication secrets.

---

# 41. Observability

V1 does not require a complex observability platform.

Minimum useful capabilities:

- deployment logs;
- server errors;
- webhook errors;
- payment reconciliation visibility.

Additional error monitoring such as Sentry may be considered later.

It is not mandatory for the first implementation unless operational need
justifies it.

---

# 42. Hosting

## Recommended baseline

    Vercel

Reasons:

- strong Next.js integration;
- simple deployments;
- GitHub integration;
- preview deployments;
- environment variables;
- custom domains;
- HTTPS.

Final hosting decision should still consider expected costs and external
service compatibility.

## Staging deployment (Phase 10 Gate 10C-B2)

A temporary Vercel project (Production environment, no custom domain,
default/unprotected Deployment Protection scope — justified because the
project held only 100% fictional seed data) was created solely to give
Saferpay's `NotifyUrl` a real, publicly reachable HTTPS endpoint, which
`localhost` cannot provide — see `08-PAYMENTS.md` §73. It is disposable
validation infrastructure, not a preview of the eventual
`vins.ecmelodia.ch` production deployment (Phase 15,
`10-IMPLEMENTATION-PLAN.md` §86/§87), and it does not participate in DNS
for `vins.ecmelodia.ch` or the existing Wix site.

---

# 43. Domain architecture

Public application:

    https://vins.ecmelodia.ch

Current main website:

    https://www.ecmelodia.ch

The main website may remain on Wix while the wine application is hosted
elsewhere.

DNS routes only the wine subdomain to the new application.

This avoids coupling the application lifecycle to the current Wix site.

---

# 44. DNS

Conceptually:

    www.ecmelodia.ch
            │
            ▼
           Wix

    vins.ecmelodia.ch
            │
            ▼
          Vercel

The exact DNS record depends on the final hosting configuration.

DNS changes should only be performed after the production application is
ready to receive the domain.

---

# 45. HTTPS

Production must use HTTPS exclusively.

The hosting platform should provision and renew TLS certificates
automatically.

Payment and authentication endpoints must never operate over plaintext
HTTP in production.

---

# 46. Deployment workflow

Recommended workflow:

    local branch
        ↓
    commit
        ↓
    GitHub
        ↓
    preview deployment
        ↓
    review/test
        ↓
    production deployment

Production should deploy from a controlled branch.

Recommended:

    main

Development may use feature branches as useful.

A complicated GitFlow process is unnecessary.

---

# 47. Repository

Repository:

    melodia-wine-shop

Recommended initial structure:

    melodia-wine-shop/
    ├── README.md
    ├── CLAUDE.md
    ├── .gitignore
    ├── .env.example
    ├── docs/
    ├── src/
    ├── public/
    ├── migrations/
    └── package.json

Actual migration directory depends on ORM.

---

# 48. CI

Minimum CI should eventually verify:

    formatting
    linting
    type checking
    tests
    build

Example conceptual pipeline:

    push
      ↓
    lint
      ↓
    typecheck
      ↓
    tests
      ↓
    build

Production deployment should not knowingly ship a broken build.

Exact GitHub Actions configuration will be defined during implementation.

---

# 49. Testing strategy

V1 should include meaningful automated tests.

Priority areas:

## High priority

- price calculations;
- bundle decomposition;
- order totals;
- seller target calculations;
- wine requirements;
- payment state transitions;
- settlement calculations;
- webhook idempotency.

## Medium priority

- checkout validation;
- admin mutations;
- campaign state behaviour.

## UI

Critical customer flows should receive end-to-end testing where practical.

The project should not pursue test coverage percentages for their own
sake.

---

# 50. Concurrency

The application must assume that multiple customers can order
simultaneously.

Important concurrency-sensitive operations:

- order-number generation;
- payment processing;
- webhook processing;
- settlements.

Database constraints and transactions should provide protection where
possible.

---

# 51. Performance

Expected load is modest.

No Redis/cache layer is required by default.

No message queue is required by default.

No CDN beyond what the hosting/storage platform already provides is
required by default.

Optimize only when evidence demonstrates a need.

---

# 52. Background jobs

V1 should avoid requiring a dedicated background-job infrastructure
unless necessary.

Operations such as confirmation email may initially be triggered after
order creation.

If reliability requirements later justify queues or background jobs, they
can be introduced without redesigning the domain model.

---

# 53. Security boundaries

Trusted:

    server-side application
    database
    verified payment-provider events

Untrusted:

    browser
    URL parameters
    form values
    client-side totals
    uploaded content
    unverified webhook requests

All transitions from untrusted to trusted contexts require validation.

Detailed security controls are defined in `09-SECURITY.md`.

---

# 54. Backups

The production PostgreSQL provider should provide appropriate backup or
point-in-time recovery capabilities.

The application stores operational and financial records that would be
difficult to reconstruct manually.

Backup capability is therefore a provider-selection criterion, not an
optional convenience.

---

# 55. Data portability

ECM must not become unable to retrieve its own commercial data.

The system provides CSV exports.

Database technology should remain standard enough that data can be
exported or migrated.

Avoid unnecessary proprietary data models.

---

# 56. External dependency principle

External providers are acceptable when they solve real operational
problems.

Examples:

    payments
    email
    hosting
    managed database
    image storage

However, domain logic must remain owned by the application.

The project should avoid unnecessary SaaS dependencies for trivial
features.

---

# 57. Architecture anti-patterns

Do not implement:

- microservices;
- Kubernetes;
- event sourcing;
- custom authentication from scratch;
- custom card handling;
- a separate API backend without demonstrated need;
- Redis without demonstrated need;
- message queues without demonstrated need;
- generic enterprise abstractions everywhere;
- provider-specific payment logic scattered through UI components.

The architecture should remain understandable by a single developer.

---

# 58. Failure philosophy

The system should degrade safely.

Examples:

## Payment provider unavailable

Orders must not be falsely marked paid.

## Email provider unavailable

Valid orders remain valid.

## Image storage unavailable

Existing orders and administration continue to function.

## PDF generation fails

Underlying order remains intact.

## Browser crashes

Authoritative server-side payment confirmation still works.

Financial correctness takes priority over cosmetic convenience.

---

# 59. Architecture decision records

Important technical decisions may be documented as short ADRs if useful.

Examples:

    ADR-001 ORM selection
    ADR-002 payment provider
    ADR-003 authentication
    ADR-004 database hosting

Do not create ADRs for trivial implementation details.

---

# 60. Current architecture decisions

- DECIDED: One repository.
- DECIDED: Modular monolith.
- DECIDED: Next.js.
- DECIDED: React.
- DECIDED: TypeScript.
- DECIDED: PostgreSQL.
- DECIDED: Tailwind CSS.
- DECIDED: shadcn/ui may be used as a component foundation.
- DECIDED: Server-side authoritative pricing.
- DECIDED: Server-side authorization.
- DECIDED: Managed PostgreSQL.
- DECIDED: Payment provider abstraction.
- DECIDED: Email provider abstraction.
- DECIDED: External card details are never stored.
- DECIDED: Payment confirmation uses trusted provider callbacks/webhooks.
- DECIDED: Webhook processing must be idempotent.
- DECIDED: Manual and online orders use the same domain model.
- DECIDED: No microservices.
- DECIDED: No Redis by default.
- DECIDED: No dedicated message queue by default.
- DECIDED: Public application uses `vins.ecmelodia.ch`.
- DECIDED: Main Wix website may remain independent.
- DECIDED: GitHub is the source repository.
- DECIDED: Production secrets are not committed.
- DECIDED: Drizzle ORM (TBD-ARCH-001, resolved in Phase 2).
- DECIDED: Neon PostgreSQL is the planned production provider
  (TBD-ARCH-002, resolved in Phase 2). The application uses Neon's
  pooled connection string at runtime and the direct/unpooled
  connection string only for migrations and the development seed
  script.
- DECIDED: Local development uses PostgreSQL in Docker Compose, never
  Neon (Phase 2, Gate 3). See "Development database" above.
- DECIDED: The active PostgreSQL driver (`node-postgres` locally,
  `neon-serverless` — chosen over `neon-http` for real
  `db.transaction()` support — against Neon) is selected by the
  explicit `DATABASE_DRIVER` environment variable, never inferred from
  the hosting platform. See "Database driver selection" above.
- DECIDED: Better Auth 1.7.5, official Drizzle adapter (TBD-ARCH-003,
  resolved in Phase 3 — see docs/09-SECURITY.md §83 TBD-SEC-001 and
  docs/04-DATA-MODEL.md §24 for the full design). Authentication
  identity (`auth_users`) and domain/audit identity (`admin_users`) are
  kept separate. Authorization is enforced by a server-only Data Access
  Layer (`src/lib/auth/dal.ts`), never by `src/proxy.ts` (Next.js 16's
  renamed `middleware.ts`), which is optimistic UX only — it may redirect
  an obviously-anonymous request away from `/admin` but never performs
  the authoritative check.
- DECIDED: `/` directly represents the single ACTIVE campaign; no
  public campaign slug/ID route in V1 (Phase 4 Gate 1 — see §8 above).
- DECIDED: The public catalogue read model (`getPublicCatalog()`,
  `src/infrastructure/catalog/`) separates a pure, DB-free shaping
  layer (`src/domain/catalog/`) from the actual Drizzle query — the
  same domain/infrastructure split used throughout this codebase, not
  the earlier 4-layer `domain/application/infrastructure/app` sketch in
  §37 (no `application/` folder exists anywhere in this repository).
- DECIDED: The public homepage (`/`) is dynamically rendered
  (`export const dynamic = "force-dynamic"`, Phase 4 Gate 2) —
  `getPublicCatalog()` reads through a raw `pg` connection, not
  `fetch()`, so Next has no automatic signal to treat the route as
  dynamic; without this it silently prerenders once at build time and
  never reflects a later admin change.
- DECIDED: `APP_BASE_URL` (Phase 10 Gate 10C-B1) is the dedicated,
  server-only trusted origin for every externally reachable URL this
  application constructs for a third party (Saferpay's `ReturnUrl`,
  `SuccessNotifyUrl`, `FailNotifyUrl`) — never derived from request
  `Host`/`X-Forwarded-Host` headers, and never reused from
  `BETTER_AUTH_URL` (a distinct concern that only incidentally held the
  same value in Gate 10B). `src/lib/app-url.ts`'s `appUrl()` builds
  every such URL via the `URL` constructor, never string concatenation.
- DECIDED: A temporary, isolated Neon project and a temporary Vercel
  deployment were used only to give Saferpay's `NotifyUrl` a real,
  publicly reachable HTTPS endpoint for Phase 10 Gate 10C-B2 acceptance
  testing — disposable staging validation infrastructure, not a preview
  of production. See §11/§42 above and `08-PAYMENTS.md` §73.
- DECIDED (Phase 11 Gate 11A): Resend is the transactional email
  provider (TBD-ARCH-005, resolved — see §29/§61). The official
  `resend` npm package is used directly by a small, isolated
  `EmailProvider` boundary (§31 above) — domain/application code never
  imports `resend` itself. A double-gated fake test provider mirrors
  the Saferpay one exactly (`NODE_ENV !== "production"` AND explicit
  `E2E_FAKE_EMAIL_PROVIDER=true` opt-in). Gate 11A built this
  foundation only; automatic dispatch is wired in Gate 11B (below).
- DECIDED (Phase 11 Gate 11B): automatic order-confirmation dispatch is
  gated on `dbHandle === db` at each call site (never a passed-in
  transaction/savepoint handle) — the only reliable signal that a
  business transaction has genuinely, durably committed, as opposed to
  a nested savepoint whose ultimate fate a caller elsewhere still
  controls. See §31 above for the full mechanics.
- DECIDED (Phase 11 Gate 11B): automatic dispatch is limited to public
  checkout (`source === "ONLINE"`) — both the SELLER-payment and the
  online-payment-success variants. MANUAL admin-entered orders do not
  receive an automatic confirmation email; a future admin-triggered
  send is deferred to Gate 11C.

---

# 61. Technical decisions still to make

## TBD-ARCH-003 — Authentication — RESOLVED (Phase 3)

Better Auth 1.7.5. See the DECIDED entry above.

## TBD-ARCH-004 — Payment provider — RESOLVED for architecture (Phase 10 Gate 10B)

Worldline / Saferpay JSON API / Payment Page (hosted redirect),
supporting TWINT + Visa + Mastercard. Full detail in `08-PAYMENTS.md`
§4/§70. Production account/contract/credentials remain a deployment
dependency (TBD-PAY-001 in `08-PAYMENTS.md`), not an architecture TBD.

## TBD-ARCH-005 — Transactional email — RESOLVED (Phase 11 Gate 11A)

**Resolution:** Resend. See §29/§31 above. Production sender-domain
verification (SPF/DKIM/DMARC) remains a Phase 15 deployment dependency,
not an architecture TBD.

## TBD-ARCH-006 — Image storage

Select provider.

## TBD-ARCH-007 — PDF library

Select server-compatible PDF generation approach.

## TBD-ARCH-008 — Monitoring

Determine whether dedicated error monitoring is required for launch.

---

# 62. Selection principle

When choosing between technically valid solutions, prefer the option
that minimizes:

    operational complexity
    +
    vendor coupling
    +
    maintenance burden

while preserving:

    financial correctness
    security
    maintainability
    good developer experience

This application should remain maintainable after the 2026 campaign
without requiring a permanent software engineering team.
