# Melodia Wine Shop — Security

> Version: 0.1
> Status: Draft
> Related documents:
> - `01-PRODUCT-SPEC.md`
> - `02-BUSINESS-RULES.md`
> - `03-USER-FLOWS.md`
> - `04-DATA-MODEL.md`
> - `05-ARCHITECTURE.md`
> - `06-ADMIN-SPEC.md`
> - `08-PAYMENTS.md`

---

# 1. Purpose

This document defines the V1 security requirements for Melodia Wine Shop.

The application processes:

- customer personal data;
- postal addresses;
- email addresses;
- telephone numbers;
- orders;
- payment status;
- seller financial information;
- administrator accounts.

Security must be designed into the application rather than added only
before launch.

The objective is proportionate security for a small Swiss cultural
association operating a real e-commerce application.

---

# 2. Security principles

The project follows these principles:

    least privilege
    secure by default
    server-side validation
    explicit trust boundaries
    minimal data collection
    minimal secret exposure
    financial traceability
    defence in depth
    recoverability

Security controls should remain understandable and maintainable.

---

# 3. Threat model

Relevant realistic threats include:

- unauthorized admin access;
- credential theft;
- customer data exposure;
- order manipulation;
- price manipulation;
- fake payment confirmation;
- webhook spoofing;
- duplicate payment events;
- settlement manipulation;
- cross-site scripting;
- CSRF where relevant;
- SQL injection;
- malicious form submissions;
- brute-force authentication attempts;
- leaked API credentials;
- accidental administrator mistakes;
- vulnerable dependencies.

The architecture should prioritize these realistic threats.

---

# 4. Out-of-scope threat assumptions

V1 does not attempt to defend independently against every infrastructure
threat imaginable.

Managed providers are relied upon for parts of:

    physical infrastructure
    network infrastructure
    TLS
    database hosting
    payment infrastructure

Provider security does not remove the application's responsibility for
secure configuration and application logic.

---

# 5. Trust boundaries

Trusted application components:

    server-side application code
    database after validated access
    verified authenticated admin session
    cryptographically verified provider callbacks

Untrusted sources:

    browser input
    query parameters
    cookies before validation
    request headers
    form data
    client-side totals
    public API requests
    unverified webhooks
    uploaded files
    external URLs

Crossing a trust boundary requires validation.

---

# 6. Client-side trust

The browser is never trusted for authoritative business information.

The browser may submit:

    product IDs
    bundle IDs
    quantities
    seller ID
    customer information
    payment choice

The browser must not control:

    authoritative prices
    order totals
    payment status
    refund status
    settlement status
    campaign status
    admin permissions

These values are resolved or validated server-side.

---

# 7. Price manipulation

Example attack:

A customer modifies browser JavaScript so that:

    Chasselas
    CHF 18.–

becomes:

    CHF 0.01

The server must ignore the submitted price.

Correct flow:

    product ID
        ↓
    server
        ↓
    database CampaignProduct
        ↓
    authoritative price

The same rule applies to bundles.

---

# 8. Order total validation

Order totals must be calculated server-side.

Conceptually:

    total =
        sum(
            authoritative unit price
            ×
            validated quantity
        )

The payment provider receives this server-calculated amount.

Never accept a final amount directly from the browser.

---

# 9. Input validation

All external input must be validated.

Recommended validation library:

    Zod

Validation applies to:

- checkout forms;
- manual order forms;
- admin edits;
- route parameters;
- filters;
- campaign configuration;
- seller assignments;
- quantities;
- payment callbacks after authenticity validation;
- environment configuration.

Client-side validation improves UX but does not replace server-side
validation.

---

# 10. Input normalization

Where appropriate, normalize data before persistence.

Examples:

    trim names
    normalize email casing where appropriate
    trim telephone numbers
    reject impossible quantities

Normalization must not unexpectedly alter meaningful customer data.

---

# 11. Quantity validation

Product quantities must be:

    integer
    >= 0

Order items actually created must have:

    quantity > 0

Reasonable upper bounds should be considered to prevent accidental or
malicious extreme values.

The exact limit may be configurable or sufficiently high for legitimate
large orders.

---

# 12. SQL injection

Database access must use parameterized ORM/database queries.

Do not construct SQL by concatenating untrusted strings.

If raw SQL is required:

- parameterize values;
- review carefully;
- keep use exceptional.

---

# 13. Cross-site scripting

Customer-provided text must not be rendered as trusted HTML.

Examples:

    customer name
    delivery note
    address

must be treated as plain text.

Avoid unsafe HTML rendering mechanisms such as:

    dangerouslySetInnerHTML

with untrusted content.

If rich content becomes necessary later, it must be sanitized explicitly.

---

# 14. Admin authentication

All `/admin` functionality requires authentication.

Authentication must be enforced server-side.

Unauthenticated users must not be able to call protected mutations
directly even if they know the endpoint.

---

# 15. Admin accounts

V1 admin accounts are limited to people who genuinely require access.

Do not create shared credentials such as:

    admin@...
    password shared by committee

Each administrator should have an individual account.

This improves:

- revocation;
- accountability;
- audit history.

---

# 16. Admin account lifecycle

Admin accounts must support:

    activation
    deactivation

When an administrator no longer requires access:

    active = false

or the equivalent authentication-provider mechanism should revoke access.

