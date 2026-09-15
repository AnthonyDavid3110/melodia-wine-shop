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

---

# 61. Email sender

Transactional email should use an ECM-controlled domain.

SPF, DKIM and DMARC configuration should be considered as part of
production email setup.

This improves deliverability and reduces spoofing risk.

Exact DNS configuration depends on selected email provider.

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

    [ ] Payment sandbox tests completed

    [ ] Production Worldline callback verification enabled

    [ ] Duplicate payment callback tested

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

---

# 83. Remaining security decisions

## TBD-SEC-001 — Authentication implementation

Finalize Better Auth configuration and authentication method.

## TBD-SEC-002 — MFA

Determine whether admin MFA is enabled at initial launch.

Recommended:

    yes, if cleanly supported by selected auth setup

## TBD-SEC-003 — Rate limiting

Select implementation if required for:

    authentication
    checkout
    payment initiation

## TBD-SEC-004 — Security headers

Finalize CSP and related headers after external providers and fonts are
known.

## TBD-SEC-005 — Data retention

Define retention period with ECM accounting/legal requirements.

## TBD-SEC-006 — Privacy/legal documents

Validate required Swiss privacy and commercial information before launch.

## TBD-SEC-007 — Backup provider configuration

Finalize after PostgreSQL hosting provider is selected.
