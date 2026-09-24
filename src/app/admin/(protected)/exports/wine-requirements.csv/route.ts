import { getAdminOrNull } from "@/lib/auth/dal";
import { buildWineRequirementsCsv } from "@/domain/csv/build-wine-requirements-csv";
import { generateExportFilename } from "@/domain/csv/generate-export-filename";
import { getCampaignWineRequirements } from "@/infrastructure/fulfilment/fulfilment";
import { resolveExportCampaign } from "../resolve-export-campaign";

/** `wine-requirements.csv` (Phase 12 Gate 12A) — authenticated, on-demand generation only (see `orders.csv/route.ts` for the 401-vs-redirect rationale). */
export async function GET(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return new Response("Non autorisé.", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const { campaign } = await resolveExportCampaign(searchParams.get("campaign"));
  if (!campaign) {
    return new Response("Aucune campagne disponible pour cet export.", { status: 404 });
  }

  const requirements = await getCampaignWineRequirements(campaign.id);
  const csv = buildWineRequirementsCsv(
    requirements.map((requirement) => ({
      productName: requirement.productName,
      bottles: requirement.bottles,
    })),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${generateExportFilename("besoins-vins")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
