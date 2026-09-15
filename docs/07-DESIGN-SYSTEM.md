# Melodia Wine Shop — Design System

> Version: 0.1
> Status: Draft
> Related documents:
> - `01-PRODUCT-SPEC.md`
> - `03-USER-FLOWS.md`
> - `06-ADMIN-SPEC.md`

---

# 1. Purpose

This document defines the visual and interaction direction for Melodia
Wine Shop.

The objective is not to prescribe every pixel before design work begins.

Instead, it defines:

- brand direction;
- visual principles;
- UX principles;
- component expectations;
- responsive behaviour;
- accessibility requirements;
- anti-patterns.

The final visual identity must be intentionally designed before broad UI
implementation begins.

---

# 2. Product identity

Public-facing campaign name:

    Les Vins de Mélodia

Technical application name:

    Melodia Wine Shop

Organisation:

    Ensemble de Cuivres Mélodia

Public domain:

    vins.ecmelodia.ch

The campaign identity should feel connected to Ensemble de Cuivres
Mélodia while being able to stand on its own as an annual fundraising
wine campaign.

---

# 3. Design objective

The public application should feel:

    premium
    elegant
    contemporary
    warm
    crafted
    trustworthy
    human

It should evoke:

    wine
    craftsmanship
    conviviality
    Swiss quality
    music
    Mélodia

without falling into obvious visual clichés.

---

# 4. What the design must NOT feel like

Avoid a website that looks:

    AI-generated
    vibecoded
    generic SaaS
    generic shadcn
    generic Shopify
    generic winery template
    corporate banking
    luxury fashion parody
    rustic cliché

The application must not look like a collection of default components
placed inside rounded cards.

---

# 5. Brand relationship

The wine campaign belongs to Ensemble de Cuivres Mélodia.

The design should therefore retain a recognizable relationship with ECM.

Possible elements:

- ECM logo;
- ECM name;
- existing red/black identity where appropriate;
- subtle musical references;
- campaign-specific typography;
- campaign photography.

However, the wine campaign may develop its own visual expression.

The result should feel like:

    an ECM campaign

rather than:

    an unrelated wine retailer

or:

    the existing ECM website copied into a shop.

---

# 6. Campaign identity

The campaign may use a dedicated lockup such as:

    LES VINS
    DE MÉLODIA

with:

    Ensemble de Cuivres Mélodia

as endorsement.

Example conceptual hierarchy:

    LES VINS
    DE MÉLODIA

    Vente 2026

    Ensemble de Cuivres Mélodia

This is conceptual only.

Claude should explore better typographic compositions before finalizing
the identity.

---

# 7. Visual concept exploration

Before implementing the complete application, create and compare a small
number of coherent visual directions.

Recommended:

    2 or 3 directions maximum

Each direction should demonstrate:

- typography;
- colour palette;
- product card;
- button;
- hero section;
- wine photography treatment;
- basic cart element.

Do not build the entire application before selecting the visual system.

---

# 8. Preferred creative territory

A promising creative territory combines:

    contemporary editorial design
    +
    wine craftsmanship
    +
    subtle Mélodia identity

Think more in terms of:

    wine catalogue
    cultural event
    premium editorial publication

than:

    conventional online shop dashboard.

---

# 9. Musical references

Music may influence the identity subtly.

Possible inspiration:

- rhythm;
- repetition;
- staff-like lines;
- measure structures;
- dynamic spacing;
- brass curves;
- notation-inspired details.

Do NOT decorate the interface with:

    random music notes
    treble clefs everywhere
    literal instruments as UI ornaments

Musical references should be sophisticated and optional.

---

# 10. Wine references

Wine should primarily be communicated through:

- photography;
- typography;
- colour;
- materiality;
- product storytelling.

Avoid excessive use of:

    grape icons
    wine glass icons
    cork textures
    vineyard clip art
    fake handwritten labels

unless a specific design concept justifies them.

---

# 11. Colour system

Exact colours are not frozen in this document.

Claude should define a deliberate palette during the design phase.

The palette should include semantic tokens rather than arbitrary colours
inside components.

Conceptually:

    --background
    --foreground

    --surface
    --surface-muted

    --primary
    --primary-foreground

    --accent
    --accent-foreground

    --border

    --success
    --warning
    --danger

