# Melodia Wine Shop — Product Specification

> Version: 0.1
> Status: Draft
> Project: Melodia Wine Shop
> Organization: Ensemble de Cuivres Mélodia
> Initial campaign: Wine Sale 2026

---

## 1. Purpose

Melodia Wine Shop is a web platform developed for the Ensemble de Cuivres
Mélodia (ECM) to manage fundraising wine sales.

The platform must allow customers to:

- discover the wines offered by ECM;
- order individual bottles freely;
- purchase predefined wine bundles;
- select the ECM member who proposed the sale;
- pay online or directly to the member delivering the order;
- receive an order confirmation.

The platform must also provide ECM administrators with the tools required to:

- centralize online and paper orders;
- manage products and sellers;
- monitor sales;
- determine quantities to order from wine producers;
- prepare orders;
- distribute orders to sellers;
- monitor offline payments;
- generate preparation documents and invoices;
- export sales data.

The application is intended to be reusable for future wine sale campaigns.

---

## 2. Product principles

### 2.1 Customer simplicity

The customer journey must remain extremely simple.

No customer account is required.

A customer must be able to:

1. open the website;
2. discover the wines;
3. add products to the cart;
4. enter contact information;
5. optionally select an ECM seller;
6. choose a payment method;
7. place the order.

### 2.2 Operational efficiency

The application is not only an online shop.

One of its primary purposes is to simplify the operational work required
after the sale.

The administration interface must therefore make it easy to:

- consolidate all orders;
- calculate wine quantities;
- organize preparation;
- distribute orders between sellers;
- monitor money collected by sellers.

### 2.3 Single source of truth

Online orders and paper orders must ultimately exist in the same system.

A manually entered paper order must behave like an online order once it
has been entered into the application.

### 2.4 Reusability

The application must not be hardcoded specifically for the 2026 sale.

The concept of a sales campaign must allow ECM to reuse the platform for
future campaigns.

Example:

- Wine Sale 2026
- Wine Sale 2027
- Wine Sale 2028

### 2.5 Mobile first

The public website must be designed primarily for smartphones.

A significant proportion of customers are expected to access the shop
through:

- QR codes;
- messaging applications;
- social networks;
- links sent by ECM members.

Desktop and tablet interfaces must remain fully supported.

---

## 3. Scope

### 3.1 V1 — Required

The first production version includes:

#### Public shop

- active campaign landing page;
- wine catalogue;
- product details;
- individual bottle ordering;
- predefined bundles;
- shopping cart;
- guest checkout;
- customer contact and delivery information;
- optional seller selection;
- online payment;
- offline payment to seller;
- order confirmation page;
- transactional confirmation email.

#### Administration

- administrator authentication;
- dashboard;
- campaign management;
- product management;
- bundle management;
- seller management;
- order management;
- manual order creation;
- manual order editing;
- seller assignment;
- order status management;
- payment status management;
- sales statistics;
- seller performance statistics;
- offline payment monitoring;
- wine quantity requirements;
- CSV export;
- invoice PDF generation;
- preparation sheet PDF generation.

### 3.2 V2 — Explicitly out of scope

The following features are not required for the initial launch:

- customer accounts;
- seller accounts;
- seller portal;
- customer self-service order modification;
- customer self-service cancellation;
- advanced discount engine;
- quantity discounts;
- shipment by postal or logistics provider;
- inventory management;
- multiple delivery waves;
- advanced role-based administration permissions;
- marketing/newsletter system;
- loyalty system.

The architecture should avoid unnecessarily preventing these features
from being implemented later.

---

## 4. Campaigns

### 4.1 Campaign concept

All sales belong to a campaign.

Example:

`Wine Sale 2026`

A campaign contains at minimum:

- name;
- public title;
- opening date;
- closing date;
- status;
- seller target;
- products available during the campaign.

### 4.2 Campaign statuses

Supported statuses:

- `DRAFT`
- `ACTIVE`
- `CLOSED`
- `ARCHIVED`

### 4.3 Public visibility

Only the active campaign is available for ordering through the public
shop.

