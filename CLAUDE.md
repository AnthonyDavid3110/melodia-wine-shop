# CLAUDE.md — Melodia Wine Shop

## 1. Project

Melodia Wine Shop is the web application powering the annual fundraising
wine sale of Ensemble de Cuivres Mélodia (ECM), Switzerland.

Public campaign name:

    Les Vins de Mélodia

Public production URL:

    https://vins.ecmelodia.ch

The application combines:

- public wine catalogue;
- cart and guest checkout;
- TWINT and card payments;
- payment to ECM sellers;
- paper/manual order entry;
- seller attribution and objectives;
- preparation and delivery workflows;
- seller-to-ECM financial reconciliation;
- administration;
- PDFs and CSV exports;
- annual campaign reuse.

The application is specified before implementation.

Do not redesign the product from scratch.

---

# 2. First rule

Before modifying the project:

1. read this file;
2. identify which specification documents apply;
3. inspect the existing implementation;
4. understand the current implementation phase;
5. make the smallest coherent change that satisfies the task.

Do not implement the entire specification unless explicitly instructed.

---

# 3. Documentation

Authoritative specifications are located in:

    docs/

Files:

    01-PRODUCT-SPEC.md
    02-BUSINESS-RULES.md
    03-USER-FLOWS.md
    04-DATA-MODEL.md
    05-ARCHITECTURE.md
    06-ADMIN-SPEC.md
    07-DESIGN-SYSTEM.md
    08-PAYMENTS.md
    09-SECURITY.md
    10-IMPLEMENTATION-PLAN.md

Do not duplicate these documents inside this file.

Read the relevant source document instead.

---

# 4. Documentation map

## Product behaviour

Read:

    docs/01-PRODUCT-SPEC.md

Use for:

- V1 scope;
- customer experience;
- campaign behaviour;
- product rules;
- seller model;
- delivery model;
- success criteria.

---

## Business rules

Read:

    docs/02-BUSINESS-RULES.md

Use before implementing or modifying:

- orders;
- products;
- bundles;
- sellers;
- prices;
- payments;
- cancellation;
- preparation;
- manual orders.

Business rules override implementation convenience.

---

## User flows

Read:

    docs/03-USER-FLOWS.md

Use before implementing:

- checkout;
- payment flows;
- admin workflows;
- preparation;
- seller workflows;
- campaign lifecycle.

Do not create UI flows that contradict documented flows.

---

## Data model

Read:

    docs/04-DATA-MODEL.md

Use before modifying:

- database schema;
- ORM models;
- migrations;
- relationships;
- financial state;
- audit records.

Historical order reproducibility is mandatory.

---

## Architecture

Read:

    docs/05-ARCHITECTURE.md

Use before modifying:

- project structure;
- external integrations;
- database access;
- provider abstractions;
- server/client boundaries.

The application is a modular monolith.

Do not introduce distributed architecture without explicit justification.

---

## Administration

Read:

    docs/06-ADMIN-SPEC.md

Use before implementing:

- dashboard;
- order management;
- sellers;
- preparation;
- payments;
- settlements;
- statistics;
- exports.

Admin UX prioritizes operational clarity.

---

## Design

Read:

    docs/07-DESIGN-SYSTEM.md

Use before implementing any significant UI.

The design must feel:

    premium
    contemporary
    warm
    editorial
    intentional

It must not look like a generic generated application.

---

## Payments

Read the entire file:

    docs/08-PAYMENTS.md

before modifying:

- TWINT;
- card payments;
- Worldline;
- payment states;
- refunds;
- payment retries;
- webhooks;
- seller collections;
- settlements.

Payment code is security-critical.

Do not implement it from memory.

---

## Security

Read:

    docs/09-SECURITY.md

before modifying:

- authentication;
- authorization;
- payments;
- webhooks;
- file uploads;
- exports;
- customer data;
- secrets;
- protected mutations.

---

## Implementation order

Read:

    docs/10-IMPLEMENTATION-PLAN.md

before starting a new implementation phase.

Do not skip phases merely to produce visible results faster.

---

# 5. Specification vocabulary

Specifications use:

    DECIDED
    TBD
    V2