Historical audit events remain linked to that administrator.

---

# 17. Password handling

If password authentication is used:

- passwords must never be stored in plaintext;
- use the authentication framework's secure password hashing;
- do not implement custom password cryptography;
- do not log passwords;
- do not email passwords.

Prefer mature authentication-library functionality.

---

# 18. Multi-factor authentication

MFA is desirable for administrators because the admin interface exposes
customer and financial information.

If the selected authentication solution supports MFA cleanly, it should
be enabled or strongly considered.

MFA must not be custom-built.

Production launch should at minimum use strong individual administrator
authentication.

---

# 19. Sessions

Admin sessions must use secure session handling.

Requirements include where applicable:

    Secure cookies
    HttpOnly cookies
    appropriate SameSite policy
    session expiration
    server-side session validation

Do not store sensitive authentication tokens in localStorage if a safer
session mechanism is available.

---

# 20. Authorization

Authentication answers:

    Who are you?

Authorization answers:

    Are you allowed to do this?

Even though V1 has one admin permission level, protected actions must
verify authorization server-side.

Examples:

    cancel order
    modify product
    mark payment received
    create settlement
    export customer data

---

# 21. CSRF

State-changing authenticated requests must use framework/authentication
protections appropriate to the selected architecture.

If cookies authenticate admin requests, CSRF risk must be explicitly
considered.

Do not assume that:

    POST = safe

by itself.

The final mechanism depends on Better Auth / Next.js integration.

---

# 22. Public order lookup

Do not expose complete customer orders through easily enumerable public
URLs.

Unsafe example:

    /commande/1
    /commande/2
    /commande/3

A public order number such as:

    ECM-2026-0042

is not itself a secret.

Knowing an order number must not automatically grant access to sensitive
customer information.

---

# 23. Confirmation page privacy

The public confirmation page should display only information appropriate
for the customer who just completed the flow.

Avoid creating permanently public order-detail pages containing:

    full address
    email
    telephone

If a future order-tracking feature is added, it requires an appropriate
secure access mechanism.

---

# 24. Admin IDs

Internal database IDs should not be treated as authorization controls.

A request for:

    /admin/commandes/<id>

must still verify admin authorization.

UUIDs or non-sequential IDs may reduce accidental enumeration but do not
replace access control.

---

# 25. Payment security

Payment-specific security requirements are detailed in
`08-PAYMENTS.md`.

Core rules:

- Melodia never stores card numbers;
- Melodia never stores CVC/CVV;
- browser return does not mark payment paid;
- provider callbacks require authenticity verification;
- amount and currency are validated;
- callbacks are idempotent;
- payment credentials remain server-side.

---

# 26. Webhook endpoint

Payment webhook endpoint is publicly reachable by necessity.

Publicly reachable does not mean trusted.

The endpoint must:

1. receive request;
2. preserve any raw data required for signature verification;
3. verify provider authenticity;
4. validate event structure;
5. identify duplicate events;
6. validate payment/order relationship;
7. validate amount and currency where applicable;
8. perform allowed state transition;
9. persist atomically where appropriate;
10. return controlled response.

## Phase 10 Gate 10C-B1 implementation (adopted)

Saferpay's `SuccessNotifyUrl`/`FailNotifyUrl`
(`GET /api/payments/saferpay/notify/[token]`) is unsigned — there is no
provider signature to verify (confirmed against current official
Saferpay documentation, not assumed). Authenticity therefore rests on a
different model than a signed webhook:

1. correlation via the existing 256-bit opaque `payments.return_token`
   (the same token already used in the public `ReturnUrl`) — no second
   notification-specific token;
2. the callback is NEVER itself authoritative — it only triggers the
   existing `confirmOnlinePayment()`, which re-derives truth from
   `PaymentPage/Assert`/`Transaction/Capture` before any state change
   (docs/08-PAYMENTS.md §72.3);
3. a malformed or unknown token performs no provider call and mutates
   nothing (HTTP 200, so Saferpay does not retry something that can
   never resolve) — token validity is never revealed in the response;
4. duplicate delivery is safe — the underlying reconciliation is already
   idempotent (Gate 10C-A's `SELECT ... FOR UPDATE` + Saferpay's own
   Capture idempotency), so a repeated callback is a no-op;
5. amount/currency are re-validated inside `confirmOnlinePayment()`
   exactly as for the browser return path — unchanged.

**No rate limiter was added** — the opaque token is unguessable, an
early DB lookup happens before any provider call (bounding the cost of
a replay to one cheap read once the Payment is terminal), and the
payment session's own short lifetime further bounds the window. Revisit
only if real abuse is observed (§40/§42 below).

**CSRF protection does not apply** to this route — it carries no ambient
cookie/session authentication for a forged request to exploit, and even
a successfully "forged" call only ever triggers a harmless re-Assert,
never a forced state change.

## Phase 10 Gate 10C-B2 verification (adopted)

The properties above were re-confirmed against a real, publicly
reachable staging deployment and the real Saferpay TEST environment
(never simulated) — see `08-PAYMENTS.md` §73 for the full acceptance
results:

- the hosted Payment Page kept card/TWINT entry entirely on Saferpay's
  own page — the staging deployment never received or transmitted
  PAN/CVV at any point;