A closed campaign remains accessible to administrators for reporting and
historical purposes.

### 4.4 Delivery waves

**V2**

The initial application assumes one preparation/delivery cycle per
campaign.

Multiple delivery waves are not required for V1.

---

## 5. Product catalogue

### 5.1 Expected catalogue

The initial campaign is expected to contain approximately six wines.

Expected categories include:

- white;
- red;
- rosé.

The exact 2026 selection is currently TBD.

### 5.2 Product information

A wine should support:

- name;
- slug;
- producer/winery;
- wine category;
- vintage;
- region/appellation;
- grape variety;
- short description;
- long description;
- tasting information;
- image;
- unit price;
- active/inactive status;
- display order.

Not every informational field must be mandatory.

### 5.3 Pricing

Prices are expressed in CHF.

Prices are expected to normally use round amounts.

Example:

- CHF 16.–
- CHF 18.–
- CHF 20.–

The system must nevertheless support decimal prices.

---

## 6. Individual bottles

Customers may freely select individual bottles.

There is:

- no minimum number of bottles;
- no requirement to order multiples of six;
- no requirement to compose complete cartons.

Examples of valid orders:

- 1 bottle;
- 5 bottles;
- 7 bottles;
- 13 bottles.

Physical transportation may still use six-bottle cartons.

This packaging constraint must not restrict customer ordering.

---

## 7. Bundles

### 7.1 Principle

The shop may offer predefined bundles.

The initial campaign is expected to offer a discovery bundle containing
approximately one bottle of each wine.

Example:

Discovery Box:

- 1 × Wine A
- 1 × Wine B
- 1 × Wine C
- 1 × Wine D
- 1 × Wine E
- 1 × Wine F

### 7.2 Bundle pricing

A bundle has its own fixed selling price.

Its price may be lower than the sum of the individual products.

### 7.3 Operational calculation

Bundles must be decomposed into their component products when calculating
the total number of bottles required.

Example:

50 Discovery Boxes containing one bottle of each of six wines add:

- +50 Wine A;
- +50 Wine B;
- +50 Wine C;
- +50 Wine D;
- +50 Wine E;
- +50 Wine F.

---

## 8. Shopping cart

The cart supports:

- individual products;
- bundles;
- arbitrary quantities.

The customer must be able to:

- increase quantities;
- decrease quantities;
- remove items;
- see individual prices;
- see line totals;
- see the order total.

The cart must work well on mobile devices.

---

## 9. Checkout

### 9.1 Customer information

Required fields:

- first name;
- last name;
- street/address;
- postal code;
- city;
- email;
- telephone number.

### 9.2 Delivery note

Optional field:

`Delivery note`

Examples:

- Call before delivery.
- Available after 18:00.
- Leave with neighbour if absent.

### 9.3 Customer account

No customer account is required.

---

## 10. Seller selection

### 10.1 Purpose

Customers may associate their order with the ECM member who proposed the
wine sale to them.

ECM has approximately 70 potential sellers.

### 10.2 Seller field

Seller selection is optional.

Because of the number of members, the interface must provide a searchable
selector rather than a long basic dropdown.

### 10.3 No seller

A customer may explicitly continue without selecting a seller.

The order then becomes an unassigned order.

### 10.4 Seller and delivery responsibility

For V1:

> Seller = delivery person.

The selected seller is responsible for delivering the order.

If no seller was selected, an administrator assigns one before
distribution.

### 10.5 Personal seller links

**V2 / Not planned**

Personal URLs for each seller are not required.

---

## 11. Seller objectives

ECM may define a sales objective for its members.

The current expected objective is approximately:

`CHF 1'000.–`

The exact amount remains TBD.

The objective must be configurable at campaign level and must not be
hardcoded.

The administration interface must display each seller's sales total and
progress toward the objective.

The organizational consequence of reaching the target — currently
expected to be exemption from the annual membership fee — is managed by
ECM and does not need to be automated by V1.

---

## 12. Payment methods

### 12.1 Online payment

The application must support online payment through a single payment
provider capable of handling at least:

