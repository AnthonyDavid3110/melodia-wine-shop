# Melodia Wine Shop — Administration Specification

> Version: 0.1
> Status: Draft
> Related documents:
> - `01-PRODUCT-SPEC.md`
> - `02-BUSINESS-RULES.md`
> - `03-USER-FLOWS.md`
> - `04-DATA-MODEL.md`
> - `05-ARCHITECTURE.md`

---

# 1. Purpose

This document defines the V1 administration interface for Melodia Wine
Shop.

The administration interface is the operational tool used to manage:

- campaigns;
- products;
- bundles;
- orders;
- sellers;
- payments;
- settlements;
- preparation;
- deliveries;
- statistics;
- exports.

The administration interface must prioritize operational efficiency over
decorative complexity.

---

# 2. Admin users

V1 contains one administrator permission level.

All authenticated administrators can perform the same operations.

Possible future roles such as:

    ADMIN
    TREASURER
    OPERATIONS

are intentionally excluded from V1.

All sensitive actions remain protected server-side.

---

# 3. Main navigation

Recommended desktop navigation:

    Dashboard

    Orders
    Preparation
    Sellers
    Products
    Campaign

    Payments
    Statistics
    Exports

    Settings

Recommended French labels:

    Tableau de bord
    Commandes
    Préparation
    Vendeurs
    Produits
    Campagne
    Paiements
    Statistiques
    Exports
    Paramètres

---

# 4. Admin dashboard

Route:

    /admin

The dashboard provides the operational state of the active campaign.

It must answer quickly:

- How much has been sold?
- How many orders exist?
- How many bottles are required?
- Are orders unassigned?
- Are customer payments outstanding?
- Do sellers still owe money to ECM?
- Which sellers reached their objective?
- What needs attention?

---

# 5. Dashboard KPI cards

Primary KPIs:

    Revenue
    Orders
    Bottles
    Average order value

Payment KPIs:

    Online paid
    Seller payment
    Outstanding customer payments
    Outstanding seller settlements

Operational KPIs:

    Unassigned orders
    Orders to prepare
    Prepared orders
    Delivered orders

---

# 6. Dashboard alerts

Actionable problems should appear prominently.

Examples:

    4 unassigned orders

    CHF 620.– collected by sellers
    not yet remitted to ECM

    7 delivered orders
    still marked unpaid

Alerts should link directly to the relevant filtered view.

---

# 7. Recent orders

Dashboard displays recent orders.

Example:

    ECM-2026-0142
    Jean Dupont
    CHF 184.–
    Anthony David
    TWINT · Paid

    ECM-2026-0141
    Marie Martin
    CHF 96.–
    Unassigned
    Seller payment · Pending

Clicking an order opens its detail page.

---

# 8. Orders

Route:

    /admin/commandes

This is one of the most important administration screens.

It must support:

- search;
- filtering;
- sorting;
- order inspection;
- operational actions.

---

# 9. Order table

Recommended columns:

    Order
    Customer
    Date
    Seller
    Amount
    Payment
    Status
    Source

Example:

    ECM-2026-0042
    Jean Dupont
    12.10.2026
    Anthony David
    CHF 196.–
    TWINT · Paid
    Confirmed
    Online

---

# 10. Order search

Search should match at minimum:

- order number;
- customer first name;
- customer last name;
- email;
- telephone.

Seller search may be provided through a dedicated filter.

---

# 11. Order filters

V1 filters:

    Status
    Payment status
    Payment method
    Seller
    Source
    Date

Useful quick filters:

    Unassigned
    Payment pending
    To prepare
    Ready for seller
    Delivered but unpaid
    Cancelled

---

# 12. Order detail

Route:

    /admin/commandes/[id]

The page is divided into clear operational sections.

Recommended layout:

    Order header
    Customer
    Products
    Seller
    Payment
    Fulfilment
    Documents
    History

---

# 13. Order header

Displays:

    ECM-2026-0042

    CONFIRMED

    CHF 196.–

    Created 12 October 2026 at 14:32

Primary actions depend on state.

Possible actions:

    Edit
    Prepare
    Hand to seller
    Mark delivered
    Cancel

---

# 14. Customer section

Displays:

    Jean Dupont

    Rue du Lac 15
    1400 Yverdon-les-Bains

    jean@example.ch
    079 XXX XX XX

    Delivery note:
    Call before delivery

Admin may edit customer information.

Changes must create an audit event where appropriate.

---

# 15. Products section

Example:

    2 × Chasselas
        CHF 18.–                CHF 36.–

    3 × Pinot Noir
        CHF 20.–                CHF 60.–

    1 × Carton découverte
        CHF 100.–              CHF 100.–

    ─────────────────────────────────

    Total                       CHF 196.–

