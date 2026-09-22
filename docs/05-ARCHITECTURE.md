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

Provider is TBD.

Selection criteria:

- deliverability;
- API quality;
- pricing;
- custom domain support;
- logs;
- EU/Swiss considerations.

Possible providers may include:

- Resend;
- Postmark;
- another transactional email provider.

Email must be sent from an ECM-controlled domain or subdomain.

Exact sender address is TBD.

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

Use an application-level interface.

Conceptually:

    EmailProvider

        sendOrderConfirmation()
        sendAdminNotification()

Provider-specific code should remain isolated.

---

# 32. Image storage

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

---

# 61. Technical decisions still to make

## TBD-ARCH-003 — Authentication — RESOLVED (Phase 3)

Better Auth 1.7.5. See the DECIDED entry above.

## TBD-ARCH-004 — Payment provider — RESOLVED for architecture (Phase 10 Gate 10B)

Worldline / Saferpay JSON API / Payment Page (hosted redirect),
supporting TWINT + Visa + Mastercard. Full detail in `08-PAYMENTS.md`
§4/§70. Production account/contract/credentials remain a deployment
dependency (TBD-PAY-001 in `08-PAYMENTS.md`), not an architecture TBD.

## TBD-ARCH-005 — Transactional email

Select provider.

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