- Basic Authentication credentials (`SAFERPAY_API_USERNAME`/
  `SAFERPAY_API_PASSWORD`) remained server-side environment
  configuration only, never observed in browser-reachable code or
  responses;
- the callback token was confirmed to function purely as routing/
  correlation, not as proof of payment — the notify route's own call to
  `PaymentPage/Assert` is what determined the outcome in every case,
  independently re-verified against Saferpay's own authoritative record
  for all three scenarios in `08-PAYMENTS.md` §73;
- both `NotifyUrl` and `ReturnUrl` were independently confirmed to reach
  the identical trusted-success code path via `Assert`, including under
  a genuine, unsuppressed race (§73.2);
- a real aborted Saferpay session never produced a locally paid/
  confirmed Order (§73.3), confirming no local success is ever derived
  from browser state alone;
- staging used Saferpay TEST credentials exclusively — no production
  credential or production merchant terminal was used at any point.

---

# 27. Webhook secrets

Webhook/API secrets must exist only in protected server-side
configuration.

Never expose them through:

    NEXT_PUBLIC_*

or equivalent client-side environment variables.

---

# 28. Secrets management

Secrets include:

    database credentials
    auth secret
    Worldline credentials
    webhook secrets
    email API keys
    storage credentials

Production secrets belong in the deployment platform's secret/environment
management.

They must not exist in Git.

---

# 29. Environment variable naming

Client-exposed variables must be clearly distinguished from server-only
variables.

Only genuinely public configuration may use framework mechanisms that
expose values to the browser.

Example safe public value:

    NEXT_PUBLIC_APP_URL

Example unsafe public value:

    NEXT_PUBLIC_DATABASE_PASSWORD

The latter must never exist.

---

# 30. .env files

Local `.env` files containing real credentials must be ignored by Git.

Repository may contain:

    .env.example

with empty/example values only.

Before first production deployment, verify Git history does not contain
accidentally committed secrets.

---

# 31. Secret rotation

If a secret is accidentally exposed:

1. consider it compromised;
2. rotate/revoke it immediately;
3. update deployment configuration;
4. investigate exposure;
5. remove it from current files;
6. clean repository history where appropriate.

Deleting the visible line from the latest commit is not sufficient by
itself.

---

# 32. Database access

Production database should not be publicly administered with weak or
shared credentials.

Use provider-recommended secure connection mechanisms.

Database credentials used by the application should have only the
permissions required by the application.

---

# 33. Database constraints

Security and integrity should not rely exclusively on UI logic.

Important database constraints should enforce invariants such as:

    unique order number
    positive quantities
    valid relationships
    unique provider event IDs
    unique campaign/product relationship

This provides defence in depth against application bugs.

---

# 34. Transactions

Financially sensitive multi-record mutations should use database
transactions where appropriate.

Examples:

    order creation
    payment confirmation
    settlement creation/completion
    cancellation/refund state changes

Avoid partial financial state.

---

# 35. Personal data

V1 stores only personal data needed to fulfil orders.

Required customer information:

    first name
    last name
    address
    postal code
    city
    email
    telephone

Optional:

    delivery note

Do not collect personal data merely because it may be useful someday.

---

# 36. Sensitive data minimization

Do not store:

    date of birth
    identity document
    payment card data
    unnecessary customer profiling
    marketing preferences

unless a future legitimate requirement explicitly introduces them.

---

# 37. Privacy by design

Personal information should only appear where operationally necessary.

Examples:

Admin order detail:

    full customer information

Preparation sheet:

    only information necessary for preparation/delivery

Statistics:

    aggregated data where possible

Logs:

    avoid personal information

---

# 38. Logging and personal data

Avoid logs such as:

    Checkout failed for
    Jean Dupont,
    Rue Example 12,
    079 XXX XX XX

Prefer:

    Checkout validation failed
    orderAttemptId=...

Logs should contain enough technical context to troubleshoot without
becoming a duplicate customer database.

---

# 39. Error messages

Public errors must not expose:

    stack traces
    SQL
    internal file paths
    provider secrets
    database IDs unnecessarily
    environment values

Example bad response:

    Prisma error P2002 on PostgreSQL...

Example better response:

    La commande n'a pas pu être enregistrée.
    Veuillez réessayer.

Detailed diagnostics belong in protected logs.

---

# 40. Rate limiting

Public endpoints vulnerable to automated abuse should be evaluated for
rate limiting.

Candidates:

    checkout creation
    authentication
    payment initiation
    public forms

Rate limiting should not unnecessarily block legitimate customers behind
shared mobile networks.

Exact implementation depends on deployment architecture.

---

# 41. Authentication brute force

The selected authentication system should provide or support protection
against repeated login attempts.

Possible controls:

    rate limiting
    temporary lockout
    provider protections
    MFA

Do not implement a fragile custom anti-brute-force mechanism if the auth
provider already solves it.

---

# 42. Bot protection

A CAPTCHA is not required by default.

Introduce bot protection only if abuse demonstrates a need.

Do not degrade checkout UX pre-emptively.

If required later, prefer a privacy-conscious managed solution.

---

# 43. File uploads

If admin can upload product images:

Allowed file types must be restricted.

Expected:

    JPEG
    PNG
    WebP

Possibly:

    AVIF

Validate:

    MIME type
    file size
    image processing compatibility

