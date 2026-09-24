import { getAdminOrNull } from "@/lib/auth/dal";
import { buildPreparationSheetContent } from "@/domain/documents/build-preparation-sheet-content";
import { buildSellerPreparationSummaryContent } from "@/domain/documents/build-seller-preparation-summary-content";
import { slugifyName } from "@/domain/documents/slugify-name";
import { selectAuthoritativePaymentForExport } from "@/domain/csv/select-authoritative-payment-for-export";
import { resolveRequestedCampaign } from "@/infrastructure/campaign/resolve-requested-campaign";
import { renderSellerPreparationSummaryPdf } from "@/infrastructure/documents/pdf-renderer";
import { listOrdersForCampaignExport } from "@/infrastructure/orders/orders";
import { getSeller } from "@/infrastructure/sellers/sellers";
import { listCampaignSellerSalesSummaries } from "@/infrastructure/settlements/settlements";

/**
 * Seller preparation PDF (Phase 12 Gate 12B) — authenticated, on-
 * demand generation only. Reuses `listOrdersForCampaignExport()`
 * (Gate 12A, already batched — 4 queries total regardless of order
 * count) filtered to this seller's non-`CANCELLED` orders, the exact
 * same eligibility scope `/admin/preparation`'s own fulfilment view
 * uses — no second query, no second eligibility model. The seller's
 * existence and its actual eligible-order membership are both re-
 * verified server-side from `sellerId`/`campaign` path/query values —
 * never trusted merely because the browser supplied them.
 */
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ sellerId: string }> }) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return new Response("Non autorisé.", { status: 401 });
  }

  const { sellerId } = await params;
  const seller = await getSeller(sellerId);
  if (!seller) {
    return new Response("Vendeur introuvable.", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const { campaign } = await resolveRequestedCampaign(searchParams.get("campaign"));
  if (!campaign) {
    return new Response("Aucune campagne disponible.", { status: 404 });
  }

  const rows = await listOrdersForCampaignExport(campaign.id);
  const eligibleRows = rows.filter(
    (row) => row.order.status !== "CANCELLED" && row.seller?.id === sellerId,
  );
  if (eligibleRows.length === 0) {
    return new Response("Aucune commande éligible pour ce vendeur dans cette campagne.", {
      status: 404,
    });
  }

  const salesSummaries = await listCampaignSellerSalesSummaries(campaign.id);
  const sellerSalesTotal = salesSummaries.find((row) => row.sellerId === sellerId)?.sales ?? 0;

  const orderContents = eligibleRows.map((row) => {
    const payment = selectAuthoritativePaymentForExport(row.payments);
    return buildPreparationSheetContent(row.order, row.items, row.seller, payment?.method ?? null);
  });

  const content = buildSellerPreparationSummaryContent(
    seller,
    campaign.name,
    sellerSalesTotal,
    orderContents,
  );
  const buffer = await renderSellerPreparationSummaryPdf(content);

  const filename = `preparation-${slugifyName(seller.lastName)}-${slugifyName(seller.firstName)}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