The system should support both public and admin interfaces.

---

# 12. ECM colours

ECM's red and black identity may influence the campaign palette.

However:

- pure black does not need to dominate every screen;
- bright generic red should not automatically become every CTA;
- wine tones should not be introduced simply because the product is wine.

The final palette must be evaluated as a complete composition.

---

# 13. Colour discipline

Use a restrained palette.

Prefer:

    one dominant background family
    one strong brand colour
    one restrained accent
    semantic state colours

Avoid:

    many competing accent colours
    gradients without purpose
    neon effects
    excessive transparency
    rainbow dashboards

---

# 14. Typography

Typography is a major part of the identity.

The final system should likely combine:

    expressive display typography
    +
    highly readable interface typography

The display face may give the campaign personality.

The interface face must remain excellent for:

- prices;
- checkout;
- forms;
- admin tables;
- mobile use.

---

# 15. Typography selection

Do not select fonts only because they are commonly used in generated
websites.

Avoid automatically defaulting to:

    Inter everywhere

unless the final design specifically justifies it.

Font selection should consider:

- French accents;
- CHF amounts;
- readability;
- performance;
- licensing;
- visual personality.

---

# 16. Typographic hierarchy

Define explicit styles for:

    display
    h1
    h2
    h3
    body-large
    body
    body-small
    label
    price
    metadata

Avoid creating arbitrary font sizes page by page.

---

# 17. Editorial typography

Public pages may use stronger editorial hierarchy.

Example:

    DOMAINE EXAMPLE

    Chasselas
    2025

    Yvorne · Chablais

    CHF 18.–

Product information should feel curated rather than database-generated.

---

# 18. Prices

Prices are important commercial information.

They must be:

- immediately visible;
- consistently formatted;
- visually distinct;
- easy to compare.

Preferred Swiss formatting:

    CHF 18.–
    CHF 100.–
    CHF 18.50

Exact formatting helper should be centralized.

---

# 19. Spacing

Use a deliberate spacing scale.

Example conceptual progression:

    xs
    sm
    md
    lg
    xl
    2xl
    3xl

Public pages should have generous breathing room.

Admin pages may use higher information density.

Avoid arbitrary margins such as:

    13px
    27px
    41px

unless genuinely required.

---

# 20. Grid

Public desktop layouts should use a consistent content grid.

The design should support:

- editorial hero sections;
- product grids;
- asymmetric compositions where appropriate;
- readable checkout forms.

Mobile layouts should collapse naturally rather than simply shrinking
desktop designs.

---

# 21. Borders

Borders should be intentional.

Avoid wrapping every piece of content inside:

    rounded rectangle
    +
    border
    +
    shadow

Flat sections, whitespace and typography should often provide enough
structure.

---

# 22. Border radius

Do not use large generic rounded corners everywhere.

Define a restrained radius scale.

Possible uses:

- controls;
- images;
- selected cards;
- dialogs.

The radius system must support the visual identity rather than reproduce
a default SaaS aesthetic.

---

# 23. Shadows

Use shadows sparingly.

Prefer:

- hierarchy through spacing;
- contrast;
- typography;
- borders;
- surface changes.

Avoid floating every component above the page.

---

# 24. Icons

Use one coherent icon family.

Icons should primarily communicate actions.

Examples:

    cart
    search
    plus
    minus
    check
    arrow
    download
    edit

Avoid decorative icon overload.

Icons must not replace clear text where the meaning could be ambiguous.

---

# 25. Photography

Wine photography is central to the public experience.

Final product images should ideally use a consistent photographic
direction.

Potential direction:

    clean bottle photography
    controlled lighting
    consistent crop
    restrained background
    subtle shadow
    high-quality resolution

Until real photography exists, placeholders may be used.

Placeholders must be clearly replaceable.

---

# 26. Product image consistency

Product images should use:

- consistent aspect ratio;
- consistent bottle scale;
- consistent framing;
- consistent visual treatment.

Do not display six bottle images photographed with unrelated styles and
backgrounds if avoidable.

---

# 27. Hero imagery

The homepage does not necessarily need a giant generic vineyard photo.

Better possibilities include:

- campaign still life;
- wine bottles arranged as a collection;
- ECM + wine campaign photography;
- editorial composition using bottle imagery;
- custom campaign artwork.

