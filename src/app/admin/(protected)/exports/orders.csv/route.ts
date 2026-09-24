import { getAdminOrNull } from "@/lib/auth/dal";
import { formatSellerName } from "@/domain/sellers/format-seller-name";
import { buildOrdersCsv } from "@/domain/csv/build-orders-csv";
import { generateExportFilename } from "@/domain/csv/generate-export-filename";
import { listOrdersForCampaignExport } from "@/infrastructure/orders/orders";
import { resolveRequestedCampaign } from "@/infrastructure/campaign/resolve-requested-campaign";

/**
 * `orders.csv` (Phase 12 Gate 12A) — authenticated, on-demand
 * generation only. `getAdminOrNull()` is the actual authorization
 * boundary for this Route Handler (never the `(protected)` folder
 * name, never the proxy's optimistic cookie check) — a plain 401,
 * per `src/lib/auth/dal.ts`'s own documented "Route Handlers need
 * 401/403 semantics instead of a redirect" guidance, rather than
 * `requireAdmin()`'s page-oriented `redirect()`.
 */
export async function GET(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return new Response("Non autorisé.", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const { campaign } = await resolveRequestedCampaign(searchParams.get("campaign"));
  if (!campaign) {
    return new Response("Aucune campagne disponible pour cet export.", { status: 404 });
  }

  const rows = await listOrdersForCampaignExport(campaign.id);
  const csv = buildOrdersCsv(
    rows.map((row) => ({
      orderNumber: row.order.orderNumber,
      createdAt: row.order.createdAt,
      source: row.order.source,
      status: row.order.status,
      customerFirstName: row.order.customerFirstName,
      customerLastName: row.order.customerLastName,
      customerAddress: row.order.customerAddress,
      customerPostalCode: row.order.customerPostalCode,
      customerCity: row.order.customerCity,
      customerEmail: row.order.customerEmail,
      customerPhone: row.order.customerPhone,
      deliveryNote: row.order.deliveryNote,
      sellerName: row.seller ? formatSellerName(row.seller) : null,
      totalAmount: row.order.totalAmount,
      customerPaymentStatus: row.order.customerPaymentStatus,
      sellerSettlementStatus: row.order.sellerSettlementStatus,
      payments: row.payments,
    })),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${generateExportFilename("commandes")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
