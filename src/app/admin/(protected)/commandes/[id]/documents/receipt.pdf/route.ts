import { getAdminOrNull } from "@/lib/auth/dal";
import {
  buildReceiptContent,
  canGenerateReceipt,
} from "@/domain/documents/build-order-document-content";
import { selectAuthoritativePaymentForExport } from "@/domain/csv/select-authoritative-payment-for-export";
import { getOrderDetail } from "@/infrastructure/orders/orders";
import { renderOrderDocumentPdf } from "@/infrastructure/documents/pdf-renderer";

/**
 * Receipt PDF (Phase 12 Gate 12C) — authenticated, on-demand
 * generation only, available only once `customerPaymentStatus ===
 * "PAID"`. `canGenerateReceipt()` is a TypeScript type predicate: the
 * `if` below both enforces the runtime eligibility rule AND narrows
 * `order.customerPaymentStatus` to the literal `"PAID"`, which is the
 * only type `buildReceiptContent()` accepts — the compiler refuses to
 * build otherwise, so this route cannot claim payment was received
 * unless it actually was.
 */
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return new Response("Non autorisé.", { status: 401 });
  }

  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) {
    return new Response("Commande introuvable.", { status: 404 });
  }

  const { order, items, payments } = detail;
  if (order.status === "CANCELLED") {
    return new Response(
      "Cette commande est annulée — aucun document commercial ne peut être généré.",
      { status: 409 },
    );
  }
  if (!canGenerateReceipt(order)) {
    return new Response("Le paiement de cette commande n'est pas encore confirmé.", {
      status: 409,
    });
  }

  const payment = selectAuthoritativePaymentForExport(payments);
  const content = buildReceiptContent(order, items, payment?.method ?? null);
  const buffer = await renderOrderDocumentPdf(content);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="recu-${order.orderNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
