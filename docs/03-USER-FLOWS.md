# Melodia Wine Shop — User Flows

> Version: 0.1
> Status: Draft
> Related documents:
> - `01-PRODUCT-SPEC.md`
> - `02-BUSINESS-RULES.md`

---

# 1. Purpose

This document defines the main user flows of Melodia Wine Shop.

It describes how customers and administrators interact with the
application without prescribing the technical implementation.

The objective is to ensure that:

- all important user journeys are explicitly defined;
- edge cases are considered before implementation;
- public and administrative workflows remain consistent;
- Claude Code does not invent product behaviour while implementing UI.

---

# 2. Actors

The V1 application contains three relevant human actors.

## 2.1 Customer

A person purchasing wine from Ensemble de Cuivres Mélodia.

A customer:

- does not require an account;
- can browse products;
- can place an order;
- can optionally select an ECM seller;
- can pay online or to the seller;
- receives an order confirmation.

## 2.2 Administrator

An authenticated person managing the campaign.

In V1, all administrators have equivalent permissions.

Administrators can:

- manage campaigns;
- manage products and bundles;
- manage sellers;
- view orders;
- create manual orders;
- edit orders;
- assign sellers;
- manage fulfilment statuses;
- manage offline payment statuses;
- manage seller settlements;
- view statistics;
- export data;
- generate documents.

## 2.3 Seller

An ECM member associated with customer orders.

In V1, sellers do not authenticate to the application.

A seller:

- may be selected by a customer;
- is responsible for delivering attributed orders;
- may collect payment from customers;
- may need to remit collected money to the ECM treasurer.

Seller actions are therefore recorded by administrators.

---

# 3. Public navigation

Expected public journey:

    Landing page
        │
        ├── Browse wines
        │
        ├── View wine
        │
        ├── View discovery bundle
        │
        └── Learn about the sale
        │
        ↓
    Add products
        ↓
    Cart
        ↓
    Checkout
        ↓
    Payment
        ↓
    Confirmation

The public website must not require authentication.

---

# 4. Flow — Browse active campaign

## Preconditions

- A campaign exists.
- Campaign status is `ACTIVE`.

## Flow

1. Customer opens the public website.
2. Application retrieves the active campaign.
3. Landing page displays campaign information.
4. Active wines and bundles are displayed.
5. Customer can inspect products or add them to the cart.

## No active campaign

If no campaign is active:

1. The public shop must not allow ordering.
2. A friendly informational page is displayed.

Example:

> La vente de vins n'est actuellement pas ouverte.

The application must not expose an empty or broken shop.

---

# 5. Flow — View wine

1. Customer selects a wine.
2. Product information is displayed.
3. Customer chooses a quantity.
4. Customer adds the wine to the cart.
5. Cart state is updated.
6. Customer can continue shopping or open the cart.

Expected information may include:

- name;
- image;
- producer;
- category;
- vintage;
- region;
- grape variety;
- description;
- tasting information;
- price.

Missing optional information must not produce awkward empty UI sections.

---

# 6. Flow — Add individual bottles

Example:

    Pinot Noir
    CHF 20.–

    Quantity
    [-] 3 [+]

    [ Add to cart ]

After addition:

    Cart

    3 × Pinot Noir
    CHF 60.–

The customer may add any positive integer quantity.

There is no multiple-of-six requirement.

---

# 7. Flow — Add discovery bundle

1. Customer views the predefined bundle.
2. Application displays its composition.
3. Customer selects quantity.
4. Customer adds the bundle to the cart.

Example:

    Carton découverte
    CHF 100.–

    Contient :
    1 × Vin A
    1 × Vin B
    1 × Vin C
    1 × Vin D
    1 × Vin E
    1 × Vin F

    Quantity
    [-] 1 [+]

    [ Add to cart ]

The customer cannot alter the composition of the bundle.

---

# 8. Flow — Manage cart

The cart displays:

- items;
- quantities;
- unit prices;
- line totals;
- total order amount.

Customer actions:

- increase quantity;
- decrease quantity;
- remove item;
- continue shopping;
- proceed to checkout.

Example:

    Panier

    Pinot Noir
    3 × CHF 20.–                 CHF 60.–

    Chasselas
    2 × CHF 18.–                 CHF 36.–

    Carton découverte
    1 × CHF 100.–               CHF 100.–

    ────────────────────────────────────

    Total                       CHF 196.–

    [ Continuer mes achats ]
    [ Passer la commande ]

---

# 9. Flow — Empty cart

If the cart contains no items:

- checkout is unavailable;
- the customer is encouraged to return to the catalogue.

Example:

> Votre panier est vide.

---

# 10. Flow — Start checkout

## Preconditions

- Cart contains at least one valid item.
- Campaign remains active.