- TWINT;
- common payment cards.

The final payment service provider is TBD.

### 12.2 Payment to seller

Customers may instead choose to pay directly to the ECM member delivering
the order.

The member is then responsible for:

1. collecting the payment;
2. consolidating the amounts collected;
3. transferring the appropriate amount to the ECM treasurer.

### 12.3 Pricing

The customer-facing product price is identical regardless of payment
method.

Payment provider costs are absorbed into the general product pricing.

There is no payment-method surcharge in V1.

---

## 13. Payment tracking

Online payments must be automatically reconciled with their associated
orders.

Example:

`ECM-2026-0042 → PAID`

Offline payments are manually marked as paid by an administrator.

The administration interface must clearly distinguish:

- revenue already received online;
- revenue to be collected by sellers;
- offline revenue marked as collected.

---

## 14. Order confirmation

After successful order creation, the customer sees a confirmation page.

The customer also receives a confirmation email.

The confirmation contains at minimum:

- order number;
- customer name;
- ordered items;
- total;
- payment method;
- payment status where appropriate;
- selected seller where applicable;
- general delivery information.

---

## 15. Order numbers

Orders require human-readable identifiers.

Expected format:

`ECM-2026-0001`

`ECM-2026-0002`

etc.

The exact implementation must guarantee uniqueness and must not rely
solely on the displayed identifier as a database primary key.

---

## 16. Paper orders

ECM will distribute a printed flyer containing a paper order form for
customers who do not wish to use the website.

Each seller collects their paper forms and sends them to the person
responsible for central data entry.

### 16.1 Manual entry

Administrators must therefore be able to create an order manually.

The same information as an online order can be entered.

### 16.2 Order source

Orders must record their source.

Initial values:

- `ONLINE`
- `MANUAL`

Once entered, manual orders participate in all statistics and operational
processes exactly like online orders.

---

## 17. Order lifecycle

Expected V1 order statuses:

- `NEW`
- `CONFIRMED`
- `PREPARED`
- `HANDED_TO_SELLER`
- `DELIVERED`
- `CANCELLED`

Payment status is tracked separately.

The exact operational transitions will be defined in the Business Rules
document.

---

## 18. Administration dashboard

The dashboard should provide a rapid overview of the active campaign.

Important KPIs include:

- total revenue;
- number of orders;
- total number of bottles;
- online revenue;
- offline revenue;
- number of assigned orders;
- number of unassigned orders;
- sales by wine;
- required bottle quantities;
- seller performance.

The interface should prioritize actionable operational information rather
than decorative analytics.

---

## 19. Seller administration

Administrators can:

- create sellers;
- edit sellers;
- activate/deactivate sellers;
- search sellers;
- view sales attributed to a seller;
- view progress toward the campaign target;
- view orders assigned to a seller;
- view offline amounts associated with the seller.

---

## 20. Order administration

Administrators can:

- search orders;
- filter orders;
- inspect an order;
- create an order;
- edit an order;
- cancel an order;
- assign/reassign a seller;
- update operational status;
- update offline payment status;
- generate documents.

Expected filters include:

- status;
- seller;
- payment status;
- payment method;
- source;
- date.

---

## 21. Wine requirements

The application must calculate the total number of each wine required to
fulfil the campaign.

Calculations include:

- individually ordered bottles;
- bottles contained inside bundles.

This view is intended to be used when placing final orders with wine
producers.

Inventory reservation is not required because the initial campaign is
expected to operate without predefined stock limits.

---

## 22. Preparation

Orders are expected to be prepared centrally during one preparation
session.

The application must support organization by seller.

Administrators must be able to obtain:

- individual preparation sheets;
- orders grouped by seller;
- bottle totals;
- seller totals.

---

## 23. Documents

### 23.1 Preparation sheet

A preparation sheet should contain:

- order number;
- customer;
- delivery address;
- telephone;
- seller;
- products and quantities;
- total amount;
- payment method;
- payment status;
- preparation indicators.

### 23.2 Order confirmation / receipt — RESOLVED (Phase 12 Gate 12C)