Historical snapshot values are displayed.

The UI must not replace them with current catalogue prices.

---

# 16. Seller section

Displays:

    Seller
    Anthony David

Actions:

    Assign
    Reassign
    Remove assignment

Removing a seller from an offline-payment order must trigger an explicit
warning because delivery and payment collection responsibilities are
affected.

---

# 17. Payment section

Example online payment:

    Payment method
    TWINT

    Customer payment
    PAID

    Amount
    CHF 196.–

    Provider
    Worldline

    Paid
    12.10.2026 14:34

Example offline payment:

    Payment method
    Seller

    Customer payment
    PENDING

    [ Mark customer payment as received ]

---

# 18. Seller settlement section

For online payments:

    Seller settlement
    Not applicable

For offline payments:

    Seller settlement
    Pending

If customer payment has been received:

    Customer → seller
    ✓ CHF 196.– collected

    Seller → ECM
    ⏳ CHF 196.– to remit

Once included in a settlement:

    Seller → ECM
    ✓ Settled 20.12.2026

---

# 19. Fulfilment section

Display current operational state.

Example:

    Confirmed
        ↓
    Prepared
        ↓
    Handed to seller
        ↓
    Delivered

Completed steps display their timestamps.

Actions should normally progress forward through the workflow.

Administrative correction remains possible where necessary.

---

# 20. Order history

Display significant events chronologically.

Example:

    12 Oct · 14:32
    Order created online

    12 Oct · 14:34
    TWINT payment confirmed

    15 Dec · 19:42
    Order marked prepared
    by Anthony

    16 Dec · 10:04
    Handed to Anthony David
    by Anthony

History is read-only.

---

# 21. Manual order creation

Route:

    /admin/commandes/nouvelle

Purpose:

Enter paper order forms into the same system.

Form sections:

    Customer
    Products
    Seller
    Payment
    Delivery note

Source automatically becomes:

    MANUAL

---

# 22. Manual product entry

Admin selects products from the current campaign.

Example:

    Chasselas

    [-] 2 [+]

    Pinot Noir

    [-] 0 [+]

    Carton découverte

    [-] 1 [+]

Totals update immediately for convenience.

Server recalculates authoritative total on submission.

---

# 23. Manual seller selection

Seller should normally be selected because paper orders are generally
collected through ECM members.

However, the system must permit:

    Unassigned

if necessary.

---

# 24. Manual payment status

Admin chooses payment method:

    Seller payment
    TWINT
    Card

For paper orders, online payment methods should only be marked paid when
an actual corresponding payment exists.

The system must not fabricate PSP transactions.

---

# 25. Editing orders

Orders can be edited by administrators.

Editable information may include:

    customer information
    delivery note
    seller
    items
    quantities

Before an online payment has succeeded, monetary changes are allowed
subject to normal validation.

After successful online payment, monetary modifications are restricted.

V1 should not silently change the value of a paid transaction.

Recommended V1 behaviour:

    paid online order
        +
    monetary modification requested
        ↓
    block normal edit

Admin must resolve the payment situation explicitly.

---

# 26. Cancelling orders

Cancellation requires confirmation.

The interface should display consequences:

    This order will be excluded from:

    - active revenue
    - bottle requirements
    - preparation
    - seller target

If payment has already succeeded, the interface must warn:

    This order has already been paid.

Cancellation does not automatically imply a refund unless explicitly
implemented.

---

# 27. Preparation

Route:

    /admin/preparation

This page supports the central physical preparation session.

Primary views:

    By seller
    All orders
    Wine requirements

---

# 28. Preparation by seller

Recommended default view.

Example:

    Anthony David
    14 orders
    87 bottles

    [ View orders ]
    [ Preparation PDF ]

    ─────────────────────

    Marie Example
    11 orders
    62 bottles

    [ View orders ]
    [ Preparation PDF ]

This mirrors the physical organization of prepared orders.

---

# 29. Seller preparation view

Example:

    Anthony David

    14 orders
    87 bottles
    CHF 2'340.– sales

    ECM-2026-0012
    Jean Dupont
    6 bottles
    ✓ Prepared

    ECM-2026-0034
    Sophie Martin
    12 bottles
    ○ To prepare

Bulk actions may be provided where safe.

---

# 30. Wine requirements

Preparation area displays exact bottle requirements.

Example:

    Chasselas
    487

    Pinot Noir
    612

    Rosé
    431

Optional logistical helper:

    Chasselas
    487 bottles
    81 cartons + 1 bottle