The hero must communicate the specific campaign, not generic wine.

---

# 28. Homepage

The homepage should quickly communicate:

    what is being sold
    why it is being sold
    who Mélodia is
    how ordering works

Suggested content hierarchy:

    Campaign hero
        ↓
    Wine selection
        ↓
    Discovery box
        ↓
    Support Mélodia
        ↓
    Delivery explanation
        ↓
    Final call to action

Exact composition remains a design decision.

---

# 29. Campaign hero

The hero should contain enough information to understand the offer
without scrolling excessively.

Potential content:

    Les Vins de Mélodia
    Vente 2026

    Découvrez notre sélection de vins et
    soutenez l'Ensemble de Cuivres Mélodia.

    [ Découvrir les vins ]

The actual French copy will be refined later.

---

# 30. Product cards

Product cards must prioritize:

    image
    wine name
    essential metadata
    price
    purchase action

Avoid excessive information directly on the card.

Detailed tasting information belongs on product detail pages or expanded
views.

---

# 31. Product card differentiation

A wine card should not look like a SaaS statistic card.

Consider:

- image-led composition;
- editorial typography;
- minimal framing;
- intentional whitespace.

Example conceptual hierarchy:

    [ bottle image ]

    CHABLAIS · 2025

    Chasselas

    Domaine Example

    CHF 18.–

    [ Ajouter ]

---

# 32. Discovery bundle

The Discovery Box should be visually distinguishable from individual
wines.

It is a featured offer.

Its presentation should clearly show:

- composition;
- number of bottles;
- bundle price;
- benefit compared with buying components individually, if applicable.

Do not present it as merely another wine card.

---

# 33. Cart

The cart must remain simple and transactional.

Prioritize:

- products;
- quantities;
- line totals;
- total;
- checkout CTA.

Avoid marketing distractions once the customer is ready to purchase.

---

# 34. Checkout

Checkout should optimize confidence and completion.

Recommended structure:

    1. Contact
    2. Delivery
    3. Seller
    4. Payment
    5. Review

This may be implemented as:

- one well-structured page;
- or a small number of steps.

Avoid unnecessarily long multi-step flows.

---

# 35. Forms

Forms must use:

- visible labels;
- clear required state;
- useful error messages;
- sensible input types;
- autocomplete attributes;
- large mobile touch targets.

Do not rely on placeholder text as the only label.

---

# 36. Seller selector

The seller selector must handle approximately 70 members.

Use:

    searchable combobox

rather than:

    70-item static select

The no-seller option must remain obvious.

---

# 37. Payment selection

Payment methods should be easy to understand.

Example:

    TWINT
    Paiement sécurisé en ligne

    Carte
    Visa / Mastercard / ...

    Paiement à la livraison
    Payez directement au membre de Mélodia

Provider branding should not dominate the ECM campaign identity.

---

# 38. Confirmation page

The confirmation page should create confidence.

Prioritize:

    confirmation
    order number
    payment status
    delivery explanation
    order summary

Avoid confetti animations or excessive celebration.

A warm thank-you message is appropriate.

---

# 39. Mobile-first

The public application is designed mobile-first.

Likely traffic sources:

    WhatsApp
    social media
    QR code
    direct links

Therefore the 375–430 px experience is not a reduced desktop version.

It is a primary design target.

---

# 40. Mobile navigation

Public navigation should remain minimal.

Potential elements:

    Mélodia / campaign logo
    menu if necessary
    cart

Do not create a complex navigation system for a small campaign website.

---

# 41. Sticky mobile actions

Sticky actions may be useful when they improve conversion.

Examples:

    Add to cart
    View cart
    Checkout

Use only where they do not obscure content or feel aggressive.

---

# 42. Touch targets

Interactive controls should have comfortable touch targets.

Small quantity controls and icon buttons must remain easy to use on
mobile.

---

# 43. Desktop

Desktop should take advantage of additional space.

Do not simply stretch mobile components to full width.

Use:

- stronger grids;
- editorial whitespace;
- larger product imagery;
- richer typography;
- denser admin information.

---

# 44. Public vs admin design

The public and admin applications share:

    typography foundation
    colours
    controls
    icons
    quality standards

But their priorities differ.

Public:

    emotion
    storytelling
    product
    conversion

Admin:

    clarity
    density
    speed
    operational confidence