The administration interface supports generating two printable PDF
documents per order: a **Confirmation de commande** (available for any
non-cancelled order) and a **Reçu** (available once payment is
confirmed received). Neither is called an "invoice" — ECM's V1 sale
model has no traditional bank-transfer invoice workflow, no QR-bill,
and ECM is not VAT-registered, so this is deliberately not a legal
invoice document. Real organisation identity and wording were provided
directly by ECM and validated before implementation, not invented. See
`docs/05-ARCHITECTURE.md` §34 (Gate 12C implementation) for full detail.

---

## 24. CSV exports

Administrators must be able to export useful operational data as CSV.

At minimum:

- orders;
- order items;
- seller sales;
- wine requirements.

Export structure will be specified later.

---

## 25. Visual direction

The public website should feel:

- premium;
- elegant;
- contemporary;
- warm;
- connected to wine and craftsmanship;
- recognizably associated with Mélodia.

The website must not look like:

- a generic e-commerce template;
- an unmodified component library;
- an obviously AI-generated/vibe-coded interface.

A dedicated design system must be created before broad UI implementation.

The design system should subsequently also guide the printed flyer so
that digital and physical campaign material share the same visual
identity.

---

## 26. Accessibility and usability

The public shop must prioritize:

- readable typography;
- adequate contrast;
- large mobile touch targets;
- understandable forms;
- clear validation errors;
- simple checkout;
- minimal cognitive load.

Accessibility should be treated as a product requirement, not a
post-launch cosmetic task.

---

## 27. Expected scale

Historical reference:

- approximately 500 six-bottle boxes;
- approximately 3,000 bottles.

The new platform should comfortably support a campaign of at least this
size and allow significant growth without architectural changes.

---

## 28. Success criteria

The V1 is successful if ECM can complete an entire wine campaign without
requiring an external spreadsheet as the primary source of truth.

Specifically:

1. customers can order easily;
2. online payments are automatically associated with orders;
3. paper orders can be centralized;
4. ECM can determine exactly how many bottles to purchase;
5. ECM can prepare orders efficiently;
6. every order can be assigned to a seller;
7. offline money can be tracked;
8. seller objectives can be measured;
9. administrators can export the data;
10. the platform can be reused for the next campaign.

---

## 29. Open product decisions

### TBD-001 — 2026 wine selection
Awaiting negotiations with producers.

### TBD-002 — Product prices
Awaiting final wine selection and margins.

### TBD-003 — Discovery bundle composition and price
Awaiting final catalogue.

### TBD-004 — Seller target
Expected around CHF 1'000 but not final.

### TBD-005 — Campaign dates
Expected launch around late September 2026.

### TBD-006 — Delivery date
To be determined.

### TBD-007 — Payment service provider
Must support TWINT and cards.

### TBD-008 — Invoice wording/accounting requirements — RESOLVED (Phase 12 Gate 12C)
ECM provided real organisation identity and accounting decisions
directly (not an invented invoice). See §23.2 above.

### TBD-009 — Exact delivery policy
Local delivery by sellers is the V1 model.
Geographical limits, if any, remain to be defined.

---

## 30. Product decisions already made

- DECIDED: French-only public application.
- DECIDED: Mobile-first.
- DECIDED: No customer accounts.
- DECIDED: Approximately six wines initially.
- DECIDED: Individual bottle ordering allowed.
- DECIDED: No multiple-of-six requirement.
- DECIDED: Predefined bundles supported.
- DECIDED: No quantity discount required for V1.
- DECIDED: Seller selection is optional.
- DECIDED: Seller = delivery person in V1.
- DECIDED: Personal seller URLs are not required.
- DECIDED: Paper orders are entered manually into the same system.
- DECIDED: Online payment supports TWINT and cards.
- DECIDED: Payment to seller is available.
- DECIDED: No payment-method surcharge.
- DECIDED: No shipping carrier integration in V1.
- DECIDED: No inventory management required initially.
- DECIDED: Single preparation/delivery cycle for V1.
- DECIDED: Platform must support future annual campaigns.