Exact quantity remains authoritative.

---

# 31. Preparation status

Admin can mark individual orders:

    PREPARED

Timestamp and administrator are recorded.

Bulk preparation actions should require confirmation.

---

# 32. Handing orders to sellers

Once physical orders are distributed:

    HANDED_TO_SELLER

The application should support updating this per order.

A carefully designed bulk action per seller may also be provided.

Example:

    Mark all 14 prepared orders
    as handed to Anthony David

Confirmation is required.

---

# 33. Sellers

Route:

    /admin/vendeurs
    /admin/vendeurs/nouveau
    /admin/vendeurs/[id]

Displays campaign sellers.

Recommended columns:

    Seller
    Sales
    Target
    Progress
    Orders
    To collect
    To remit

> **Gate 1/2B implementation note (adopted):** `/admin/vendeurs` is
> Seller *master data* (firstName, lastName, active — the actual schema,
> `04-DATA-MODEL.md` §10; no email/phone/address) — create, edit,
> deactivate/reactivate, name search for ~70 members. It is independent
> of any campaign. The Sales/Target/Progress/Orders/To
> collect/To remit columns above describe the later per-campaign
> performance view (Phase 7+, once Orders/Settlements exist) — not
> Gate 2B's master-data list. Campaign-specific participation (which
> sellers take part in a given campaign, and their target) is configured
> on `/admin/campagne/[id]` instead — see §9/§44's notes.

---

# 34. Seller detail

Route:

    /admin/vendeurs/[id]

Sections:

    Performance
    Orders
    Customer collections
    ECM settlements
    History

---

# 35. Seller performance

Example:

    Anthony David

    Sales
    CHF 1'420.–

    Target
    CHF 1'000.–

    Progress
    142 %

    ✓ Objective reached

Progress should be visually clear without relying only on colour.

---

# 36. Seller financial summary

Example:

    Seller-payment sales
    CHF 550.–

    Collected from customers
    CHF 400.–

    Still to collect
    CHF 150.–

    Remitted to ECM
    CHF 250.–

    Still to remit
    CHF 150.–

These values must be calculated from underlying financial records.

---

# 37. Seller orders

Seller detail displays attributed orders.

Filters:

    All
    To deliver
    Delivered
    Customer unpaid
    To remit

This page is administrative only in V1.

The seller does not log in.

---

# 38. Settlement creation

Admin may initiate settlement from seller detail.

Example:

    Anthony David

    Eligible collected payments:

    ☑ ECM-2026-0042     CHF 120.–
    ☑ ECM-2026-0061     CHF 180.–
    ☑ ECM-2026-0097     CHF 100.–

    ─────────────────────────────

    Settlement total
    CHF 400.–

    [ Record settlement ]

The application calculates the amount.

Admin must not manually type a conflicting settlement total.

---

# 39. Settlement confirmation

Before completion:

    Confirm that ECM has received
    CHF 400.– from Anthony David?

    [ Cancel ]
    [ Confirm settlement ]

On confirmation:

- settlement becomes `SETTLED`;
- timestamp is stored;
- administrator is stored;
- included orders become settled as appropriate;
- audit events are created.

---

# 40. Products

Route:

    /admin/produits

Administration manages:

    wines
    bundles

The active campaign context must be visible.

