import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/header";
import { PublicFooter } from "@/components/public/footer";
import { getPublicCatalog } from "@/infrastructure/catalog/get-public-catalog";
import { confirmOnlinePayment } from "@/infrastructure/payments/online-payments";
import { PaymentReturnView } from "./payment-return-view";

export const metadata: Metadata = {
  title: "Paiement",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The Saferpay Payment Page ReturnUrl target (Gate 10B §12). The
 * browser landing here is informational only — this page reads the
 * opaque `rt` token, asks `confirmOnlinePayment()` for the current
 * trusted state (which itself queries Saferpay PaymentPage/Assert when
 * needed), and never marks anything paid merely because this route was
 * opened. No customer PII is rendered here beyond the order number.
 */
export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ rt?: string }>;
}) {
  const { rt } = await searchParams;
  const catalog = await getPublicCatalog();

  let initial: Awaited<ReturnType<typeof confirmOnlinePayment>> | null = null;
  let notFound = false;
  if (rt) {
    try {
      initial = await confirmOnlinePayment(rt);
    } catch {
      notFound = true;
    }
  } else {
    notFound = true;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PublicHeader catalog={catalog} />
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-12 sm:px-8">
        <PaymentReturnView
          returnToken={rt ?? null}
          initialStatus={notFound ? "NOT_FOUND" : (initial?.status ?? "NOT_FOUND")}
          orderNumber={initial?.orderNumber ?? null}
        />
      </main>
      <PublicFooter />
    </div>
  );
}
