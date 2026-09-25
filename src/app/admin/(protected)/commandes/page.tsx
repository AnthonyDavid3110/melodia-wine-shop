import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { listOrders } from "@/infrastructure/orders/orders";
import { formatSellerName } from "@/domain/sellers/format-seller-name";
import { OrderSearchList, type OrderRow } from "./order-search-list";

const VALID_STATUSES = [
  "NEW",
  "CONFIRMED",
  "PREPARED",
  "HANDED_TO_SELLER",
  "DELIVERED",
  "CANCELLED",
];
const VALID_PAYMENT_STATUSES = ["PENDING", "PAID", "REFUNDED"];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; paymentStatus?: string; seller?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const rows = await listOrders();

  const orders: OrderRow[] = rows.map(({ order, seller }) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: `${order.customerFirstName} ${order.customerLastName}`,
    createdAt: order.createdAt.toISOString(),
    sellerName: seller ? formatSellerName(seller) : null,
    totalAmount: order.totalAmount,
    status: order.status,
    customerPaymentStatus: order.customerPaymentStatus,
    source: order.source,
  }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Commandes"
        description="Toutes les commandes de la campagne, en ligne et manuelles."
        action={
          <Button asChild>
            <Link href="/admin/commandes/nouvelle">Nouvelle commande</Link>
          </Button>
        }
      />

      {orders.length === 0 ? (
        <p className="text-muted-foreground text-body-sm font-sans">
          Aucune commande pour le moment.
        </p>
      ) : (
        <OrderSearchList
          orders={orders}
          initialStatus={
            params.status && VALID_STATUSES.includes(params.status) ? params.status : undefined
          }
          initialPaymentStatus={
            params.paymentStatus && VALID_PAYMENT_STATUSES.includes(params.paymentStatus)
              ? params.paymentStatus
              : undefined
          }
          initialSeller={params.seller === "unassigned" ? "unassigned" : undefined}
        />
      )}
    </div>
  );
}