Do not trust filename extension alone.

---

# 44. Uploaded filenames

Do not directly use arbitrary uploaded filenames as trusted storage paths.

Generate controlled storage identifiers.

Avoid:

    ../../something

or filename-based path traversal risks.

---

# 45. Image metadata

Consider stripping unnecessary image metadata during processing where the
selected image platform supports it.

Product images do not require camera GPS/EXIF metadata.

---

# 46. CSV exports

CSV exports contain customer information and must require authenticated
admin access.

Exports must not be exposed through permanent public URLs.

Generated CSV content should also consider spreadsheet formula injection.

Customer-controlled values beginning with dangerous spreadsheet formula
characters should be safely encoded/escaped where necessary.

---

# 47. CSV formula injection

Values beginning with characters such as:

    =
    +
    -
    @

can be interpreted as formulas by spreadsheet software.

Because customer names/notes may theoretically contain arbitrary input,
CSV generation should neutralize formula injection where applicable.

---

# 48. PDF generation

PDF documents containing customer information must be generated only for
authorized administrative operations or appropriate customer flows.

Temporary document URLs must not become permanently public searchable
resources.

---

# 49. Admin exports

Large bulk exports expose more personal information than normal admin
pages.

Therefore export actions should:

- require authentication;
- be logged where useful;
- avoid unnecessary fields;
- not be cached publicly.

---

# 50. HTTP security headers

Production should use appropriate HTTP security headers.

Evaluate at minimum:

    Content-Security-Policy
    Strict-Transport-Security
    X-Content-Type-Options
    Referrer-Policy
    Permissions-Policy

Frame protection should also be considered.

Exact configuration depends on payment integration and external assets.

---

# 51. Content Security Policy

A CSP should be introduced carefully.

It must permit legitimate resources such as:

    payment provider
    selected fonts
    image storage

without becoming:

    allow everything

Do not weaken CSP globally simply to solve one integration issue.

---

# 52. HTTPS

Production traffic must use HTTPS.

HTTP should redirect to HTTPS.

TLS certificate management should be handled by the hosting platform.

Do not serve authentication, checkout or payment flows over plaintext
HTTP.

---

# 53. CORS

Do not enable permissive CORS globally without a requirement.

Unsafe default:

    Access-Control-Allow-Origin: *

for authenticated/private APIs.

Most application operations should remain same-origin.

Provider webhooks do not require permissive browser CORS.

---

# 54. Dependency security

Dependencies should be kept reasonably current.

Before production launch:

    npm audit

or equivalent tooling should be reviewed.

Do not blindly upgrade major versions immediately before launch without
testing.

Do not blindly ignore high-impact vulnerabilities either.

---

# 55. Dependency minimization

Every dependency adds:

    code
    maintenance
    supply-chain exposure

Do not install packages for trivial functionality that can be implemented
clearly with existing platform capabilities.

Avoid giant utility libraries for one small helper.

---

# 56. Lockfile

The package-manager lockfile must be committed.

This provides reproducible dependency resolution.

Example:

    pnpm-lock.yaml

or equivalent depending on selected package manager.

---

# 57. Package scripts

Production build must not execute arbitrary unreviewed scripts from
unknown dependencies.

Dependencies added by coding assistants must still be reviewed.

Claude Code must not install packages merely because they simplify a few
lines of generated code.

---

# 58. Coding assistant security

AI-generated code must be treated as untrusted until reviewed.

Particular review attention is required for:

    authentication
    authorization
    payment code
    webhook verification
    database mutations
    file uploads
    exports
    redirects
    secret handling

Claude Code must follow project security requirements rather than invent
shortcuts to make a feature work.

---

# 59. Open redirects

Redirect destinations derived from request input must be validated.

Do not permit arbitrary:

    ?returnUrl=https://malicious.example

after login or payment.

Prefer known internal destinations or an explicit allowlist.

---

# 60. Email security

Transactional emails must not contain:

    passwords
    API keys
    card data
    sensitive authentication tokens

Order confirmation emails may contain normal order information required
by the customer.

Avoid exposing unnecessary internal IDs.

## Phase 11 Gate 11A implementation (adopted)

