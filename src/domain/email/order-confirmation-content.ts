import { formatCHF, money } from "@/domain/money";
import { escapeHtml } from "./escape-html";

/**
 * Trusted input for the order-confirmation email (Phase 11 Gate 11A,
 * docs/10-IMPLEMENTATION-PLAN.md §69, docs/01-PRODUCT-SPEC.md §14,
 * docs/03-USER-FLOWS.md §19). Deliberately a plain explicit DTO, not a
 * Drizzle row type or `getOrderDetail()`'s return shape — this keeps
 * the builder pure and independently constructible by both future
 * Gate 11B call sites (checkout's `createOrder()` result and the
 * online-payment trusted-success transition) and by unit tests,
 * without depending on any particular query shape.
 *
 * Every field here must come from PERSISTED order-time data (order
 * snapshot / OrderItem snapshot), never from live catalogue prices —
 * docs/02-BUSINESS-RULES.md BR-PRO-002/BR-PRI-003, "historical prices
 * are immutable." Bundle composition is intentionally not itemized
 * separately here: `items` already carries each OrderItem's own
 * `nameSnapshot`/quantity/line total exactly as sold (a bundle line
 * shows the bundle's own name and price, matching how the admin order
 * detail and confirmation page already present it — see
 * docs/06-ADMIN-SPEC.md §15), not its internal component breakdown.
 *
 * Deliberately excludes: internal database IDs, provider transaction
 * IDs/tokens, campaign ID, or anything else not meant for a customer
 * (docs/10-IMPLEMENTATION-PLAN.md §10 "do not expose internal IDs").
 */
export interface OrderConfirmationEmailInput {
  order: {
    /** Human-readable ECM-YYYY-NNNN — the only order identifier ever shown. */
    orderNumber: string;
    customerFirstName: string;
    customerLastName: string;
    customerEmail: string;
    customerAddress: string;
    customerPostalCode: string;
    customerCity: string;
    /** Optional free-text note the customer entered at checkout — untrusted, always escaped. */
    deliveryNote: string | null;
    /** Integer minor units (CHF rappen) — the persisted, authoritative order total. */
    totalAmount: number;
  };
  items: ReadonlyArray<{
    /** Order-time snapshot name (wine or bundle) — never a live catalogue lookup. */
    nameSnapshot: string;
    quantity: number;
    /** Integer minor units — the persisted line total for this item. */
    lineTotalAmount: number;
  }>;
  /**
   * `TWINT`/`CARD` render the ONLINE_PAID variant; `SELLER` renders the
   * SELLER_PAYMENT variant. Derived internally from this single field
   * rather than accepted as a separate "variant" input, so the two can
   * never disagree (docs/10-IMPLEMENTATION-PLAN.md §9 "do not create
   * two unrelated implementations if they share most content").
   */
  paymentMethod: "TWINT" | "CARD" | "SELLER";
  /** Resolved display name of the assigned seller, or null when unassigned (docs/03-USER-FLOWS.md §17 — a valid, expected state, never fabricated). */
  sellerName: string | null;
}

export interface OrderConfirmationEmailContent {
  subject: string;
  html: string;
  text: string;
}

interface ConfirmationLine {
  name: string;
  quantity: number;
  lineTotal: string;
}

/**
 * Everything both renderers below need, computed exactly once. Both
 * `renderHtml` and `renderText` consume this SAME object — the actual
 * business facts (amounts, names, which payment explanation applies)
 * are therefore structurally unable to diverge between the two output
 * formats (docs/10-IMPLEMENTATION-PLAN.md §13).
 */
interface ConfirmationFields {
  orderNumber: string;
  customerFullName: string;
  lines: ConfirmationLine[];
  total: string;
  paymentParagraph: string;
  deliveryParagraph: string;
  addressLines: string[];
  deliveryNote: string | null;
}

function buildPaymentParagraph(
  paymentMethod: OrderConfirmationEmailInput["paymentMethod"],
  total: string,
  sellerName: string | null,
): string {
  if (paymentMethod === "TWINT" || paymentMethod === "CARD") {
    // ONLINE_PAID — docs/10-IMPLEMENTATION-PLAN.md §18: must clearly
    // state payment received, must never mention paying the seller.
    return `Votre paiement de ${total} a bien été reçu. Aucune action supplémentaire n'est nécessaire de votre part concernant le règlement de cette commande.`;
  }
  // SELLER_PAYMENT — docs/10-IMPLEMENTATION-PLAN.md §19: must clearly
  // state payment is still due to the ECM member, must never imply the
  // order is already paid. Seller identity included only when the
  // persisted assignment actually supports it (never fabricated).
  if (sellerName) {
    return `Le règlement de ${total} se fera directement auprès de ${sellerName}, le membre de Mélodia responsable de la livraison de votre commande.`;
  }
  return `Le règlement de ${total} se fera directement auprès du membre de Mélodia responsable de la livraison de votre commande.`;
}

/**
 * docs/10-IMPLEMENTATION-PLAN.md §20: only the delivery promise
 * already established for V1 (seller = delivery person,
 * docs/02-BUSINESS-RULES.md BR-SEL-003) — no carrier, tracking, pickup
 * point, SLA, or specific date, none of which any product/business
 * document currently promises.
 */
const DELIVERY_PARAGRAPH =
  "Votre commande vous sera livrée directement par un membre de l'Ensemble de Cuivres Mélodia.";