## Flow

1. Customer opens checkout.
2. Server validates campaign and products.
3. Customer enters contact information.
4. Customer optionally selects a seller.
5. Customer enters an optional delivery note.
6. Customer selects payment method.
7. Customer reviews the order.
8. Customer confirms.

---

# 11. Flow — Enter customer information

Required:

    Prénom
    Nom
    Adresse
    NPA
    Localité
    E-mail
    Téléphone

Optional:

    Remarque pour la livraison

Validation errors must:

- identify the relevant field;
- explain the issue clearly;
- preserve already entered valid data.

---

# 12. Flow — Select seller

Checkout asks:

> Un membre de Mélodia vous a-t-il proposé cette vente ?

The customer can search active sellers.

Example:

    Vendeur

    [ Rechercher un membre... ]

    Anthony David
    Anne Example
    Bastien Example
    ...

Alternative:

    ○ Je ne connais pas de membre / aucun vendeur

Seller selection remains optional.

---

# 13. Flow — Online payment

## Supported methods

The selected payment service provider must expose:

- TWINT;
- payment cards.

## Flow

1. Customer selects online payment.
2. Customer confirms checkout.
3. Application creates the appropriate pending order/payment state.
4. Customer is transferred to or presented with the PSP payment flow.
5. Customer completes payment.
6. PSP confirms payment through a trusted server-to-server mechanism.
7. Application records the payment as `PAID`.
8. Customer sees confirmation.
9. Confirmation email is sent.

Conceptually:

    Customer
       ↓
    Order
       ↓
    Payment Provider
       ↓
    TWINT / Card
       ↓
    Provider confirmation
       ↓
    Payment = PAID
       ↓
    Confirmation

The browser success redirect alone must never be considered authoritative
proof of payment.

---

# 14. Flow — Successful online payment

Expected result:

    Order
    ECM-2026-0042

    Payment method
    TWINT

    Customer payment
    PAID

    Seller settlement
    NOT_APPLICABLE

The customer sees a successful confirmation page.

---

# 15. Flow — Failed online payment

Possible situations:

- payment refused;
- TWINT cancelled;
- card declined;
- payment flow abandoned.

The application must not mark the order as paid.

The customer should receive a clear path to retry where technically
appropriate.

The implementation must avoid creating multiple fulfilment orders from
repeated payment attempts.

Exact PSP-dependent behaviour will be defined in `08-PAYMENTS.md`.

---

# 16. Flow — Payment to seller

1. Customer selects:

   `Paiement auprès du membre lors de la livraison`

2. Customer confirms order.
3. No online payment flow is launched.
4. Order is created.
5. Customer payment status is `PENDING`.
6. Seller settlement status is `PENDING` when a seller is assigned.
7. Confirmation page is displayed.
8. Confirmation email is sent.

Example:

    ECM-2026-0043

    Payment method
    Seller

    Customer payment
    PENDING

    Seller settlement
    PENDING

---

# 17. Flow — Offline order without seller

A customer may choose seller payment while no seller is selected.

The order is allowed.

However, the administration must prominently flag the order as requiring
seller assignment.

Until assignment:

    Seller
    UNASSIGNED

Once an administrator assigns a seller, that seller becomes responsible
for:

- delivery;
- payment collection.

---

# 18. Flow — Order confirmation

**DECIDED (Phase 7):** the confirmation is NOT a permanently public,
order-number-addressable route (resolves a contradiction with an
earlier illustrative `/commande/confirmation/ECM-2026-0042`-style URL
sketched in `08-PAYMENTS.md` §17 in favor of the security model —
`09-SECURITY.md` §22/§23 already required this: a public order number
is not a secret, so a route addressed by it alone must not expose full
customer information). Phase 7's actual implementation: the
order-creation Server Action returns the confirmation data directly to
the client component that called it, which renders it in place —
nothing is fetched from a URL any other visitor could construct or
guess. A page refresh loses this view in V1 (no durable, secure
customer-facing order lookup exists yet, and no email exists yet to
re-deliver it); this is an accepted V1 tradeoff, not an oversight. A
future phase that adds durable confirmation/order-tracking access
requires its own secure mechanism, not a bare order-number URL.

The confirmation page displays at minimum:

- success state;
- order number;
- customer;
- items;
- total;
- payment method;
- payment status;
- seller where applicable;
- delivery information.

The customer must not need an account to view the immediate confirmation.

---

# 19. Flow — Confirmation email

After valid order creation, the system attempts to send a transactional
confirmation email.

The email contains:

- order number;
- order summary;
- total;
- payment information;
- seller information where applicable;
- delivery information.

Email delivery failure must not invalidate the order.

---

# 20. Flow — Administrator login