Meaning:

## DECIDED

Validated project decision.

Implementation must follow it unless the user explicitly changes the
decision.

## TBD

Decision is unresolved.

Do not silently invent an irreversible business decision.

If blocking:

    stop and ask.

If non-blocking:

    isolate the placeholder clearly.

## V2

Explicitly outside V1.

Do not implement unless requested.

---

# 6. Conflict handling

If two specification documents appear to conflict:

1. identify the conflict;
2. determine whether a later explicit decision resolves it;
3. if still ambiguous, stop;
4. explain the conflict concisely;
5. ask for the required decision.

Do not silently choose whichever rule is easier to implement.

---

# 7. Scope

V1 includes:

- annual campaigns;
- approximately six wines;
- individual bottle ordering;
- predefined bundles;
- guest checkout;
- optional seller selection;
- online TWINT;
- online cards;
- payment to seller;
- manual paper-order entry;
- seller objectives;
- seller financial reconciliation;
- preparation;
- delivery tracking;
- administration;
- PDFs;
- CSV exports;
- transactional confirmation email.

---

# 8. Explicit V1 exclusions

Do not implement unless explicitly requested:

    customer accounts
    seller accounts
    shipping
    inventory management
    multiple delivery waves
    custom bundles
    quantity discounts
    coupons
    newsletters
    marketing automation
    product reviews
    wishlist
    subscriptions
    recurring payments
    gift cards
    multi-currency
    dark mode
    AI features
    microservices
    Kubernetes

Do not create speculative infrastructure for these features.

---

# 9. Core business principles

## Orders

Order is the central commercial entity.

Do not make the domain model provider-specific.

Bad:

    StripeOrder
    WorldlineOrder

Good:

    Order
    Payment

---

## Campaigns

Campaign is a first-class entity.

The application must support reuse for future annual wine sales without
duplicating the application.

---

## Products

Customers may order individual bottles in any positive quantity.

There is:

    no minimum order
    no multiple-of-six requirement

Physical cartons are a logistics concern, not an ordering constraint.

---

## Bundles

Bundles have:

    fixed composition
    fixed campaign price

Customers cannot customize predefined bundles.

Historical bundle composition must be preserved with the Order.

---

## Sellers

Seller selection is optional.

Approximately 70 sellers may exist.

Use searchable selection rather than a large static dropdown.

V1 rule:

    seller = delivery person

Orders without seller remain valid and must be visible as:

    unassigned

---

# 10. Payment invariants

These rules are non-negotiable.

## Rule 1

The browser never determines the authoritative payment amount.

## Rule 2

The browser never marks an Order as paid.

## Rule 3

Online payment success requires trusted provider confirmation.

## Rule 4

Provider callbacks/webhooks must be authenticated according to official
provider documentation.

## Rule 5

Webhook processing must be idempotent.

## Rule 6

Payment amount and currency must match the expected Order.

## Rule 7

Payment retries must not create duplicate fulfilment Orders.

## Rule 8

Never store:

    card number
    CVC
    CVV
    TWINT credentials

## Rule 9

Provider-specific states must be translated into application domain
states.

## Rule 10

Financial anomalies must be surfaced rather than silently corrected.

---

# 11. Customer payment vs seller settlement

Never collapse these concepts.

For seller payments there are two financial transitions:

    Customer
        ↓
    Seller

and:

    Seller
        ↓
    ECM / Treasurer

Order therefore tracks separately:

    customerPaymentStatus

and:

    sellerSettlementStatus

Example:

    customerPaymentStatus = PAID
    sellerSettlementStatus = PENDING

means:

    customer paid the seller
    seller has not yet remitted money to ECM

This distinction is fundamental.

---

# 12. Order status

V1 operational states:

    NEW
    CONFIRMED
    PREPARED
    HANDED_TO_SELLER
    DELIVERED
    CANCELLED

Payment status is independent.

Never infer:

    DELIVERED = PAID

or:

    PAID = DELIVERED

---

# 13. Customer payment status

V1 order-level values:

    PENDING
    PAID
    REFUNDED

Detailed technical payment states belong to Payment records.

---

# 14. Seller settlement status

