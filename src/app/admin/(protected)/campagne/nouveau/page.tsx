import { requireAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/admin/page-header";
import { CampaignForm } from "../campaign-form";
import { createCampaignAction } from "../actions";

export default async function NewCampaignPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Nouvelle campagne"
        description="La campagne est créée en brouillon — elle n'est pas publiée automatiquement."
      />
      <CampaignForm action={createCampaignAction} submitLabel="Créer la campagne" />
    </div>
  );
}