1. Administrator opens `/admin`.
2. Unauthenticated user is redirected to authentication.
3. Administrator authenticates.
4. Server validates access.
5. Administrator reaches the dashboard.

Authentication implementation is defined later in the architecture
documentation.

---

# 21. Flow — Administrator dashboard

After authentication, administrator sees the active campaign overview.

Expected information includes:

    Vente de vins 2026

    Revenue
    CHF XX'XXX.–

    Orders
    XXX

    Bottles
    X'XXX

    Online paid
    CHF XX'XXX.–

    Seller payment
    CHF XX'XXX.–

    Unassigned orders
    XX

Additional sections:

- wine requirements;
- recent orders;
- seller performance;
- payment alerts;
- operational alerts.

The dashboard must prioritize actionable information.

---

# 22. Flow — View orders

Administrator opens the order list.

Available operations:

- search;
- filter;
- sort;
- open order.

Expected filters:

- order status;
- payment status;
- payment method;
- seller;
- source;
- date.

---

# 23. Flow — View order

Administrator opens an order.

Example:

    ECM-2026-0042

    Jean Dupont
    Rue du Lac 15
    1400 Yverdon-les-Bains
    079 XXX XX XX
    jean@example.ch

    Seller
    Anthony David

    Source
    ONLINE

    Products

    2 × Chasselas
    3 × Pinot Noir
    1 × Discovery Box

    Total
    CHF 196.–

    Payment
    TWINT
    PAID

    Fulfilment
    CONFIRMED

Available actions depend on the order state.

---

# 24. Flow — Create manual order

Used for paper forms.

1. Administrator selects `New manual order`.
2. Administrator enters customer information.
3. Administrator adds products/bundles.
4. Administrator selects seller.
5. Administrator selects payment method.
6. System calculates total.
7. Administrator reviews.
8. Administrator creates order.

Result:

    source = MANUAL

The new order participates normally in all downstream workflows.

---

# 25. Flow — Edit order

Administrator may edit:

- customer details;
- delivery note;
- seller;
- items;
- quantities;
- operational status;
- offline payment information.

If an edit changes the monetary value of an already-paid online order,
the application must prevent silent inconsistency.

Until the dedicated refund/additional-payment workflow exists, the
interface must block or explicitly control such modifications.

---

# 26. Flow — Assign seller

For an unassigned order:

1. Administrator opens order.
2. Selects `Assign seller`.
3. Searches seller.
4. Selects active seller.
5. Confirms.
6. Order is updated.

The seller now becomes the delivery person.

For seller-payment orders, the seller also becomes responsible for
collection.

---

# 27. Flow — Prepare order

During the central preparation session:

1. Staff retrieves preparation information.
2. Physical products are assembled.
3. Order is verified.
4. Administrator marks order `PREPARED`.

Payment status is not changed automatically.

---

# 28. Flow — Hand order to seller

After preparation:

1. Prepared order is given to the responsible seller.
2. Administrator marks `HANDED_TO_SELLER`.

The seller now physically possesses the customer's order.

---

# 29. Flow — Deliver online-paid order

Example initial state:

    Order status
    HANDED_TO_SELLER

    Customer payment
    PAID

    Seller settlement
    NOT_APPLICABLE

Seller delivers order.

Administrator eventually marks:

    Order status
    DELIVERED

No financial action is required from seller.

---

# 30. Flow — Deliver seller-payment order

Initial state:

    Order status
    HANDED_TO_SELLER

    Customer payment
    PENDING

    Seller settlement
    PENDING

Seller delivers order and collects payment.

Administrator records:

    Order status
    DELIVERED

    Customer payment
    PAID

    Seller settlement
    PENDING

Meaning:

> Customer has paid the seller, but ECM has not yet confirmed receipt of
> the money from the seller.

---

# 31. Flow — Seller remits money to treasurer

This flow is part of V1.

1. Seller consolidates money collected from customers.
2. Seller transfers/remits the relevant amount to ECM.
3. Treasurer or another administrator verifies receipt.
4. Administrator records settlement.

Result:

    Customer payment
    PAID

    Seller settlement
    SETTLED

The system records:

- settlement status;
- settlement timestamp;
- administrator responsible for recording the action.

---

# 32. Seller settlement model

The application must distinguish:

## Customer payment

    PENDING
    PAID
    REFUNDED

## Seller settlement

    NOT_APPLICABLE
    PENDING
    SETTLED

Examples:

### Online TWINT

    Customer payment = PAID
    Seller settlement = NOT_APPLICABLE

### Customer has not yet paid seller

    Customer payment = PENDING
    Seller settlement = PENDING

### Customer paid seller, seller has not remitted

    Customer payment = PAID
    Seller settlement = PENDING

