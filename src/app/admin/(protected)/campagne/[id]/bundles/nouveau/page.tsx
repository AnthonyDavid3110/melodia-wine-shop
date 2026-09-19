import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { getCampaign } from "@/infrastructure/campaign/campaigns";
import { BundleForm } from "../bundle-form";
import { createBundleAction } from "../actions";

export default async function NewBundlePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <Link
          href={`/admin/campagne/${id}`}
          className="text-muted-foreground text-body-sm font-sans hover:underline"
        >
          ← {campaign.name}
        </Link>
        <h1 className="font-display text-h2">Nouveau carton</h1>
      </div>
      <BundleForm action={createBundleAction.bind(null, id)} submitLabel="Créer le carton" />
    </div>
  );
}
