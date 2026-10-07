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

> **Gate 14B implementation note (adopted) — checkout/payment rate
> limiting:** closes the Gate 14A HIGH finding (unauthenticated
> checkout/payment-initiation abuse). PostgreSQL-backed fixed-window
> limiter (`checkout_rate_limits` table, one additive migration) — no
> Redis/Upstash, no in-memory limiter (would be ineffective on Vercel's
> stateless serverless runtime). Three independent buckets: order
> creation (8/10min), online-payment initialization (5/10min, shared by
> the initial checkout call and the explicit retry action), non-terminal
> status polling (25/1min, only consulted while the payment isn't
> already terminal). Identity is `HMAC-SHA-256(RATE_LIMIT_SECRET,
> "melodia-rate-limit-v1:" + normalized-client-IP)` — the raw IP is
> never persisted or logged; a shared `"unknown"` fallback identity is
> used when no trustworthy IP can be derived, never a client-asserted
> value. Client IP source verified against Vercel's own current official
> documentation (vercel.com/docs/headers/request-headers): prefers
> `x-vercel-forwarded-for` (Vercel's own, robust even behind a future
> additional proxy) with `x-forwarded-for` as a documented-equivalent
> fallback — both are Vercel-overwritten and not attacker-spoofable on
> this project's deployment shape (no "Trusted Proxy" Enterprise
> feature in use). The existing checkout idempotency mechanism remains
> the sole correctness boundary for "only one Order is ever created" —
> the rate limiter only decides whether a **new** idempotency key gets
> to try at all; a retry of an already-persisted key never consumes
> quota. Deliberately **no** secondary customer-email bucket — a
> recipient-specific quota could itself be weaponized to deny a real
> customer service, so this closes the confirmed source-based abuse
> vector without claiming to solve a genuinely distributed (many-IP)
> attack, which stays a platform/CDN-level concern. See
> `05-ARCHITECTURE.md` for the full architecture.

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

## Phase 12 Gate 12B implementation (adopted)