Do not force both surfaces into exactly the same component layouts.

---

# 45. Admin visual direction

The admin should feel professional and calm.

Avoid:

    giant KPI cards
    excessive gradients
    decorative charts
    glassmorphism
    excessive rounded containers

Prefer:

    clear hierarchy
    useful tables
    compact filters
    strong status indicators
    excellent typography

---

# 46. Status system

Operational states require consistent visual representation.

Examples:

    Confirmed
    Prepared
    Handed to seller
    Delivered
    Cancelled

Payment:

    Pending
    Paid
    Refunded

Settlement:

    Pending
    Settled
    Not applicable

Status must not rely on colour alone.

Use:

    colour
    +
    text
    +
    optional icon

---

# 47. Tables

Admin tables should prioritize readability.

Requirements:

- aligned numeric columns;
- readable order numbers;
- visible statuses;
- clear row actions;
- useful filtering;
- responsive fallback.

Avoid putting every cell inside a badge.

---

# 48. Charts

Use charts only when visualization improves understanding.

Good candidates:

    sales by wine
    seller progress
    sales evolution

Do not create charts merely to make the dashboard look sophisticated.

Tables and numbers may be superior.

---

# 49. Motion

Motion should be restrained and purposeful.

Potential uses:

- page transitions;
- cart feedback;
- accordion expansion;
- subtle image reveal;
- button feedback.

Avoid:

- excessive scroll animation;
- parallax everywhere;
- cursor effects;
- animated gradients;
- bouncing CTAs.

Performance and usability take priority.

---

# 50. Animation duration

Interaction animation should generally feel fast.

Animations must never delay:

    checkout
    admin actions
    form completion
    payment interaction

Respect:

    prefers-reduced-motion

---

# 51. Accessibility

Target practical WCAG 2.2 AA compliance.

At minimum:

- sufficient contrast;
- keyboard navigation;
- visible focus;
- semantic HTML;
- labelled forms;
- accessible dialogs;
- alternative text;
- non-colour status communication;
- reduced-motion support.

Accessibility is part of design quality, not a final cleanup task.

---

# 52. Language

Public application:

    French only

Admin application:

    French

Code and technical documentation:

    English

Avoid mixing English UI labels into the French application unless they
are proper product/provider names.

---

# 53. French copy quality

UI copy must use natural French.

Avoid literal English translations such as awkward equivalents of:

    Checkout
    Fulfilment
    Settlement

Prefer user-facing terms such as:

    Commander
    Préparation
    Livraison
    Paiement
    Reversement

Exact terminology should remain consistent throughout the application.

---

# 54. Swiss conventions

The application serves primarily Swiss customers.

Use conventions appropriate to Switzerland.

Examples:

    CHF 120.–
    NPA
    Localité

Telephone and address inputs should accommodate Swiss usage without
unnecessarily rejecting valid foreign formats.

---

# 55. Loading states

Loading states should be calm and useful.

Use:

- skeletons where appropriate;
- inline progress;
- disabled submit state.

Avoid full-screen spinners for trivial actions.

Payment processing must clearly communicate that the customer should
wait and avoid submitting twice.

---

# 56. Empty states

Empty states should communicate meaning.

Example admin state:

    Aucune commande non attribuée.

Example public state:

    La vente de vins n'est actuellement pas ouverte.

Do not display unexplained blank areas.

---

# 57. Error states

Error states must be visually distinct without becoming alarming.

Payment errors require especially clear language.

Example:

    Le paiement n'a pas pu être confirmé.

    Aucun montant n'a été enregistré comme payé.
    Vous pouvez réessayer.

Exact copy depends on provider behaviour.

---

# 58. Component strategy

shadcn/ui may be used as an implementation foundation.

It must NOT determine the final visual identity.

Allowed approach:

    shadcn primitive
        ↓
    project-specific tokens
        ↓
    project-specific variants
        ↓
    Melodia component

Do not simply copy default shadcn examples into production pages.

---

# 59. Core components

Expected reusable components include:

    Button
    Link
    Input
    Textarea
    Select
    Combobox
    Checkbox
    RadioGroup
    Dialog
    Sheet
    Toast
    Badge
    Table
    Pagination
    QuantitySelector

