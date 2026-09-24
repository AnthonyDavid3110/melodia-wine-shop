import { getAdminOrNull } from "@/lib/auth/dal";
import { buildOrderItemsCsv } from "@/domain/csv/build-order-items-csv";
import { generateExportFilename } from "@/domain/csv/generate-export-filename";
import { listOrdersForCampaignExport } from "@/infrastructure/orders/orders";
import { resolveRequestedCampaign } from "@/infrastructure/campaign/resolve-requested-campaign";

/** `order-items.csv` (Phase 12 Gate 12A) — authenticated, on-demand generation only (see `orders.csv/route.ts` for the 401-vs-redirect rationale). */
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
  const itemRows = rows.flatMap((row) =>
    row.items.map((item) => ({
      orderNumber: row.order.orderNumber,
      orderStatus: row.order.status,
      itemType: item.itemType,
      nameSnapshot: item.nameSnapshot,
      unitPriceAmount: item.unitPriceAmount,
      quantity: item.quantity,
      lineTotalAmount: item.lineTotalAmount,
      bundleComponents: item.bundleComponents.map((component) => ({
        productNameSnapshot: component.productNameSnapshot,
        quantityPerBundle: component.quantityPerBundle,
      })),
    })),
  );
  const csv = buildOrderItemsCsv(itemRows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${generateExportFilename("lignes-commandes")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