Both PDF Route Handlers (individual order, seller) independently call
`getAdminOrNull()` and return a plain `401` — the same established
Gate 12A boundary, not a new one; verified against both a cookie-less
request (caught earlier by the Proxy's redirect) and a forged-but-
present session cookie (reaching the handler, rejected there). Every
response sets `Cache-Control: private, no-store`; no generated PDF is
ever written to disk, Blob storage, or a database — each is rendered
fresh per authenticated request from data re-fetched server-side at
request time, never from a client-supplied value beyond the
`orderId`/`sellerId` identifier in the URL itself. Both identifiers are
re-validated against real persisted rows (`getOrderDetail()`,
`getSeller()`) and, for the seller route, against that seller's actual
eligible orders in the requested campaign — never trusted merely
because the browser supplied them; a seller with zero eligible orders
in scope returns a safe 404, never an empty document.

Customer-controlled strings (name, delivery note) are passed straight
into `@react-pdf/renderer`'s `<Text>` primitive, which never parses its
children as HTML/markup — there is no HTML-intermediate step in this
rendering path at all (unlike the Gate 11A email path, which needed its
own `escapeHtml()`), so there is structurally no markup-injection
surface to neutralize. Verified with a fixture containing
`<script>alert("x")</script>`-shaped text, confirmed to render and
generate a valid PDF without being interpreted as markup.

No raw order/seller UUID appears in either document's content or its
filename (`preparation-{orderNumber}.pdf`,
`preparation-{slugified seller name}.pdf` — `slugifyName()` strips
diacritics/unsafe characters, never used as a uniqueness guarantee
since the seller is always identified server-side by id, not by the
filename). No card/payment credential data can appear (same structural
guarantee as Gate 12A — `payments` never stores it). No generated PDF
content, and no customer PII, is logged.

## Phase 12 Gate 12C implementation (adopted)

Both commercial-document routes (`confirmation.pdf`, `receipt.pdf`)
independently call `getAdminOrNull()` and return `401` — the identical
boundary reused from Gates 12A/12B, not a new one. `Cache-Control:
private, no-store` on every response; nothing persisted; both
documents regenerated fresh from `getOrderDetail()` on every request.
No raw order UUID in either filename (`confirmation-{orderNumber}.pdf`,
`recu-{orderNumber}.pdf`) or document body.

The `RECEIPT` variant's core financial-correctness guarantee is
enforced at compile time, not merely at runtime: `buildReceiptContent()`
only accepts an order whose `customerPaymentStatus` has already been
narrowed to the literal `"PAID"` by `canGenerateReceipt()`'s own
TypeScript type-predicate signature — a route cannot construct a
receipt claiming payment was received unless the type system has
already proven it. `CANCELLED` is checked explicitly and separately in
both guards, not inferred from the payment-status check alone.

No seller name, seller settlement status, customer note, email, phone,
or provider transaction/reference ID appears in either document — all
excluded by the content model itself (`OrderDocumentContent` simply
has no field for them), not merely omitted at render time. Customer-
controlled text renders via `<Text>` with the same structural no-HTML-
parsing guarantee already established in Gate 12B; verified with the
identical markup-like-content fixture technique. ECM's organisation
identity (name, address) is public information, hardcoded in a small
domain constant — never an environment variable, never treated as a
secret. ECM is not VAT-registered — no VAT number, rate, or amount
exists anywhere in this model to leak. Test fixtures use only synthetic
`@example.test` data, matching every prior gate.

---

# 49. Admin exports

Large bulk exports expose more personal information than normal admin
pages.

Therefore export actions should:

- require authentication;
- be logged where useful;
- avoid unnecessary fields;
- not be cached publicly.

## Phase 12 Gate 12A implementation (adopted)

Each of the four `/admin/exports/*.csv` Route Handlers independently
calls `getAdminOrNull()` and returns a plain `401` when unauthenticated
— the Proxy's cookie-presence check is optimistic UX only, never the
boundary (verified directly: a genuinely cookie-less request is caught
by the Proxy's redirect before the handler runs at all; a forged-but-
present session cookie reaches the handler and is independently
rejected there, `401`, mirroring `admin-auth.spec.ts`'s own "forged
cookie" proof for pages). Every response sets
`Cache-Control: private, no-store` and a human-readable, campaign/
date-based filename — never a raw order/seller UUID (§30 above).

Formula-injection neutralization (§46/§47) is centralized in one pure
function (`src/domain/csv/csv-cell.ts`'s `neutralizeFormulaPrefix()`),
applied only to untrusted free-text columns (customer name/address/
phone/email/delivery note, product/bundle/seller display names) —
never to money, dates, counts, or this codebase's own status labels. A
leading `=`/`+`/`-`/`@`, including when preceded by space/tab/CR/LF,
is neutralized by prefixing the ORIGINAL value with `'`; the value
itself (e.g. a `+41…` Swiss phone number) is never stripped or
rewritten, matching Excel/LibreOffice/Sheets' own "leading apostrophe
means literal text" convention. Verified by a full test matrix
(`csv-cell.test.ts`) covering every listed prefix character, each
leading-whitespace variant, and a real Swiss phone number round-trip.

No card data can appear in any export — `payments` never stores it to
begin with (Rule 8, structurally). No CSV is ever written to disk,
Blob storage, or a database — every export is generated fresh per
authenticated request and returned directly (§48's "no permanently
public document URL" principle, trivially satisfied since nothing is
persisted at all). No generated CSV content, and no customer PII, is
logged.

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

> **Gate 14C implementation note (adopted) — HTTP security headers:**
> closes the Gate 14A MEDIUM finding (security headers/CSP absent).
> `src/lib/security-headers.ts` centralizes a small, pure, unit-tested
> policy; `next.config.ts`'s `headers()` applies it globally
> (`source: '/(.*)'`) to every response, including the Proxy-issued
> unauthenticated `/admin` redirect (verified). `Strict-Transport-
> Security` is deliberately **not** set here — Vercel already forwards
> HTTP to HTTPS (308) and applies HSTS automatically on both
> `.vercel.app` and custom domains (verified against
> vercel.com/docs/cdn-security during Step 1), so an application-level
> duplicate would be redundant, not protective. The remaining four
> headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-
> origin-when-cross-origin`, `Permissions-Policy: camera=(),
> microphone=(), geolocation=()`, `X-Frame-Options: DENY`) and the CSP
> are fully application-configured, since Vercel does not set these
> automatically. No CSP violation reporting (`report-to`/`report-uri`)
> is configured — that would add a new PII-adjacent telemetry surface
> (client URLs/IPs) beyond this gate's narrow scope.

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

> **Gate 14C implementation note (adopted):** static CSP via
> `next.config.ts` (no nonces) — approved direction, since this app has
> no browser-rendered `dangerouslySetInnerHTML`, no third-party
> analytics/tracking, self-hosted fonts (`next/font`, no external
> runtime font origin), same-origin-only Better Auth traffic, a
> server-side-only Saferpay API client, and a Saferpay Payment Page
> that is a top-level browser redirect (`window.location.assign`),
> never an iframe embed. **Accepted limitation, stated honestly:** the
> static approach requires `'unsafe-inline'` for `script-src`/
> `style-src` (Next.js's own documented "Without Nonces" pattern), so
> — unlike a nonce/hash-based strict CSP — it does **not** block an
> inline `<script>` injected by a future XSS bug; React's default JSX
> escaping remains the primary XSS defense, and this CSP is defense-in-
> depth for clickjacking, MIME-sniffing, and unauthorized resource
> origins, not an equivalent substitute for a strict CSP. A nonce-based
> CSP remains a possible future hardening step — it was not adopted
> here because it would force every page to dynamic rendering,
> disabling this app's existing static optimization (`/design`,
> `/design-system`, `/design/*`) for no demonstrated V1 threat
> justifying that cost. Production CSP: `default-src 'self'; script-src
> 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src
> 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src
> 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`.
> `'unsafe-eval'` is added to `script-src` only in development
> (`NODE_ENV === "development"`, matching Next's own documented reason:
> React's dev-mode error-stack reconstruction) — verified absent from
> the production policy by a unit test. `img-src` is deliberately
> scoped to same-origin + `data:`/`blob:` only: every seeded product/
> bundle currently has `imageUrl = null` (rendering the
> `PlaceholderBottle` fallback), and while the admin product/bundle
> forms' own Zod validation requires an absolute `http(s)://` URL for
> `imageUrl`, `next.config.ts` has no `images.remotePatterns`
> configured, so `next/image` already rejects any such URL today
> regardless of this CSP — a pre-existing, untested, unrelated gap
> tracked separately, not fixed by Gate 14C. **`img-src` will need
> revisiting once TBD-ARCH-006 (image storage provider) is resolved** —
> this CSP does not attempt to anticipate that choice. Saferpay's API
> origin is intentionally absent from `connect-src`/`frame-src`: the
> browser never talks to it directly (server-side-only client, top-
> level-redirect Payment Page).

---

# 52. HTTPS

Production traffic must use HTTPS.

HTTP should redirect to HTTPS.

TLS certificate management should be handled by the hosting platform.

Do not serve authentication, checkout or payment flows over plaintext
HTTP.

> **Gate 14C verification note (adopted):** confirmed against Vercel's
> own current official documentation (vercel.com/docs/cdn-security)
> that this requirement is already fully satisfied by the platform —
> "The CDN forwards HTTP requests to HTTPS with a 308 status code" and
> "Vercel applies HSTS automatically on `.vercel.app` domains and
> custom domains." No application code was added to duplicate this.

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

> **Gate 14F implementation note (adopted, verified complete):** CI
> (`.github/workflows/ci.yml`) installs with `pnpm install
> --frozen-lockfile` — a lockfile/manifest mismatch fails the workflow
> outright rather than silently regenerating `pnpm-lock.yaml`. Security
> properties, as implemented and confirmed on a real GitHub-hosted
> runner:
>
> - **Minimum permissions**: the workflow requests only
>   `contents: read` — no write, no pull-request, no packages, no
>   `id-token`, no deployment permission of any kind, and no
>   `pull_request_target` trigger (only `pull_request`, `push` to
>   `main`, and manual `workflow_dispatch`).
> - **Zero GitHub repository secrets** anywhere in the workflow —
>   every environment value it sets (database, Better Auth, app base
>   URL) is a fixed, synthetic, already-documented-as-non-secret
>   development/test value, matching `compose.yaml`/`.env.example`'s
>   own existing convention. No production credentials, no Neon
>   access, no Vercel access are ever present.
> - **Disposable infrastructure only**: a fresh PostgreSQL 18 service
>   container, created and destroyed per run — never a persistent or
>   external database.
> - **Fake providers only**: Saferpay and Resend credentials are never
>   provided at all; the E2E suite's existing fake-provider flags mean
>   no CI run ever reaches a real payment or email provider.
> - **Failure-only, short-retention artifacts**: the Playwright report
>   uploads only `if: failure()`, with a 7-day retention.
> - CI reproduces, on a fresh runner, the same quality gate
>   (format/lint/typecheck/unit/DB/E2E/build) already enforced locally
>   — it verifies reproducibility of that existing gate, not a new
>   scanning capability.
>
> The corrected workflow completed successfully end-to-end on a real
> GitHub Actions run (commit `06eb8ccf959a378b9faa6410f028c2a81bd44b8b`,
> run `36740067466`). See `docs/05-ARCHITECTURE.md` §48 for the full
> architecture and the fresh-checkout typegen finding.
>
> **Scope note**: Gate 14F is CI enforcement/reproducibility, not a
> security scanner or penetration test. The formal abuse-case
> verification gate remains Gate 14E.

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

> **Gate 14D implementation note (adopted) — fulfilment concurrency:**
> closes the Gate 14A MEDIUM finding ("fulfilment-transition concurrency
> has no DB-level backstop, only domain-code guards"). The DB-level
> backstop is the authoritative conditional compare-and-set `UPDATE`
> (`WHERE id = ? AND status = <exact expected source status>`) that now
> follows the pre-existing initial `SELECT` + domain guard on every
> fulfilment transition and on cancellation — cancellation writes the
> same `orders.status` column every fulfilment step does, so it is
> covered by the same invariant. A stale or losing concurrent writer can
> never silently overwrite the winner: an unmatched conditional `UPDATE`
> throws a typed `FulfilmentConflictError` before any event is written,
> so a rejected attempt never produces a success event. Verified by
> deterministic tests using genuinely independent, real-committed
> database transactions (`src/infrastructure/database/integration/
> fulfilment-concurrency.db.test.ts`) — not sequential calls inside one
> transaction, which cannot exercise this class of race at all. See
> `docs/05-ARCHITECTURE.md` for the full architecture and
> `docs/02-BUSINESS-RULES.md` BR-STA-009 for the business-rule statement.

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

    [x] HTTPS active — verified on the final production domain
        `https://vins.ecmelodia.ch`, valid TLS (Phase 15 Gate 15D-D)

    [ ] Production database backups active

    [ ] No production secrets in Git

    [ ] .env files ignored

    [x] Individual admin accounts configured — the first production
        administrator was bootstrapped via `pnpm bootstrap:admin`,
        authenticated successfully against
        `https://vins.ecmelodia.ch/admin` (Phase 15 Gate 15E)

    [x] Admin authorization tested — ABUSE-AUTH-001 through
        ABUSE-AUTH-004 (§ Gate 14E matrix)

    [x] Payment sandbox tests completed — Phase 10 Gate 10C-B2, real
        Saferpay TEST TWINT / Visa+3DS / cancellation acceptance tests
        against a real staging deployment (08-PAYMENTS.md §73)

    [ ] Production Worldline callback verification enabled

    [x] Duplicate payment callback tested — proven under a genuine,
        unsuppressed ReturnUrl/NotifyUrl race, not only a simulated
        duplicate (08-PAYMENTS.md §73.2)

    [x] Payment amount mismatch tested — ABUSE-PAY-004

    [x] Customer cannot manipulate prices — ABUSE-CHECKOUT-001

    [x] Customer cannot mark payment paid — ABUSE-PAY-001

    [x] Seller settlement cannot be duplicated — ABUSE-SETTLE-001

    [x] CSV export authorization tested — ABUSE-EXPORT-001

    [x] CSV formula injection handled — ABUSE-EXPORT-002

    N/A — File uploads: no upload feature exists in V1 (ABUSE-MISC-002)

    [x] Security headers reviewed — Phase 14 Gate 14C, static CSP +
        X-Content-Type-Options/Referrer-Policy/Permissions-Policy/
        X-Frame-Options implemented, unit + E2E tested, verified via a
        real browser with zero CSP console violations across public/
        admin/interactive flows (§50/§51 above)

    [ ] Error pages do not expose internals

    [ ] Logs reviewed for unnecessary personal data

    [x] Email domain authentication configured — `ecmelodia.ch`
        verified in Resend (SPF/DKIM/DMARC, Gate 11A); production
        `RESEND_API_KEY`/`EMAIL_FROM` configured and a real delivery
        confirmed (Phase 15 Gate 15F-C1). Infrastructure-level only —
        the deployed application's own order-confirmation dispatch
        path remains untested in production (§61 above)

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

## Gate 14E — formal abuse-case verification matrix (adopted)

Formalizes the abuse scenarios named above and in
`docs/10-IMPLEMENTATION-PLAN.md` §84 against actual executable evidence.
Gate 14E does not close a remaining Gate 14A finding — all three Gate 14A
findings (HIGH rate limiting, MEDIUM headers/CSP, MEDIUM fulfilment
concurrency) were already closed by Gates 14B/14C/14D respectively. This
matrix instead maps every documented abuse case to its control and its
evidence, adding only the small amount of executable coverage genuinely
missing. Status vocabulary: `VERIFIED` (deterministic executable test),
`VERIFIED — code audit` (proven by direct inspection of the code, not by
an executable test — used only where an executable test would be
fragile, redundant with an already-tested shared boundary, or where no
attack surface exists to exercise), `NOT APPLICABLE` (no such feature/
surface exists in this application).

| ID | Abuse scenario | Invariant | Control | Evidence | Status |
|---|---|---|---|---|---|
| ABUSE-AUTH-001 | Unauthenticated page access to `/admin/*` | Only authenticated, active admins reach protected pages | Proxy redirect + DAL | `e2e/admin-auth.spec.ts` | VERIFIED |
| ABUSE-AUTH-002 | Forged session cookie | Proxy's cookie-presence check is never authoritative | `requireAdmin()`/DAL re-validates server-side | `e2e/admin-auth.spec.ts`, `e2e/exports.spec.ts` | VERIFIED |
| ABUSE-AUTH-003 | Inactive admin account | `admin_users.active=false` blocks access even with a valid session | DAL checks `active` | `e2e/admin-auth.spec.ts` | VERIFIED |
| ABUSE-AUTH-004 | Unauthorized admin Server Action call | Every admin mutation independently enforces authorization, not merely hidden UI (BR-ADM-003) | Single centralized `requireAdmin()`, called first in every action | Code audit: every file with a file-level `"use server"` directive has a `requireAdmin()` call count ≥ its exported-action count (verified across all 9 admin action files, zero shortfall) + `src/infrastructure/database/integration/auth.db.test.ts` proves the shared underlying resolver (`resolveAdminFromAuthUserId`) directly. A raw Next.js Server-Action-wire-protocol test was deliberately not built — it would couple the suite to an unstable framework-internal protocol without adding to the actual guarantee already proven by the shared-boundary audit plus the resolver's own DB test. | VERIFIED — code audit |
| ABUSE-CHECKOUT-001 | Client-supplied price/total | Server always recalculates authoritatively, never trusts a caller-supplied amount | `createOrder()` prices from the current `campaignProducts`/`bundles` rows | `create-order.db.test.ts`: *"uses the CURRENT authoritative price, never anything the caller might imply"* | VERIFIED |
| ABUSE-CHECKOUT-002 | Unknown/inactive product, bundle, or seller | Only currently-eligible catalogue entities are accepted | Server-side re-validation against live `campaignProducts`/`bundles`/`campaignSellers` | `create-order.db.test.ts` (hidden product, inactive product, inactive bundle, unknown/invalid seller, seller deactivated before submission) | VERIFIED |
| ABUSE-CHECKOUT-003 | Campaign closes between checkout page load and order submission | `createOrder()` never creates an order against a non-ACTIVE campaign | `getPublicCatalog()`'s `state !== "active"` short-circuit inside the order-creation transaction | `create-order.db.test.ts`: *"rejects a checkout submitted after the campaign closed between page load and submission"* — added Gate 14E; asserts `{status:"rejected", reason:"no-active-campaign"}`, zero orders created, order-number counter untouched | VERIFIED |
| ABUSE-CHECKOUT-004 | Quantity manipulation (zero, negative, non-integer, excessive) | Quantity bounded to a positive integer ≤ 999 | `orderCreationInputSchema` (Zod) | `order-input-schema.test.ts`: rejects `0, -1, 1.5, 1000`; accepts the declared maximum `999` (boundary-acceptance case added Gate 14E) | VERIFIED |
| ABUSE-CHECKOUT-005 | Malformed customer input, malformed idempotency key, unknown item type, empty cart | Zod schema boundary enforcement at the trust boundary | `orderCreationInputSchema` | `order-input-schema.test.ts` | VERIFIED |
| ABUSE-CHECKOUT-006 | Duplicate checkout submission (double-click, retry, concurrent same key) | Exactly one order per idempotency key, including under genuine concurrency | Advisory transaction lock + `idempotencyKey` unique constraint | `create-order.db.test.ts` (same-key replay), `create-order-concurrency.db.test.ts` (genuinely concurrent same-key race), `e2e/checkout.spec.ts` (browser double-click) | VERIFIED |
| ABUSE-PAY-001 | Browser return/success page marks an order PAID | Only a trusted provider confirmation (Assert/Notify) can apply the PAID transition | `confirmOnlinePayment()`/`applySuccessfulOnlinePayment()`, never a client-supplied status | `online-payments.db.test.ts` | VERIFIED |
| ABUSE-PAY-002 | Fake/forged payment callback | Unknown/malformed provider tokens are rejected without leaking validity information | Route Handler validates the token before ever calling `confirmOnlinePayment()` | `route.test.ts`: *"returns 200 for an unknown token, leaking no information about token validity"*, *"...for a malformed token WITHOUT calling confirmOnlinePayment at all"* | VERIFIED |
| ABUSE-PAY-003 | Duplicate/replayed provider notification | Idempotent — no duplicate financial transition | `SELECT ... FOR UPDATE` + already-terminal short-circuit | `saferpay-notification.db.test.ts` case F; `online-payments.db.test.ts`: *"idempotent under repeated processing"* | VERIFIED |
| ABUSE-PAY-004 | Payment amount/currency mismatch | A mismatched amount/currency never applies PAID; recorded as an anomaly instead | Explicit comparison against the authoritative order total before transitioning | `online-payments.db.test.ts`: amount mismatch, currency mismatch | VERIFIED |
| ABUSE-PAY-005 | Concurrent successful confirmation (browser Return racing provider Notify) | Exactly-once transition regardless of which path wins | Row-level lock on `payments`/`orders` | `online-payment-concurrency.db.test.ts` | VERIFIED |
| ABUSE-PAY-006 | AUTHORIZED treated as financially final | `AUTHORIZED` (Assert) requires a subsequent `Capture` before being treated as paid | Explicit `REQUIRES_CAPTURE` branch, Capture call outside any DB lock | `online-payments.db.test.ts` (AUTHORIZED-before-Capture, Capture success, `TRANSACTION_ALREADY_CAPTURED` handling) | VERIFIED |
| ABUSE-FULFIL-001 | Concurrent/stale fulfilment transition (including vs. cancellation) | Exactly one winner persists; a losing attempt never overwrites the winner or produces a success event | Conditional compare-and-set `UPDATE ... WHERE status = <expected>` | `fulfilment-concurrency.db.test.ts` | VERIFIED |
| ABUSE-SETTLE-001 | Seller settlement duplication (two concurrent settlement attempts for the same order) | An order belongs to exactly one settlement | `seller_settlement_orders_order_id_unique` constraint, serializing concurrent attempts | `settlement-concurrency.db.test.ts`: *"two concurrent settlement attempts racing for the SAME order: exactly one succeeds"* — inspected directly for Gate 14E; confirms exactly one success, a clean typed rejection (never a raw SQL/constraint message), and exactly one settlement link | VERIFIED |
| ABUSE-ORDER-001 | Paid-order monetary modification | A paid order's monetary fields (quantity/product/bundle/price/total) are never alterable through the ordinary admin edit path | `updateOrderCustomerInfo`'s `CustomerInfoUpdate` interface structurally excludes every monetary field — no mutation surface exists for any order regardless of payment status | `order-admin.db.test.ts`: *"even a PAID order's monetary fields are untouched"* — added Gate 14E; asserts `subtotalAmount`/`totalAmount`/order items are byte-for-byte unchanged after updating every allowed field on a PAID order | VERIFIED |
| ABUSE-EXPORT-001 | Unauthenticated CSV export access | Rejected at the Route Handler, independent of page rendering; forged cookie does not grant access | `getAdminOrNull()` in the Route Handler itself | `e2e/exports.spec.ts`: *"an unauthenticated request cannot retrieve any export"*, *"a forged session cookie does not grant access — the Route Handler's own auth check, not the Proxy, is authoritative"* | VERIFIED |
| ABUSE-EXPORT-002 | CSV formula injection | Values beginning with `=`, `+`, `-`, `@` (and whitespace-prefixed variants) are neutralized; delimiter/quote/CR/LF values are correctly quoted | `csv-cell.ts` | `csv-cell.test.ts` (exhaustive) | VERIFIED |
| ABUSE-DOC-001 | Unauthenticated PDF/document access, invalid order/seller IDs, technical UUID leakage | Rejected without valid authentication; invalid IDs fail safely; filenames never expose internal UUIDs | Route Handler auth check + not-found handling + human-readable filename generation | `e2e/order-documents.spec.ts`, `e2e/preparation-documents.spec.ts` | VERIFIED |
| ABUSE-EMAIL-001 | Resend targets an ineligible order or is invoked without authorization | Server-side eligibility re-check independent of what the admin UI shows; failure never mutates order/payment state | `requireAdmin()` + `resolveConfirmationEligibility()` | `resend-confirmation.db.test.ts` | VERIFIED |
| ABUSE-RATE-001 | Checkout/payment-initiation abuse (scripted repeated submission) | Bounded per-identity quotas; a rejected attempt never reaches `createOrder()`/the payment provider | PostgreSQL fixed-window limiter (Gate 14B) | `checkout-rate-limit.db.test.ts`, `rate-limit.db.test.ts` | VERIFIED |
| ABUSE-RATE-002 | Attacker-controlled forwarding header used to spoof or bypass identity | Only Vercel-trustworthy headers are used; an absent/untrustworthy header collapses to one shared fallback identity, never a client-asserted one | `getRateLimitClientIp()` | `rate-limit-client-ip.test.ts`: *"returns null when neither header is present — never trusts an arbitrary fallback header"* | VERIFIED |
| ABUSE-HDR-001 | Missing HTTP security headers / CSP | Every response carries CSP, frame protection, MIME protection, referrer policy, permissions policy | `next.config.ts` `headers()` (Gate 14C) | `security-headers.test.ts`, `e2e/security-headers.spec.ts` | VERIFIED |
| ABUSE-XSS-001 | XSS via customer-supplied text (delivery note and other free-text fields) | Customer-supplied text is never rendered as trusted HTML/markup | Browser UI: React JSX's default text escaping (no `dangerouslySetInnerHTML`/raw-HTML sink exists anywhere in the codebase — re-confirmed by direct search during Gate 14E). Transactional HTML email: explicit `escapeHtml()` applied to every interpolated field, including the delivery note, before it reaches the HTML output. CSP (Gate 14C) is defense-in-depth on top of both, not the primary control. | Code audit (React's escaping is a framework guarantee, not independently re-tested here) + `escape-html.test.ts` (exhaustive unit coverage of the email-HTML escaping function) + `security-headers.test.ts`/`e2e/security-headers.spec.ts` for the CSP layer | VERIFIED — code audit |
| ABUSE-MISC-001 | Open redirect via a user-controlled parameter | No redirect destination is ever derived from request input | `proxy.ts` sets a `from` query parameter on the login redirect, but the login flow never reads or consumes it — `login-form.tsx` always navigates to the fixed internal `/admin` destination on success; no `?returnUrl=`/`?next=`-style pattern exists anywhere in the codebase | Code audit (no dynamic redirect surface exists to exercise; a test asserting a nonexistent endpoint does not redirect externally would prove nothing) | NOT APPLICABLE — no attack surface exists in V1 |
| ABUSE-MISC-002 | Image upload validation | — | — | Admin product/bundle images are an admin-typed external URL field (validated as `http(s)://` by Zod), never a binary file upload — there is no upload feature anywhere in V1 | NOT APPLICABLE — no file-upload surface in V1 |
| ABUSE-MISC-003 | Session expiration | — | — | Session validity is delegated entirely to Better Auth (`cookieCache` disabled, so every request re-validates against the database — see `resolveAdminFromAuthUserId`); this application adds no custom session-expiration logic of its own, so there is nothing application-specific to test beyond the already-verified `active`-flag re-validation (ABUSE-AUTH-003) | Library-internal behavior, not application code | NOT APPLICABLE — no custom application logic to verify |

Gates 14B, 14C, and 14D's own test suites are referenced above as direct
evidence, not recreated. No dedicated abuse/penetration-test file was
created — see `docs/05-ARCHITECTURE.md` for the rationale (Option B:
domain-specific additions, kept where each behavior already lives).

## Gate 14G — Phase 14 closure checklist (verified complete)

Final evidence-based closure check, not a new audit:

    [x] Gate 14A findings closed: 1 HIGH + 2 MEDIUM, all with
        implementation + executable evidence (Gates 14B/14C/14D)
    [x] Gate 14B rate limiting verified
    [x] Gate 14C security headers/CSP verified
    [x] Gate 14D fulfilment concurrency verified
    [x] Gate 14E formal abuse matrix resolved: 30 total / 25 VERIFIED /
        2 VERIFIED — code audit / 3 NOT APPLICABLE / 0 unresolved
    [x] Gate 14F CI verified on a clean GitHub-hosted runner
        (run `36740067466`)
    [x] No unresolved Phase 14 security blocker
    [x] Residual/future risks remain explicitly documented (TBD-SEC-002,
        TBD-SEC-005, TBD-SEC-006, TBD-SEC-007, TBD-ARCH-006,
        TBD-ARCH-008)
    [x] Production/deployment work explicitly separated into Phase 15
    [x] Phase 14 documentation/status synchronized

**Phase 14 — Security and resilience hardening: COMPLETE.** Rate
limiting, security headers/CSP, and fulfilment-transition concurrency
were hardened and verified; a formal 30-scenario abuse matrix was
resolved with zero unresolved rows; CI reproducibility was verified on
a real GitHub-hosted runner. No unresolved Phase 14 security blocker
remains. This is Phase 14 hardening completion, not a production-
readiness declaration — production deployment, DNS/HTTPS, production
credentials, backups, and operational readiness remain Phase 15 scope.

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
- DECIDED (Phase 12 Gate 12A): every CSV export Route Handler enforces
  authorization itself via `getAdminOrNull()` (401 on failure), never
  relying on the Proxy's optimistic cookie check or the `(protected)`
  folder name — verified against both a cookie-less request and a
  forged-but-present session cookie. Formula-injection neutralization
  is centralized and applied only to untrusted free-text columns,
  never to money/dates/labels. See §49 above.
- DECIDED (Phase 12 Gate 12B): `TBD-ARCH-007` resolved to
  `@react-pdf/renderer`, verified compatible with this project's exact
  React 19/Next.js 16/Turbopack setup before adoption. Both PDF Route
  Handlers reuse the Gate 12A `getAdminOrNull()` boundary unchanged;
  customer text renders via `<Text>` with no HTML-intermediate step, so
  no markup-injection surface exists to neutralize. See §48 above.
- DECIDED (Phase 12 Gate 12C): the RECEIPT document's "payment was
  received" claim is enforced at compile time via a TypeScript type
  predicate (`canGenerateReceipt()`), not merely at runtime — a route
  cannot construct receipt content for an order whose
  `customerPaymentStatus` isn't already narrowed to `"PAID"`. ECM's
  organisation identity is public information, hardcoded, never an
  environment variable. No VAT field exists anywhere in the model (ECM
  is not VAT-registered). See §48 above.
- DECIDED (Phase 14 Gate 14B): checkout/payment-initiation/status-
  polling rate limiting closes the Gate 14A HIGH finding. PostgreSQL-
  backed, three independent buckets, `HMAC-SHA-256` opaque identity —
  never the raw IP — with a dedicated `RATE_LIMIT_SECRET`. No secondary
  per-recipient-email bucket (would itself be weaponizable against a
  real customer). Explicitly not a defence against a distributed
  many-IP attack — that remains a platform/CDN-level concern. See §40
  above.

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

## TBD-SEC-003 — Rate limiting — RESOLVED (Phase 3 authentication; Phase 14 Gate 14B checkout/payment)

Better Auth's built-in rate limiter, `storage: "database"`
(`auth_rate_limits` table) — verified against the real table, not
assumed (Gate 2B integration test forces a burst of sign-in attempts
through the real limiter and confirms both the 429 response and the
persisted row). Default rule for `/sign-in*`, `/sign-up*`,
`/change-password*`, `/change-email*`: 3 requests / 10s window (Better
Auth's own built-in default, not project-specific tuning).

Checkout/payment-initiation/status-polling rate limiting — the
remaining gap this TBD named — is now resolved by Phase 14 Gate 14B's
own PostgreSQL-backed fixed-window limiter (`checkout_rate_limits`
table). See §40 above for the full design.

## TBD-SEC-004 — Security headers — RESOLVED (Phase 14 Gate 14C)

Finalize CSP and related headers after external providers and fonts are
known.

**Resolution:** external providers and fonts are now known (Saferpay —
server-side API + top-level-redirect Payment Page, never browser-called;
fonts self-hosted via `next/font`; Better Auth same-origin only; no
analytics/tracking). Static CSP + the four Vercel-doesn't-auto-set
headers implemented and verified — see §50/§51 above for the adopted
policy and its accepted static-vs-nonce limitation. `img-src` remains
intentionally narrow pending TBD-ARCH-006 (image storage provider,
still unresolved).

## TBD-SEC-005 — Data retention

Define retention period with ECM accounting/legal requirements.

## TBD-SEC-006 — Privacy/legal documents

Validate required Swiss privacy and commercial information before launch.

## TBD-SEC-007 — Backup provider configuration — OPEN (policy decided, Phase 15 Gate 15H-B)

PostgreSQL hosting provider is selected (Neon, Phase 15 Gate 15B).
Gate 15H-B has recorded the accepted backup/restore **policy**: Neon
native recovery as the first line of defense, plus an independent,
locally-encrypted PostgreSQL logical backup (daily during an active
campaign, 7-day rolling retention, one additional backup at campaign
closure) stored in the operator's private kDrive — see
`10-IMPLEMENTATION-PLAN.md`'s Gate 15H section for the full policy.

**This TBD remains OPEN.** The policy decision alone does not close
it — no backup mechanism has been implemented, no backup has been
produced, and no restore has been tested. Closure requires Gate 15H-C
(implementation), Gate 15H-D (one isolated restore validation before
the first real campaign activates), and Gate 15H-E (documentation
closeout).