V1 values:

    NOT_APPLICABLE
    PENDING
    SETTLED

Online-paid orders normally use:

    NOT_APPLICABLE

Seller-payment orders normally use:

    PENDING

until funds are remitted to ECM.

---

# 15. Money

All authoritative monetary calculations must use precise representation.

Preferred:

    integer minor units

Example:

    CHF 18.00
        =
    1800

Do not use unsafe floating-point arithmetic for financial state.

Centralize:

    calculations
    formatting
    conversions

---

# 16. Historical data

Historical Orders must remain reproducible.

Store Order-time snapshots where required.

Examples:

    customer information
    product name
    unit price
    bundle composition

Changing a product later must not change historical Orders.

---

# 17. Deletion

Do not normally physically delete:

    orders
    payments
    settlements
    historical campaign data

Use:

    cancellation
    deactivation
    archival

where appropriate.

---

# 18. Audit trail

Important actions must remain traceable.

Examples:

    order cancellation
    seller reassignment
    customer payment marked received
    settlement completion
    payment refund
    paid-order correction
    campaign closure

Do not silently rewrite financial history.

---

# 19. Manual orders

Paper orders are first-class Orders.

They must use the same domain and database as online Orders.

Use:

    source = MANUAL

Online:

    source = ONLINE

Do not build a parallel paper-order subsystem.

---

# 20. Preparation

Wine requirements are calculated from:

    individual bottles
    +
    bundle component snapshots

Example:

    50 discovery bundles
    containing 1 Chasselas each

contribute:

    +50 Chasselas

to wine requirements.

Do not automatically round authoritative requirements to cartons.

---

# 21. Admin

Admin is authenticated.

V1 uses one permission level.

All sensitive mutations require server-side authorization.

Hiding a button is not authorization.

---

# 22. Customer accounts

Customers do not authenticate.

Checkout is guest checkout.

Do not add registration/login to the customer journey.

---

# 23. Technical baseline

Expected stack:

    Next.js
    React
    TypeScript
    Tailwind CSS
    shadcn/ui
    PostgreSQL

Current preferred selections:

    ORM             Drizzle
    Database        Neon
    Hosting         Vercel
    Authentication Better Auth
    Payments        Worldline
    Email           Resend
    Storage         Vercel Blob
    Validation      Zod
    Tests           Vitest + Playwright

These provider choices must still respect any relevant `TBD` in the
specifications.

Do not assume production provider configuration exists until verified.

---

# 24. Provider abstractions

External providers should remain isolated.

Examples:

    PaymentProvider
    EmailProvider
    StorageProvider

Do not scatter vendor-specific API calls throughout:

    React components
    route handlers
    unrelated domain services

---

# 25. Server/client boundary

Prefer server-side execution for:

    database access
    authoritative pricing
    order creation
    payment operations
    authentication
    authorization
    admin mutations

Use client components only where browser interaction genuinely requires
them.

Do not turn the entire application into client components.

---

# 26. Validation

Validate all untrusted input server-side.

Preferred:

    Zod

Client validation improves UX but is never the security boundary.

Validate:

    forms
    IDs
    quantities
    seller
    campaign
    products
    admin mutations
    external events

---

# 27. Database

Use:

    PostgreSQL

Use migrations.

Migrations are committed to Git.

Do not modify production schema manually without corresponding migration
history.

Use database constraints for important invariants.

---

# 28. Transactions

Use database transactions for multi-record operations where partial state
would be harmful.

Examples:

    order creation
    payment confirmation
    settlement completion
    sensitive financial transitions

---

# 29. Security

Never:

    commit secrets
    expose server secrets to browser
    trust client prices
    trust client payment state
    render customer HTML unsafely
    expose admin mutations publicly
    log card information
    build custom payment cryptography
    build custom password cryptography

Read `09-SECURITY.md` for detailed requirements.

---

# 30. Personal data

Collect only data required for fulfilment.

Customer data includes:

    first name
    last name
    address
    postal code
    city
    email
    telephone
    optional delivery note

Avoid unnecessary personal data in:

    logs
    analytics
    URLs
    provider metadata

---

# 31. Design quality