### Seller remitted money

    Customer payment = PAID
    Seller settlement = SETTLED

---

# 33. Flow — Seller financial overview

Administrator opens a seller.

Example:

    Anthony David

    Sales
    CHF 1'420.–

    Target
    CHF 1'000.–
    ✓ Target reached

    Online payments
    CHF 870.–

    Seller payments
    CHF 550.–

    Customer payments collected
    CHF 400.–

    Still to collect from customers
    CHF 150.–

    Still to remit to ECM
    CHF 400.–

This view must make it possible to understand the seller's financial
position without maintaining a separate spreadsheet.

---

# 34. Flow — Seller objective

Administrator views seller performance.

For each seller:

    Anthony David
    CHF 1'420 / CHF 1'000
    142 %

    Marie Example
    CHF 780 / CHF 1'000
    78 %

Cancelled orders and refunded amounts are excluded according to business
rules.

---

# 35. Flow — Calculate wine requirements

Administrator opens wine requirements.

Application aggregates:

- individual bottles;
- bundle components;

for all relevant non-cancelled orders.

Example:

    Chasselas
    487 bottles

    Pinot Noir
    612 bottles

    Rosé
    431 bottles

Optional logistical representation:

    487 bottles
    81 full cartons + 1 bottle

The application must not silently round quantities.

---

# 36. Flow — Preparation documents

Administrator can generate preparation information for:

- all orders;
- selected orders;
- a seller;
- an individual order.

Individual preparation sheet includes:

    ECM-2026-0042

    Jean Dupont
    Rue du Lac 15
    1400 Yverdon-les-Bains
    079 XXX XX XX

    Seller
    Anthony David

    2 × Chasselas
    3 × Pinot Noir
    1 × Discovery Box

    Total
    CHF 196.–

    Payment
    TWINT — PAID

    □ Prepared
    □ Handed to seller

---

# 37. Flow — Generate invoice/document

Administrator opens an order and selects:

`Generate invoice`

The system generates a printable PDF using the immutable commercial
information stored with the order.

Exact accounting requirements remain TBD.

---

# 38. Flow — Export data

Administrator selects an export.

Expected V1 exports include:

- orders;
- order items;
- wine requirements;
- seller sales.

CSV is the standard machine-readable export format.

PDF is used for human-facing operational documents.

---

# 39. Flow — Cancel order

1. Administrator opens order.
2. Selects cancel.
3. Application asks for confirmation.
4. Order becomes `CANCELLED`.

The order is not deleted.

It is excluded from:

- wine requirements;
- preparation;
- seller target;
- active revenue.

If payment was already completed, payment/refund status remains a
separate concern.

---

# 40. Flow — Close campaign

After sales end:

1. Administrator closes campaign.
2. Public ordering stops.
3. Existing orders remain available.
4. Administration remains operational.
5. Wine requirements can be finalized.
6. Preparation and delivery workflows continue.

Therefore `CLOSED` means:

> New sales are closed.

It does not mean:

> Campaign operations are finished.

---

# 41. Flow — Archive campaign

After all operational and financial work is complete:

1. Campaign may be archived.
2. Historical information remains readable.
3. Reports remain available.
4. Data is not deleted.

---

# 42. Critical error flows

The implementation must explicitly handle at least:

## Payment provider unavailable

Customer receives a controlled error and is not shown a false payment
confirmation.

## Payment succeeds but browser closes

Server-to-server confirmation still records the payment.

## Duplicate payment notification

No duplicate payment/order is created.

## Email provider unavailable

Order remains valid.

## Product disabled during checkout

Server refuses stale checkout and asks customer to review cart.

## Campaign closes during checkout

Server prevents a new invalid order.

## Seller disabled during checkout

Customer is asked to select another seller or continue without one.

## Network interruption

Repeated customer action must not create uncontrolled duplicate orders.

---

# 43. Mobile flow requirements

Critical public actions must be comfortable on smartphone:

- browsing wines;
- adding quantities;
- opening cart;
- filling checkout;
- searching seller;
- selecting TWINT;
- reading confirmation.

Important actions must not depend on hover behaviour.

---

# 44. V1 flow exclusions

The following flows must not be implemented unless scope changes:

- customer login;
- customer account creation;
- seller login;
- seller dashboard;
- customer self-edit;
- customer self-cancellation;
- postal shipping;
- custom bundle composition;
- quantity discounts;
- multiple delivery waves;
- marketing subscription.

---

# 45. Flow design principle

When implementation details are ambiguous, prefer:

1. fewer customer steps;
2. explicit administrative state;
3. recoverable operations;
4. preservation of historical data;
5. avoidance of hidden automation;
6. avoidance of financial ambiguity.

Financial or fulfilment state must never be inferred when it can be
explicitly represented.