function computeFields(input: OrderConfirmationEmailInput): ConfirmationFields {
  const total = formatCHF(money(input.order.totalAmount));
  return {
    orderNumber: input.order.orderNumber,
    customerFullName: `${input.order.customerFirstName} ${input.order.customerLastName}`,
    lines: input.items.map((item) => ({
      name: item.nameSnapshot,
      quantity: item.quantity,
      lineTotal: formatCHF(money(item.lineTotalAmount)),
    })),
    total,
    paymentParagraph: buildPaymentParagraph(input.paymentMethod, total, input.sellerName),
    deliveryParagraph: DELIVERY_PARAGRAPH,
    addressLines: [
      input.order.customerAddress,
      `${input.order.customerPostalCode} ${input.order.customerCity}`,
    ],
    deliveryNote: input.order.deliveryNote,
  };
}

function renderSubject(fields: ConfirmationFields): string {
  // docs/10-IMPLEMENTATION-PLAN.md §12 — identical for both payment
  // variants: order creation itself is what this subject confirms
  // (docs/02-BUSINESS-RULES.md BR-PAY-005 keeps order status and
  // payment status deliberately separate), never a claim about payment
  // state, so one wording is accurate for both.
  return `Commande ${fields.orderNumber} confirmée — Les Vins de Mélodia`;
}

function renderText(fields: ConfirmationFields): string {
  const lines = fields.lines
    .map((line) => `  ${line.quantity} × ${line.name} — ${line.lineTotal}`)
    .join("\n");

  const noteBlock = fields.deliveryNote ? `\nRemarque : ${fields.deliveryNote}\n` : "";

  return `Les Vins de Mélodia — Commande ${fields.orderNumber}

Bonjour ${fields.customerFullName},

Merci pour votre commande auprès de l'Ensemble de Cuivres Mélodia !

Votre commande :
${lines}

Total : ${fields.total}

${fields.paymentParagraph}

${fields.deliveryParagraph}

Adresse de livraison :
${fields.addressLines.join("\n")}
${noteBlock}
Merci de votre soutien à l'Ensemble de Cuivres Mélodia.

— Les Vins de Mélodia
`;
}

/**
 * Deliberately plain, table-based, inline-styled HTML (docs/10-
 * IMPLEMENTATION-PLAN.md §15): no JavaScript, no external font/CSS,
 * no responsive framework — must stay understandable with styling
 * stripped entirely. Every dynamic value is escaped through
 * `escapeHtml` before interpolation (docs/10-IMPLEMENTATION-PLAN.md
 * §14) — item names included, even though they originate from admin
 * catalogue data rather than direct customer input, since this
 * function never trusts ANY dynamic text as pre-safe HTML.
 */
function renderHtml(fields: ConfirmationFields): string {
  const itemRows = fields.lines
    .map(
      (line) => `
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #E7E2D6;">${escapeHtml(line.quantity + " × " + line.name)}</td>
        <td style="padding:6px 0;border-bottom:1px solid #E7E2D6;text-align:right;white-space:nowrap;">${escapeHtml(line.lineTotal)}</td>
      </tr>`,
    )
    .join("");

  const noteBlock = fields.deliveryNote
    ? `<p style="margin:0 0 16px;">Remarque : ${escapeHtml(fields.deliveryNote)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background-color:#F4EEE4;color:#1B1712;font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4EEE4;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FAF7F0;padding:32px;">
            <tr>
              <td style="padding-bottom:16px;">
                <span style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#7A2E2E;">Les Vins de Mélodia</span>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:16px;">
                <h1 style="margin:0;font-size:20px;font-weight:normal;">Commande ${escapeHtml(fields.orderNumber)} confirmée</h1>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:16px;font-size:15px;line-height:1.5;">
                Bonjour ${escapeHtml(fields.customerFullName)},<br />
                Merci pour votre commande auprès de l'Ensemble de Cuivres Mélodia !
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">
                  ${itemRows}
                  <tr>
                    <td style="padding:10px 0 0;font-weight:bold;">Total</td>
                    <td style="padding:10px 0 0;font-weight:bold;text-align:right;white-space:nowrap;">${escapeHtml(fields.total)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:16px;font-size:15px;line-height:1.5;">${escapeHtml(fields.paymentParagraph)}</td>
            </tr>
            <tr>
              <td style="padding-bottom:16px;font-size:15px;line-height:1.5;">${escapeHtml(fields.deliveryParagraph)}</td>
            </tr>
            <tr>
              <td style="padding-bottom:16px;font-size:15px;line-height:1.5;">
                <strong>Adresse de livraison</strong><br />
                ${fields.addressLines.map(escapeHtml).join("<br />")}
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:8px;font-size:15px;line-height:1.5;">${noteBlock}</td>
            </tr>
            <tr>
              <td style="padding-top:16px;border-top:1px solid #E7E2D6;font-size:13px;color:#6B655B;">
                Merci de votre soutien à l'Ensemble de Cuivres Mélodia.<br />
                — Les Vins de Mélodia
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * The one pure entry point (docs/10-IMPLEMENTATION-PLAN.md §21):
 * persisted order data in, `{subject, html, text}` out. No network, no
 * DB access, no mutation — fully unit-testable. Not called by any
 * order/payment code path yet; Gate 11B wires it in at the proven
 * idempotent transition points.
 */
export function buildOrderConfirmationEmail(
  input: OrderConfirmationEmailInput,
): OrderConfirmationEmailContent {
  const fields = computeFields(input);
  return {
    subject: renderSubject(fields),
    html: renderHtml(fields),
    text: renderText(fields),
  };
}