The application must not look like a default component-library demo.

Do not blindly use:

    default shadcn styling
    card for every section
    huge border radius everywhere
    gradients everywhere
    glassmorphism
    excessive shadows
    meaningless dashboard charts
    generic AI marketing copy

Read:

    docs/07-DESIGN-SYSTEM.md

before broad UI implementation.

---

# 32. Public design

Public experience should feel:

    premium
    warm
    contemporary
    editorial
    crafted

The campaign should be recognizably connected to ECM.

Music references should remain subtle.

Avoid obvious wine and music clichés.

---

# 33. Mobile

Public UI is mobile-first.

Primary expected traffic includes:

    WhatsApp
    social media
    QR code

Treat approximately 375–430 px wide screens as a primary design target.

Do not design desktop first and merely shrink it.

---

# 34. Admin design

Admin prioritizes:

    clarity
    density
    speed
    confidence

Avoid decorative dashboard design that reduces operational usefulness.

Tables, filters and statuses must be easy to scan.

---

# 35. Accessibility

Target practical:

    WCAG 2.2 AA

Consider continuously:

    semantic HTML
    keyboard navigation
    visible focus
    labels
    contrast
    touch targets
    reduced motion
    status not conveyed by colour alone

---

# 36. Language

Public UI:

    French

Admin UI:

    French

Code:

    English

Technical documentation:

    English

Do not introduce mixed-language UI accidentally.

---

# 37. Swiss conventions

Use appropriate Swiss conventions.

Examples:

    CHF 120.–
    NPA
    Localité

Public copy should sound natural in Swiss French without forced
localisms.

---

# 38. Dependencies

Before installing a package, verify that it is justified.

Ask:

    Is this necessary?
    Is it maintained?
    Does the platform already solve it?
    Does it increase security risk?
    Does it increase client bundle size?
    Is there a simpler solution?

Do not install dependencies simply because generated code commonly uses
them.

---

# 39. Current information

For external providers and fast-changing technical products, do not rely
on stale knowledge.

Examples:

    Next.js
    Vercel
    Neon
    Better Auth
    Worldline
    Resend
    Vercel Blob

When provider/API behaviour matters:

    consult current official documentation

before implementation.

Do not invent API methods or configuration.

---

# 40. Worldline

Worldline is currently the preferred PSP.

Before production integration, confirm:

    actual ECM merchant contract
    exact Worldline product
    TWINT enabled
    Visa enabled
    Mastercard enabled
    sandbox access
    API credentials
    callback mechanism
    refund mechanism

If information is missing:

    stop before production-specific implementation

Do not guess.

---

# 41. Tests

Critical business logic requires tests.

Highest priority:

    order totals
    bundle decomposition
    wine requirements
    seller sales
    seller targets
    payment transitions
    webhook idempotency
    settlement calculations
    cancellation exclusion

Use tests to protect business invariants, not to chase arbitrary coverage
percentages.

---

# 42. End-to-end tests

Use end-to-end tests for critical flows where practical.

Priority:

    customer checkout
    manual order
    seller assignment
    offline payment
    settlement
    preparation
    payment return/callback flow

External payment-provider behaviour may require sandbox-specific tests.

---

# 43. Required checks

After a meaningful implementation change, run applicable checks.

At minimum:

    formatting
    lint
    typecheck
    relevant tests

Before declaring a major phase complete:

    production build

must also pass.

---

# 44. Never hide failures

Do not report:

    complete

when:

    tests fail
    typecheck fails
    build fails
    integration is mocked
    provider credentials are missing
    required functionality is stubbed

Report accurately:

    implemented
    tested
    mocked
    blocked
    remaining

---

# 45. Error handling

Design explicit states for:

    loading
    empty
    success
    validation failure
    server failure

Payment additionally requires:

    pending
    failed
    cancelled
    verification in progress

Do not rely on generic:

    Something went wrong

when a meaningful error can be shown.

---

# 46. Simplicity

This application does not need:

    microservices
    Redis by default
    Kafka
    Kubernetes
    complex event sourcing
    dedicated API service
    distributed job infrastructure

Expected campaign scale is modest.

Prefer simple, correct architecture.

