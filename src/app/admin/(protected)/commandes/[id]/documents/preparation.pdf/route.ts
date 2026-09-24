import { getAdminOrNull } from "@/lib/auth/dal";
import { buildPreparationSheetContent } from "@/domain/documents/build-preparation-sheet-content";
import { selectAuthoritativePaymentForExport } from "@/domain/csv/select-authoritative-payment-for-export";
import { getCampaign } from "@/infrastructure/campaign/campaigns";
import { getOrderDetail } from "@/infrastructure/orders/orders";
import { renderPreparationSheetPdf } from "@/infrastructure/documents/pdf-renderer";

/**
 * Individual order preparation PDF (Phase 12 Gate 12B) — authenticated,
 * on-demand generation only. `getAdminOrNull()` is the actual
 * authorization boundary (see `src/app/admin/(protected)/exports/
 * orders.csv/route.ts` for the established 401-vs-redirect rationale
 * this route reuses unchanged).
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

  const { order, seller, items, payments } = detail;
  if (order.status === "CANCELLED") {
    return new Response("Cette commande est annulée — le traitement physique ne s'applique plus.", {
      status: 409,
    });
  }

  const campaign = await getCampaign(order.campaignId);
  if (!campaign) {
    return new Response("Campagne introuvable.", { status: 404 });
  }

  const payment = selectAuthoritativePaymentForExport(payments);
  const content = buildPreparationSheetContent(order, items, seller, payment?.method ?? null);
  const buffer = await renderPreparationSheetPdf(content, campaign.name);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="preparation-${order.orderNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