Public-specific:

    WineCard
    WineDetails
    BundleCard
    CartItem
    CartSummary
    PaymentMethodSelector
    SellerSelector

Admin-specific:

    AdminHeader
    AdminNavigation
    DataTable
    FilterBar
    StatusBadge
    KPI
    OrderTimeline
    SellerProgress
    SettlementSummary

---

# 60. Design tokens

Visual values must be centralized.

At minimum define tokens for:

    colours
    typography
    spacing
    radius
    borders
    shadows
    motion

Avoid repeating arbitrary visual values throughout components.

---

# 61. Dark mode

Dark mode is not required for V1.

Do not implement it merely because the framework makes it easy.

The campaign should have one intentionally designed primary visual
appearance.

---

# 62. Flyer relationship

The A4 folded campaign flyer should use the same visual system as the
website.

Shared elements should include:

    campaign identity
    typography
    colours
    wine imagery
    product naming
    visual hierarchy
    QR code treatment

The flyer and website should feel like two outputs from the same campaign
design system.

---

# 63. QR code

The printed flyer will likely contain a QR code to:

    https://vins.ecmelodia.ch

The QR code must:

- have sufficient contrast;
- have sufficient quiet zone;
- remain large enough for reliable scanning;
- not be excessively stylized.

Visual creativity must not reduce scanning reliability.

---

# 64. Paper order form

The paper form must prioritize handwriting usability.

It should not reproduce the web checkout visually at the expense of
function.

Required space includes:

    customer identity
    address
    contact
    wine quantities
    bundle quantities
    seller
    total
    relevant instructions

The paper form should still visually belong to the campaign.

---

# 65. Design workflow

Before broad implementation:

## Phase 1 — Identity

Define:

    visual concept
    palette
    typography
    imagery direction

## Phase 2 — Foundation

Implement:

    tokens
    typography
    buttons
    form controls
    layout primitives

## Phase 3 — Representative screens

Design:

    homepage
    wine card
    cart
    checkout
    admin order list

## Phase 4 — Review

Verify:

    identity
    consistency
    responsiveness
    accessibility

## Phase 5 — Scale

Only then build remaining screens.

---

# 66. Design review questions

Before accepting the visual direction, ask:

1. Does this look specifically like Mélodia?
2. Does this look like a real designed campaign?
3. Would this still look intentional without animations?
4. Are typography and spacing doing meaningful work?
5. Does it avoid generic component-library aesthetics?
6. Is the mobile experience genuinely strong?
7. Can the same identity work on the printed flyer?
8. Does the shop feel trustworthy enough for payment?
9. Is the admin faster to understand than a spreadsheet?
10. Are decorative elements serving the content?

If several answers are no, the design is not ready to scale.

---

# 67. Anti-vibecoding checklist

Before approving a page, verify that it does NOT rely on:

    default shadcn appearance
    excessive rounded cards
    gradients everywhere
    generic purple/blue SaaS colours
    giant meaningless headings
    random glass effects
    unnecessary badges
    excessive shadows
    decorative dashboard charts
    arbitrary animation
    stock imagery without art direction
    inconsistent spacing
    inconsistent typography
    generic AI-written marketing copy

A technically correct page is not automatically a finished page.

---

# 68. Placeholder policy

During implementation, placeholders are allowed for:

    wine names
    producer details
    photography
    campaign copy

when final content is unavailable.

Placeholders must be:

- obvious in source data;
- centralized;
- easy to replace.

Do not bury temporary content throughout React components.

---

# 69. Content and design

Realistic content should be used as early as possible.

Designing exclusively with:

    Lorem ipsum
    Product 1
    Product 2

can hide real layout problems.

Use representative French wine names, prices and descriptions while
clearly identifying them as placeholder data.

---

# 70. Quality bar

The final result should be credible as a professionally commissioned
campaign website for a Swiss cultural association.

The standard is not:

    "looks good for a generated website"

The standard is:

    "looks intentionally designed and professionally implemented"

---

# 71. Decisions