---

# 47. Performance

Avoid obvious performance mistakes.

Examples:

    excessive client JavaScript
    unoptimized images
    unnecessary client components
    repeated database queries
    loading complete datasets unnecessarily

Do not introduce complex caching until a real need exists.

---

# 48. Git

Make coherent commits.

Good examples:

    feat: implement campaign catalogue
    feat: add manual order workflow
    feat: add seller settlement
    fix: prevent duplicate payment processing
    test: cover wine requirement calculation

Avoid meaningless commit messages.

Do not rewrite unrelated parts of the project during a scoped task.

---

# 49. Refactoring

Refactor when it materially improves:

    clarity
    correctness
    maintainability

Avoid speculative abstraction.

Three clear lines of code may be preferable to an unnecessary generic
framework.

---

# 50. Comments

Comments should explain:

    why

rather than restating:

    what

Prefer clear code over excessive explanatory comments.

Financial invariants and unusual provider behaviour may justify detailed
comments.

---

# 51. Implementation phases

Follow:

    docs/10-IMPLEMENTATION-PLAN.md

Current order:

    0  Repository foundation
    1  Design foundation
    2  Database/domain
    3  Admin authentication
    4  Campaign/catalogue admin
    5  Public catalogue
    6  Cart/checkout
    7  Order admin
    8  Offline payments/sellers
    9  Preparation/fulfilment
    10 Online payments
    11 Email
    12 Documents/exports
    13 Statistics/dashboard
    14 Security hardening
    15 Production
    16 Campaign content/launch

Do not jump directly to Phase 10 because payment integration looks
interesting.

---

# 52. Starting a phase

Before beginning a major phase, respond with a concise plan containing:

    scope
    relevant docs
    files/modules likely affected
    decisions required
    tests required

Do not produce a giant speculative plan.

Then implement the approved/appropriate phase.

---

# 53. Completing a phase

At the end of a phase report:

    what was implemented
    important decisions made
    tests/checks executed
    unresolved issues
    next recommended phase

Keep this factual.

---

# 54. Existing code

Once implementation begins, documentation is not permission to destroy
working code and regenerate everything.

Before changing existing functionality:

    inspect it
    understand it
    preserve valid behaviour
    make targeted changes

Do not replace complete modules simply because a different implementation
would be easier to generate.

---

# 55. Database migrations in existing environments

Never delete or recreate a production database to make a migration easier.

Development database reset may be acceptable only when clearly safe.

Production migrations must preserve existing commercial data.

---

# 56. Production safety

Before any production-sensitive operation:

    verify environment
    verify credentials
    verify target database
    verify provider mode

Never assume:

    sandbox == production

Payment and database operations deserve explicit environment awareness.

---

# 57. Placeholder policy

Placeholders are acceptable only when final campaign information is not
available.

Examples:

    wine photography
    final descriptions
    final producer data

Keep placeholders centralized and obvious.

Do not spread fake production content throughout components.

---

# 58. No fake data in production

Never seed production with:

    fake customers
    fake orders
    fake payments
    fake settlements

Production catalogue placeholder content may only be used intentionally
during pre-launch staging.

---

# 59. Public URL

Production:

    https://vins.ecmelodia.ch

The existing ECM website may remain on Wix independently.

Do not modify the main ECM website infrastructure unless explicitly
requested.

---

# 60. Final objective

The application succeeds when Ensemble de Cuivres Mélodia can run its
wine campaign from one reliable system.

The system must support:

    customer ordering
        ↓
    payment
        ↓
    seller attribution
        ↓
    wine requirements
        ↓
    central preparation
        ↓
    seller handoff
        ↓
    delivery
        ↓
    remaining payment collection
        ↓
    seller settlement
        ↓
    campaign closure

without maintaining a parallel operational order spreadsheet.

---

# 61. Quality bar

Do not optimize for:

    "Claude generated a working website"

Optimize for:

    "This could credibly be a professionally designed and implemented
    application used by a real Swiss association."

Correctness matters.

Design quality matters.

Operational usability matters.

Financial traceability matters.

Maintainability matters.

When these conflict with implementation speed, implementation speed is
secondary.
