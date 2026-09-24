import { getAdminOrNull } from "@/lib/auth/dal";
import { buildSellerSalesCsv } from "@/domain/csv/build-seller-sales-csv";
import { generateExportFilename } from "@/domain/csv/generate-export-filename";
import { listCampaignSellerSalesSummaries } from "@/infrastructure/settlements/settlements";
import { resolveRequestedCampaign } from "@/infrastructure/campaign/resolve-requested-campaign";

/** `seller-sales.csv` (Phase 12 Gate 12A) — authenticated, on-demand generation only (see `orders.csv/route.ts` for the 401-vs-redirect rationale). */
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

  const summaries = await listCampaignSellerSalesSummaries(campaign.id);
  const csv = buildSellerSalesCsv(summaries);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${generateExportFilename("ventes-vendeurs")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