> **Gate 1/2B implementation note (adopted):** `/admin/produits` manages
> only the reusable Product master library (name, producer, category,
> vintage, region, grape variety, descriptions, image, master
> active/inactive) — it is independent of any campaign. Bundles are
> campaign-scoped and are administered under
> `/admin/campagne/[id]/bundles/...`, not under `/admin/produits`. There
> is deliberately no single "active campaign context" banner on
> `/admin/produits` itself, since Product master data is not
> campaign-specific (see §44's note on explicit campaign identity).

---

# 41. Wine management

Admin can:

    create product
    edit product
    activate/deactivate for campaign
    set campaign price
    set display order
    manage image

Product deletion should not be the normal action.

Prefer:

    deactivate

> **Gate 1/2B implementation note (adopted):** "activate/deactivate for
> campaign", "set campaign price" and "set display order" are
> CampaignProduct concerns, configured per campaign under
> `/admin/campagne/[id]` (§7 of `04-DATA-MODEL.md`) — not on the
> `/admin/produits` Product editor, which only edits master data and its
> own global active/inactive flag. A Product's master `active` flag and
> its per-campaign `CampaignProduct.active` flag are shown distinctly in
> the campaign editor (never conflated) — a product is publicly visible
> only when both are true.

---

# 42. Product editor

Expected fields:

    Name
    Producer
    Category
    Vintage
    Region
    Grape variety
    Short description
    Description
    Tasting notes
    Image
    Campaign price
    Active
    Display order

Optional fields may remain empty.

> **Gate 1/2B implementation note (adopted):** "Campaign price" and
> "Display order" live on the CampaignProduct editor
> (`/admin/campagne/[id]`), not this Product editor — see §41's note.
> "Image" stays a preserved `imageUrl` field (no upload UI in V1; see
> `10-IMPLEMENTATION-PLAN.md` §39).
>
> **Gate 2C implementation note (adopted):** `slug` is not an
> admin-facing field anywhere — not here, not on Campaign, not on
> Bundle. A slug is generated automatically from the name on create
> (with a numeric suffix on a naming collision) and preserved unchanged
> on every later edit; there is no slug editor, advanced or otherwise,
> in V1. The database's own unique constraint on `slug` is unchanged
> and remains the authoritative backstop.

---

# 43. Bundle management

Route:

    /admin/campagne/[id]/bundles/nouveau
    /admin/campagne/[id]/bundles/[bundleId]

Admin can:

    create bundle
    edit bundle
    set price
    set composition
    set image
    activate/deactivate
    set display order

Bundle composition editor should be explicit.

Example:

    Carton découverte

    Chasselas        1
    Pinot Noir       1
    Rosé             1
    ...

    Price
    CHF 100.–

---

# 44. Campaign

Route:

    /admin/campagne
    /admin/campagne/[id]

Fields:

    Name
    Public title
    Description
    Opening date
    Closing date
    Default seller target
    Status

Actions:

    Activate campaign
    Close sales
    Reopen (CLOSED -> ACTIVE)
    Archive campaign

High-consequence lifecycle changes require confirmation.

> **Gate 1/2B implementation note (adopted):** `/admin/campagne` does
> NOT implicitly resolve to "the current campaign" — there is no such
> singleton in the admin UI. `/admin/campagne` is a list of every
> campaign (including CLOSED/ARCHIVED ones, which remain discoverable);
> `/admin/campagne/[id]` is the complete configuration for one explicit
> campaign, identified by id, verified server-side on every mutation.
> `/admin/campagne/[id]` also hosts CampaignProduct configuration,
> Bundle administration, and CampaignSeller participation — see §7/§8/§9
> of `04-DATA-MODEL.md` — organized as page sections (identity/status,
> readiness, general information, wines, bundles, sellers, lifecycle),
> not as separate routes. Status is never a free-editable field; it only
> changes through the explicit lifecycle actions above, each recorded in
> `campaignEvents` (lifecycle-only audit, `04-DATA-MODEL.md` §5a).
> Editing a normal field on an ACTIVE campaign is allowed and takes
> effect immediately — the UI warns about this but never blocks it.
>
> **Gate 2C implementation note (adopted):** the two dates are plain
> `jj.mm.aaaa` text fields, not native `<input type="date">`. A native
> date input's displayed digit order follows the browser/OS locale, not
> the page's `lang="fr"` attribute, and is not reliably overridable
> without fragile per-browser CSS/JS — manual review observed a French
> admin's browser rendering `mm/dd/yyyy`. A plain text field guarantees
> the correct Swiss French presentation for every admin regardless of
> browser locale, at the cost of the native calendar popup — an
> accepted trade-off since both dates remain optional and informational
> only. The stored representation (`timestamp with timezone`) and
> server-side date validity checking are unchanged.

---

# 45. Campaign closing

Closing sales must clearly explain:

    New customer orders will stop.

    Existing orders remain available for
    preparation, delivery and payment management.

This avoids administrators confusing campaign closure with campaign
completion.

---

# 46. Payments

Route:

    /admin/paiements

Purpose:

Provide financial reconciliation visibility.

Views:

    Online payments
    Seller payments
    Settlements
    Problems

---

# 47. Online payment view

Recommended columns:

    Order
    Customer
    Method
    Amount
    Status
    Provider reference
    Date

Filters:

    TWINT
    Card
    Successful
    Pending
    Failed
    Refunded

---

# 48. Seller payment view

Recommended columns:

    Order
    Customer
    Seller
    Amount
    Customer payment
    Seller settlement

Quick filters:

    Customer unpaid
    Collected
    Awaiting settlement
    Settled

---

# 49. Payment anomalies

Admin should be able to identify anomalies such as:

    order pending but provider succeeded
    delivered seller order still unpaid
    collected payment not settled

The system should not attempt aggressive automatic correction without
clear rules.

---

# 50. Statistics

Route:

    /admin/statistiques

V1 statistics:

    total revenue
    orders
    bottles
    average order value

    sales by wine
    sales by bundle
    sales by seller

    online vs seller payment
    TWINT vs card

    seller target progress

Statistics should help operate and evaluate the campaign.

Avoid vanity charts with no practical value.

> **Gate 13C implementation note (adopted):** "sales by wine" shows two
> columns with deliberately different populations — bottles (from
> `getCampaignWineRequirements()`, bundle-inclusive) and direct-sales
> revenue (from `PRODUCT`-type order lines only). Bundle revenue is
> never allocated across its component wines — no authoritative
> allocation rule exists — so a wine sold only inside bundles shows
> `bottles > 0` with zero direct revenue; this is correct, not a bug,
> and the page carries an explanatory caption to avoid the impression
> that the two columns should reconcile. Campaign selection covers
> ACTIVE/CLOSED/ARCHIVED (not just ACTIVE/CLOSED, unlike `/admin`) per
> BR-CAM-003. See docs/05-ARCHITECTURE.md for the full architecture.

---

# 51. Exports and documents

CSV exports, route:

    /admin/exports

Available exports:

    Orders CSV
    Order items CSV
    Seller sales CSV
    Wine requirements CSV

PDF documents (RESOLVED — Phase 12 Gate 12C for the last two; order-
scoped, generated from the order-detail page's Documents section, not
from `/admin/exports`):

    Preparation sheets                    (order-detail page)
    Seller preparation summaries          (per-seller card, /admin/preparation)
    Confirmation de commande / Reçu       (order-detail page; Reçu only once paid)

---

# 52. Settings

Route:

    /admin/parametres

V1 settings should remain limited.

Potential sections:

    Administrators
    Organisation information
    Document information

Provider secrets must never be editable as plain text through ordinary
admin UI unless specifically justified.

Deployment environment variables remain outside normal administration.

---

# 53. Responsive admin

The administration should work on smartphones but is primarily optimized
for:

    desktop
    tablet

Some operational actions may happen during preparation using a tablet or
phone.

Therefore:

- tables must remain usable;
- actions must be touch-friendly;
- critical workflows must not require hover;
- desktop density should not destroy mobile usability.

---

# 54. Confirmation dialogs

Require confirmation for actions with significant consequences.

Examples:

    cancel order
    close campaign
    archive campaign
    complete settlement
    bulk hand orders to seller

Routine reversible edits should not require unnecessary confirmation.

---

# 55. Success feedback

Administrative actions should provide clear feedback.

Examples:

    Order updated.

    Payment marked as received.

    14 orders marked as handed to seller.

    Settlement of CHF 400.– recorded.

Avoid ambiguous success states.

---

# 56. Error feedback

Errors should explain:

- what failed;
- whether data was saved;
- what the administrator can do next.

Avoid generic:

    Something went wrong

when a meaningful business error is available.

---

# 57. Empty states

Every admin view should have a useful empty state.

Example:

    No unassigned orders.

rather than an unexplained empty table.

For initial campaign setup:

    No wines have been added to this campaign yet.

    [ Add first wine ]

---

# 58. Admin design principle

Admin UI should prioritize:

    clarity
    density
    speed
    confidence

over decorative marketing design.

The public shop may be expressive and premium.

The administration should feel like a polished operational tool.

Both still belong to the same visual identity.

---

# 59. V1 exclusions

Do not implement in admin V1:

    complex role management
    seller accounts
    customer accounts
    inventory management
    shipping management
    discount management
    newsletter management
    advanced CRM
    accounting software integration
    automated seller payouts

---

# 60. Admin success criteria

The administration is successful if ECM can run the entire campaign
without maintaining a parallel operational spreadsheet for:

- orders;
- seller attribution;
- preparation;
- customer payments;
- seller settlements;
- bottle requirements.

CSV exports remain available for accounting, analysis and archival
purposes.

---

# 61. Decisions

- DECIDED: Admin is authenticated.
- DECIDED: One permission level in V1.
- DECIDED: Manual orders are first-class orders.
- DECIDED: Order list supports search and filters.
- DECIDED: Preparation is grouped primarily by seller.
- DECIDED: Seller financial reconciliation is visible in admin.
- DECIDED: Multiple collected orders can be grouped into one settlement.
- DECIDED: Seller settlement total is calculated by the application.
- DECIDED: Significant actions generate audit history.
- DECIDED: Products are deactivated rather than normally deleted.
- DECIDED: Paid online orders cannot be silently modified financially.
- DECIDED: Admin works on desktop, tablet and mobile.
- DECIDED: Operational clarity takes priority over decorative complexity.