`src/domain/email/order-confirmation-content.ts`'s pure content builder
is the single place email content is assembled, and is unit-tested
directly against this requirement: no internal database ID, no
provider transaction ID, no Saferpay/TWINT identifier, no payment
token/credential ever appears in either the HTML or plain-text output
(see `order-confirmation-content.test.ts`'s dedicated tests). The
`EmailProviderRejectedError`/`EmailNetworkError`/`EmailConfigurationError`
classes thrown by `resend-provider.ts` never surface the raw provider
response, the API key, or `Authorization` header — only a sanitized
message and, for a genuine provider rejection, the provider's own
short error *name* (e.g. `validation_error`), never its full body.

Customer-controlled and catalogue-snapshot text alike (customer name,
address, delivery note, product name snapshots) is escaped through a
small dedicated `escapeHtml()` (`src/domain/email/escape-html.ts`)
before being interpolated into the HTML output — no template/rendering
framework, no `dangerouslySetInnerHTML`-equivalent, applying the
existing "customer-provided text is never trusted HTML" principle
(§13 above) to email HTML specifically. Covered by dedicated tests
proving HTML special characters in customer input cannot inject
markup.

## Phase 11 Gate 11B implementation (adopted)

`dispatchOrderConfirmationEmail()` (`src/infrastructure/email/
order-confirmation.ts`) records exactly two new `OrderEvent` types —
`EMAIL_SENT` / `EMAIL_FAILED` — with metadata limited to
`{emailType, variant}` (success) or `{emailType, variant, category}`
(failure, `category` one of `configuration` / `provider-rejected` /
`network` / `unknown`, never the provider's raw message/body, never a
stack trace). Neither the email subject, HTML, nor plain-text body is
ever persisted. Verified directly: dedicated unit tests assert a
rejected-provider error's raw message string never appears anywhere in
the recorded event.

**Real-credential test-safety finding (Gate 11B):** `.env.local` now
holds real, working Resend credentials (manually configured before this
gate, confirmed by a real smoke-test send). Two pre-existing mechanisms
load `.env.local` automatically — `vitest.setup.ts` for every
`pnpm test:db` run, and Next.js's own loading for `pnpm dev` (which
`playwright.config.ts`'s `webServer` spawns) — so, without action, both
the DB integration suite and the E2E suite would be able to reach the
real Resend API the moment dispatch became automatic. Addressed by two
independent, already-established mechanisms, never a new one invented
for this:

- `playwright.config.ts`'s `webServer.env` now also sets
  `E2E_FAKE_EMAIL_PROVIDER=true`, alongside the pre-existing
  `E2E_FAKE_PAYMENT_PROVIDER=true` — the whole E2E suite runs against
  the double-gated fake email provider, never Resend.
- DB integration test files that use the real, durably-committing `db`
  handle (required for `dbHandle === db` dispatch eligibility to fire
  at all) `vi.mock("@/infrastructure/email/resend-provider", ...)` —
  the identical technique this suite already used for
  `@/infrastructure/payments/saferpay-client` before Gate 11B existed.
  The ~15 other DB integration suites, which exercise `createOrder()`/
  `confirmOnlinePayment()` only through a `withRollback()` savepoint,
  require no change at all: the `dbHandle === db` guard itself already
  excludes them from ever attempting dispatch.

## Phase 11 Gate 11C implementation (adopted)

The admin "Renvoyer la confirmation" action
(`resendOrderConfirmationAction`,
`src/app/admin/(protected)/commandes/[id]/actions.ts`) is a protected
Server Action: it calls `requireAdmin()` first and unconditionally,
exactly like every other order-mutating admin action in this file
(`cancelOrderAction`, `markPaymentReceivedAction`, …). Hiding the button
for an unauthenticated/unauthorized caller is a UX convenience, never
the enforcement boundary (§21 above).

**Recipient and variant are always server-derived, never accepted from
the browser.** The Server Action takes only `orderId` (from the page's
existing route param) — no recipient, subject, body, or variant field
exists anywhere in the request. `resendOrderConfirmation()`
(`src/infrastructure/email/order-confirmation.ts`) independently
re-reads the order, its items and its payments from the database inside
the action, and re-runs `resolveOrderConfirmationEligibility()`
(`src/domain/email/resolve-confirmation-eligibility.ts`) against that
freshly-read state — it never trusts a client-supplied eligibility
result, never trusts prior `EMAIL_SENT` history, and never trusts
`order.source`. This matches Gate 11B's principle for automatic
dispatch (§60 above) applied to the manual path.

**Manual-resend idempotency — a deliberately narrower guarantee than
automatic dispatch, documented rather than engineered around.** Each
authenticated invocation of `resendOrderConfirmationAction` generates a
fresh, server-side, non-PII `randomUUID()` and derives the Resend
`Idempotency-Key` as `order-confirmation/resend/${orderId}/${attemptId}`
— never accepted from the browser, never persisted for lookup. This
protects a single invocation from being internally retried twice by the
Resend client, but — unlike the automatic path's stable
`order-confirmation/${orderId}` key — it does **not** prevent two
separate Server Action invocations (e.g. a genuine browser replay, or an
admin clicking twice in two tabs) from each sending a real email. This
was an explicit, approved scope decision: Gate 11C intentionally does
not add a database table, row lock, or durable request token purely to
provide stronger cross-request idempotency for an admin-initiated,
low-frequency, already-audited action. The UI mitigates the common case
by disabling the confirm button while the action is pending.

**Audit trail reuses the existing `EMAIL_SENT`/`EMAIL_FAILED`
`OrderEvent` types and columns — no new PII, no new table.** Every event
now carries `trigger: "AUTOMATIC" | "ADMIN_RESEND"` in `metadata`
(existing Gate 11B events recorded before this gate have no `trigger`
key and are treated as legacy/automatic by the admin UI — never
rewritten, per §17/§18 above). For `ADMIN_RESEND`, `actorType = "ADMIN"`
and `adminUserId` is set to the authenticated admin's own ID, reusing
`orderEvents`' existing actor columns exactly as other admin actions
already do (e.g. `markPaymentReceivedAction`) — no admin email or name
is written into `metadata`.

**Failure feedback never exposes provider internals.** On
`EmailConfigurationError`/`EmailProviderRejectedError`/`EmailNetworkError`,
the Server Action returns a single fixed French sentence ("L'e-mail de
confirmation n'a pas pu être envoyé. Veuillez réessayer.") and records
`EMAIL_FAILED` with the same sanitized `{emailType, variant, category}`
metadata shape Gate 11B already established (§60 above) — never the raw
provider message, response body, or stack trace. A failed send never
mutates `order.status`, `customerPaymentStatus`, or
`sellerSettlementStatus` (§10 Rule 10 above): the send is attempted
strictly after all order state has already been read, and no write to
`orders` occurs anywhere in this code path.

**Test safety.** The new DB integration suite
(`resend-confirmation.db.test.ts`) is the one `withRollback()`-based
suite that can reach real dispatch code, because
`resendOrderConfirmation()` has no `dbHandle === db` gate (manual resend
must work inside whatever transaction the caller uses); it therefore
`vi.mock`s `@/infrastructure/email/resend-provider` the same way the
~4 real-`db` Gate 11B suites already do (§60 above). The new E2E spec
(`resend-confirmation.spec.ts`) runs, like every other E2E spec, against
`E2E_FAKE_EMAIL_PROVIDER=true` — no automated test in this repository
can reach the real Resend API.

---

# 61. Email sender

Transactional email should use an ECM-controlled domain.

SPF, DKIM and DMARC configuration should be considered as part of
production email setup.

This improves deliverability and reduces spoofing risk.

Exact DNS configuration depends on selected email provider.

## Phase 11 Gate 11A implementation (adopted)

Provider selected: Resend (`05-ARCHITECTURE.md` TBD-ARCH-005, resolved).
`RESEND_API_KEY`/`EMAIL_FROM` are server-only environment variables
(`src/lib/env.ts`), never `NEXT_PUBLIC_*`, asserted only at the point a
real send is attempted (`resend-provider.ts`'s `getResendConfig()`) —
never at module load, matching every other secret in this project.

## Domain verification (manual, outside Gate 11A/11B code)

`ecmelodia.ch` is verified in Resend (sending region: Ireland/
`eu-west-1`), with the required Resend DNS records configured and
verified in the authoritative Wix DNS zone, alongside the existing
Infomaniak mail infrastructure — confirmed working by a real, manually
authorized smoke-test send (Gate 11A) before Gate 11B wired any
automatic dispatch. `EMAIL_FROM` is `Les Vins de Mélodia
<vins@ecmelodia.ch>`. This is infrastructure/DNS configuration, not
application code — no source file in this repository performs or
depends on the DNS setup itself.

---

# 62. Admin action audit

Important admin actions should create an audit event.

Examples:

    seller changed
    order cancelled
    customer payment marked paid
    settlement completed
    paid order modified
    campaign closed

Audit data should include:

    action
    timestamp
    administrator
    affected entity

where appropriate.

---

# 63. Audit integrity

Normal administrators should not be given a UI for arbitrarily rewriting
audit history.

Corrections should create new events rather than rewriting old history.

---

# 64. Manual payment risk

A major V1 operational risk is an administrator accidentally marking an
offline payment as received.

The UI should require an explicit action.

Example:

    Marquer CHF 196.– comme encaissé ?

    [ Annuler ]
    [ Confirmer l'encaissement ]

This action must be audited.

---

# 65. Settlement risk

Settlement completion means ECM acknowledges receipt of seller funds.

Therefore completion requires explicit confirmation.

Example:

    Confirmer la réception de CHF 400.–
    de Anthony David ?

The amount must be application-calculated.

The action is audited.

---

# 66. Destructive actions

Potentially destructive actions require confirmation.

Examples:

    cancel order
    close campaign
    archive campaign

Physical deletion of historical orders should not exist in normal admin
UI.

---

# 67. Paid order editing

Once an online order has been successfully paid, monetary data should not
be casually editable.

V1 rule:

    non-monetary corrections
        may be allowed

    monetary corrections
        require explicit financial workflow

Examples of non-monetary correction:

    telephone typo
    delivery note
    seller reassignment

Examples of monetary correction:

    quantity
    product
    bundle
    price

Normal edit UI should block the second category for paid online orders.

---

# 68. Campaign race condition

Scenario:

1. customer starts checkout;
2. campaign is active;
3. admin closes campaign;
4. customer submits checkout.

Server must revalidate campaign state at order creation.

Client state from step 2 is insufficient.

---

# 69. Product race condition

Scenario:

1. customer adds wine at CHF 18.–;
2. admin changes price;
3. customer checks out.

Server must use current authoritative campaign pricing at checkout.

If the amount differs from what the customer saw, the application should
handle the situation transparently rather than silently charging a
different unexpected total.

Exact UX will be defined during implementation.

---

# 70. Seller race condition

Scenario:

1. customer selects seller;
2. seller is deactivated;
3. customer submits.

Server revalidates seller eligibility.

If invalid, customer should be asked to select another seller or continue
unassigned.

---

# 71. Duplicate order protection

Checkout should protect against accidental duplicate submission.

Possible mechanisms include:

    idempotency key
    server-generated checkout token
    controlled form submission

Exact implementation will be chosen during development.

---

# 72. Backups

Production database must have reliable backups.

Provider selection should support:

    automated backup

and preferably:

    point-in-time recovery

where economically reasonable.

A backup strategy must be confirmed before launch.

---

# 73. Restore testing

A backup that cannot be restored is not useful.

Before or shortly after production launch, document how database recovery
would work with the selected provider.

For this project's scale, a formal disaster-recovery exercise is not
required, but the recovery procedure must be understood.

---

# 74. Availability

The application does not require banking-grade availability.

However, during the active sales campaign:

- storefront availability matters;
- checkout availability matters;
- payment callbacks matter.

Managed infrastructure should reduce avoidable downtime.

---

# 75. Failure isolation

Failure of one external provider should not corrupt unrelated data.

Examples:

    email failure
        ≠
    order deletion

    PDF failure
        ≠
    payment rollback

    image storage failure
        ≠
    seller settlement failure

---

# 76. Privacy and legal review

Before production launch, ECM should verify the required public legal
information for the Swiss context.

Potential topics include:

    privacy notice
    organisation identity/contact information
    sales conditions
    payment conditions
    delivery conditions
    cancellation/refund policy

Exact legal wording is outside this technical specification and must not
be invented by the implementation.

---

# 77. Data retention

Exact personal-data retention policy is TBD.

Orders may need to be retained for legitimate:

    accounting
    financial
    organisational

requirements.

Do not automatically delete historical financial records without a
validated retention policy.

At the same time, personal data should not be retained indefinitely
without purpose.

---

# 78. Analytics

Public analytics are optional.

If introduced, prefer privacy-conscious analytics and collect only data
that provides genuine value.

Do not send:

    customer names
    addresses
    emails
    telephone numbers
    order contents tied to identity

to analytics providers.

Marketing trackers are not required for V1.

---

# 79. Production launch security checklist

Before launch verify:

    [ ] HTTPS active

    [ ] Production database backups active

    [ ] No production secrets in Git

    [ ] .env files ignored

    [ ] Individual admin accounts configured

    [ ] Admin authorization tested

    [x] Payment sandbox tests completed — Phase 10 Gate 10C-B2, real
        Saferpay TEST TWINT / Visa+3DS / cancellation acceptance tests
        against a real staging deployment (08-PAYMENTS.md §73)

    [ ] Production Worldline callback verification enabled

    [x] Duplicate payment callback tested — proven under a genuine,
        unsuppressed ReturnUrl/NotifyUrl race, not only a simulated
        duplicate (08-PAYMENTS.md §73.2)

    [ ] Payment amount mismatch tested

    [ ] Customer cannot manipulate prices

    [ ] Customer cannot mark payment paid

    [ ] Seller settlement cannot be duplicated

    [ ] CSV export authorization tested

    [ ] CSV formula injection handled

    [ ] File uploads validated

    [ ] Security headers reviewed

    [ ] Error pages do not expose internals

    [ ] Logs reviewed for unnecessary personal data

    [ ] Email domain authentication configured

    [ ] Dependency vulnerabilities reviewed

    [ ] Database restore procedure understood

    [ ] Privacy/legal pages reviewed

---

# 80. Security testing priorities

Highest priority tests:

    admin authorization bypass
    price manipulation
    order-total manipulation
    fake payment callback
    duplicate callback
    payment amount mismatch
    seller settlement duplication
    paid-order monetary modification
    CSV export without authentication
    campaign closure during checkout

Secondary tests:

    XSS in delivery note
    malformed form data
    invalid IDs
    image upload validation
    open redirect
    session expiration

---

# 81. V1 exclusions

V1 does not require:

    custom cryptographic protocols
    custom authentication protocol
    custom payment processing
    enterprise SIEM
    dedicated SOC monitoring
    hardware security modules managed by ECM
    complex RBAC
    customer identity verification
    anti-fraud ML
    custom WAF rules without demonstrated need

Use managed platform security where appropriate.

---

# 82. Security decisions

- DECIDED: Browser data is untrusted.
- DECIDED: Prices are authoritative server-side.
- DECIDED: Order totals are calculated server-side.
- DECIDED: All sensitive mutations are authorized server-side.
- DECIDED: Individual admin accounts are used.
- DECIDED: Shared admin credentials are prohibited.
- DECIDED: Payment callbacks require provider verification.
- DECIDED: Card data is never stored.
- DECIDED: Secrets are never committed.
- DECIDED: Customer-provided text is treated as untrusted.
- DECIDED: ORM/database queries are parameterized.
- DECIDED: Historical orders are not normally physically deleted.
- DECIDED: Important financial/admin actions are audited.
- DECIDED: Paid online orders cannot be normally edited monetarily.
- DECIDED: CSV exports require authentication.
- DECIDED: CSV formula injection must be considered.
- DECIDED: File uploads are validated.
- DECIDED: Production uses HTTPS.
- DECIDED: Production database backups are required.
- DECIDED: AI-generated security-sensitive code requires review.
- DECIDED: CAPTCHA is not required by default.
- DECIDED: Marketing trackers are not required.
- DECIDED: Better Auth 1.7.5 (email/password only) is the admin
  authentication implementation (Phase 3).
- DECIDED: Authentication identity (`auth_users`, Better Auth-owned) and
  domain/audit identity (`admin_users`) are kept separate, linked by a
  nullable unique `admin_users.auth_user_id` (RESTRICT). Authorization
  lookups use `auth_user_id`, never email. `admin_users.active` is the
  single authoritative authorization flag.
- DECIDED: Public admin registration is disabled
  (`emailAndPassword.disableSignUp: true`) at every layer, permanently.
  Administrators are provisioned only via `pnpm bootstrap:admin`
  (interactive, no hardcoded/logged credentials) or, later, an
  already-authenticated admin inviting another (not yet built).
- DECIDED: Rate limiting for authentication uses Better Auth's built-in
  limiter with database-backed storage (`auth_rate_limits`), not the
  in-memory default — required because serverless instances don't share
  in-memory state.
- DECIDED: Disabling an administrator sets `admin_users.active = false`
  (the authoritative fact, checked on every request) and deletes their
  `auth_sessions` rows as immediate defence-in-depth cleanup — not the
  primary authorization mechanism.
- DECIDED: Proxy (`src/proxy.ts`) is optimistic UX only (redirects on
  cookie absence); the Data Access Layer (`requireAdmin()`/
  `getAdminOrNull()` in `src/lib/auth/dal.ts`) is the sole authorization
  authority and is called directly by every protected route.
- DECIDED: Saferpay `NotifyUrl` and `ReturnUrl` were both independently
  verified, against a real staging deployment and the real Saferpay TEST
  environment, to derive payment truth only from `PaymentPage/Assert` —
  never from the callback/redirect request itself (Phase 10 Gate
  10C-B2). See `08-PAYMENTS.md` §73.
- DECIDED (Phase 11 Gate 11A): transactional email content is built by
  one pure, unit-tested function (`buildOrderConfirmationEmail()`)
  proven never to include internal IDs, provider transaction IDs, or
  payment credentials, with every dynamic value HTML-escaped before
  interpolation — no template/rendering-framework dependency. See §60
  above.
- DECIDED (Phase 11 Gate 11B): automatic email dispatch is a best-effort
  post-commit side effect only — a Resend failure, timeout, or
  misconfiguration can never roll back, alter, or reinterpret an
  already-successful order/payment result. `EMAIL_SENT`/`EMAIL_FAILED`
  `OrderEvent`s carry only a variant and a sanitized failure category,
  never a raw provider message/body. See §60 above.
- DECIDED (Phase 11 Gate 11B): automated tests (DB integration and E2E)
  are structurally prevented from ever reaching the real Resend API,
  even though `.env.local` now holds real, working credentials — via
  the existing `E2E_FAKE_EMAIL_PROVIDER` double gate for E2E, and
  per-file `vi.mock` of the real adapter (mirroring the pre-existing
  Saferpay-client test pattern) for the DB suites whose "real committed
  connection" design would otherwise reach it. See §60 above.
- DECIDED (Phase 11 Gate 11C): the admin manual-resend action always
  re-derives recipient and variant from freshly-read, currently
  persisted order/payment state — never from prior email history, the
  browser, or `order.source`. Its idempotency key is a fresh
  server-generated ID per invocation, which protects a single invocation
  from internal retries but deliberately does not guarantee
  cross-request exactly-once delivery; that limitation is accepted
  rather than solved with new durable state. See §60 above.

---

# 83. Remaining security decisions

## TBD-SEC-001 — Authentication implementation — RESOLVED (Phase 3)

Better Auth 1.7.5 with the official Drizzle adapter, email/password only
(no social providers), UUID identity generation, `cookieCache` left at
Better Auth's own default (disabled — every request re-validates against
the database). Session cookie: `better-auth.session_token`
(HttpOnly, `SameSite=Lax`, `Secure` in production).

Password reset (`emailAndPassword.sendResetPassword`) is deliberately
**not configured** — Better Auth requires that callback to actually
deliver a reset email; without it, `requestPasswordReset` fails closed
(400 `RESET_PASSWORD_DISABLED`) before ever generating a token, so no
reset URL/token exists to leak. The real reset flow (and its UI) is
deferred until Phase 11's EmailProvider (Resend) exists — logging the
reset URL server-side as an interim measure was considered and
explicitly rejected as a bearer-token-in-logs exposure.

## TBD-SEC-002 — MFA — DEFERRED, not resolved

Better Auth's 2FA plugin is intentionally **not installed** in Phase 3
(it would add its own schema — `two_factor` table plus columns on
`auth_users` — for a launch-scope decision that hasn't been made). No
MFA UI exists. Revisit before production launch per the original
recommendation in this section; adding it later means installing the
plugin and its schema, not building anything custom.

## TBD-SEC-003 — Rate limiting — RESOLVED for authentication (Phase 3)

Better Auth's built-in rate limiter, `storage: "database"`
(`auth_rate_limits` table) — verified against the real table, not
assumed (Gate 2B integration test forces a burst of sign-in attempts
through the real limiter and confirms both the 429 response and the
persisted row). Default rule for `/sign-in*`, `/sign-up*`,
`/change-password*`, `/change-email*`: 3 requests / 10s window (Better
Auth's own built-in default, not project-specific tuning). Checkout and
payment-initiation rate limiting remains TBD (Phase 6/10 scope).

## TBD-SEC-004 — Security headers

Finalize CSP and related headers after external providers and fonts are
known.

## TBD-SEC-005 — Data retention

Define retention period with ECM accounting/legal requirements.

## TBD-SEC-006 — Privacy/legal documents

Validate required Swiss privacy and commercial information before launch.

## TBD-SEC-007 — Backup provider configuration

Finalize after PostgreSQL hosting provider is selected.