- DECIDED: Public campaign identity is `Les Vins de Mélodia`.
- DECIDED: The campaign remains visibly connected to ECM.
- DECIDED: Public experience is mobile-first.
- DECIDED: Public design is premium, warm and contemporary.
- DECIDED: Editorial design is preferred over generic e-commerce styling.
- DECIDED: Musical references remain subtle.
- DECIDED: Wine clichés should be avoided.
- DECIDED: Typography is a major identity element.
- DECIDED: Exact palette and typography are selected during design exploration.
- DECIDED: shadcn/ui is a foundation, not the visual identity.
- DECIDED: Dark mode is not required.
- DECIDED: Accessibility targets WCAG 2.2 AA.
- DECIDED: Public and admin share a design foundation but have different priorities.
- DECIDED: Website and printed flyer use the same campaign identity.
- DECIDED: Representative screens must be reviewed before broad UI implementation.
- DECIDED: Real product photography should eventually use consistent art direction.
- DECIDED: The selected visual direction is "Programme V2" — an editorial
  concert-programme identity (warm paper, near-black ink, restrained
  oxblood accent, numbered programme-entry language for wines), refined
  from three compared directions (Programme, Cuivres, Sourdine).
- DECIDED: Display typography is Fraunces; interface typography is IBM
  Plex Sans.
- DECIDED: The approved palette and semantic tokens are implemented in
  `src/app/globals.css` and are the single source of truth for exact
  values; this document records the direction and rationale, not a
  parallel copy of the numbers.

---

# 72. Design decisions still to make

## TBD-DESIGN-001 — Final palette — RESOLVED

Approved palette (Programme V2), implemented as tokens in
`src/app/globals.css`:

    paper (background)     #F4EEE4
    ink (foreground)       #1B1712
    oxblood (accent)       #7A2E2E
    sand                   #EEDFC4  — photography surface only, not a
                                       general UI background
    surface                #FAF7F0  — cards, dialogs, popovers
    surface-muted          #E7E2D6  — secondary panels, table stripes

Semantic status colours (functional — admin/status use, not campaign
identity colours, per the brief for this phase):

    success   #3F6B4A  (unchanged from the original proposal)
    warning   #8A5F27  (adjusted — see below)
    danger    #B23A2E  (unchanged from the original proposal)

`--warning` was adjusted from the originally proposed `#A6752C`, which
measured 3.50:1 against paper — below the 4.5:1 WCAG AA threshold for
normal text. Darkened (same hue) to `#8A5F27`, measuring 4.86:1 on paper
and 5.60:1 on white, with `success`/`danger` re-verified unchanged
(5.33:1 and 5.14:1 on paper respectively). Status colour text should
still be read on `paper`/`surface`, not directly on `surface-muted`
(warning only reaches ~4.3:1 there); the shared `StatusBadge` primitive
sidesteps this by keeping the label in `--foreground` and using the
status colour only for a small dot, per §46.

## TBD-DESIGN-002 — Typography — RESOLVED

    display     Fraunces (400/500/600, italic available)
    interface   IBM Plex Sans (400/500/600)

Loaded via `next/font/google` in `src/lib/fonts.ts`, wired to the
`font-display` / `font-sans` utilities.

## TBD-DESIGN-003 — Campaign lockup — DIRECTION APPROVED, NOT FINAL

The Fraunces typographic treatment of "Les vins de Mélodia" (as built in
`/design/programme-v2` and carried into the production hero composition
in `/design-system`) is the approved **current** campaign identity/
wordmark direction. It is a typographic treatment, not a designed logo,
and it is explicitly not a final, permanent lockup — the eventual
relationship between this wordmark and ECM's own brand assets (see
TBD-DESIGN-005) may still evolve once real ECM brand material is
available.

## TBD-DESIGN-004 — Photography — OPEN

Final bottle photography is not yet available. Unchanged this phase.

## TBD-DESIGN-005 — ECM brand assets — PARTIALLY RESOLVED

What exists in the repository today:

    public/brand/ecm-logo-black.svg

A single black vector mark (a brass-instrument-derived emblem), on a
transparent background, no wordmark baked in. Verified present and
usable as-is on light/paper surfaces.

What is still missing:

    a reversed/white variant for dark surfaces
    any alternate logo lockups (wordmark + mark combined)
    official brand guidelines / usage rules (clear space, minimum size,
      colour restrictions)

No reversed/white variant has been fabricated. Until one is supplied or
commissioned, the mark should only be placed on paper/light backgrounds.

## TBD-DESIGN-006 — Flyer — OPEN

Final flyer layout will be designed after products, prices and campaign
dates are confirmed. Unchanged this phase.
