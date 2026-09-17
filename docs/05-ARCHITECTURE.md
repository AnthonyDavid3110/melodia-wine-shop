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

Public route names should be French where useful because the public
application is French-only.

---

# 9. Administration

Expected routes:

    /admin
    /admin/commandes
    /admin/commandes/[id]
    /admin/produits
    /admin/vendeurs
    /admin/preparation
    /admin/paiements
    /admin/statistiques
    /admin/exports
    /admin/parametres

Admin pages require authentication.

Authorization must be enforced server-side.

Hiding a button in the UI is not authorization.

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

---

# 20. Checkout trust boundary

The browser may submit:

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

---

# 22. Payment architecture

Payment integration must use an application abstraction.

Conceptually:

    PaymentProvider

        createPayment()
        getPaymentStatus()
        handleWebhook()
        refundPayment()

Business code should interact with this abstraction rather than scattering
provider-specific calls throughout the application.

Example:

    CheckoutService
        │
        ▼
    PaymentProvider
        │
        ├── Stripe adapter
        │
        └── Worldline adapter

Only one provider needs to be implemented in V1.

The abstraction exists to keep provider-specific code isolated.

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

---

# 61. Technical decisions still to make

## TBD-ARCH-003 — Authentication

Evaluate an appropriate admin-only authentication solution.

## TBD-ARCH-004 — Payment provider

Evaluate providers supporting:

    TWINT + cards

This decision is detailed in `08-PAYMENTS.md`.

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
