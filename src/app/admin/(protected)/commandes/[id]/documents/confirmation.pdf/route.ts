import { getAdminOrNull } from "@/lib/auth/dal";
import {
  buildOrderConfirmationContent,
  canGenerateOrderConfirmation,
} from "@/domain/documents/build-order-document-content";
import { selectAuthoritativePaymentForExport } from "@/domain/csv/select-authoritative-payment-for-export";
import { getOrderDetail } from "@/infrastructure/orders/orders";
import { renderOrderDocumentPdf } from "@/infrastructure/documents/pdf-renderer";

/**
 * Order confirmation PDF (Phase 12 Gate 12C) — authenticated, on-
 * demand generation only. `getAdminOrNull()` is the actual
 * authorization boundary, same established pattern as every prior
 * Gate 12A/12B Route Handler.
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
  if (!canGenerateOrderConfirmation(order)) {
    return new Response(
      "Cette commande est annulée — aucun document commercial ne peut être généré.",
      { status: 409 },
    );
  }

  const payment = selectAuthoritativePaymentForExport(payments);
  const content = buildOrderConfirmationContent(order, items, payment?.method ?? null);
  const buffer = await renderOrderDocumentPdf(content);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="confirmation-${order.orderNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
