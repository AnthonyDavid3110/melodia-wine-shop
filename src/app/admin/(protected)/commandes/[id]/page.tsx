import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { StatusBadge } from "@/components/ui/status-badge";
import { getOrderDetail } from "@/infrastructure/orders/orders";
import { listActiveCampaignSellers } from "@/infrastructure/campaign/campaign-sellers";
import { formatSellerName } from "@/domain/sellers/format-seller-name";
import { formatCHF, money } from "@/domain/money";
import {
  customerPaymentStatusLabel,
  paymentAttemptStatusLabel,
  orderSourceLabel,
  orderStatusLabel,
  paymentMethodLabel,
  sellerSettlementStatusLabel,
} from "@/domain/orders/order-labels";
import {
  canCancelOrder,
  canHandOrderToSeller,
  canMarkCustomerPaymentReceived,
  canMarkOrderDelivered,
  canPrepareOrder,
  canReassignSeller,
} from "@/domain/orders/order-guards";
import { canReconcileOnlinePayment } from "@/domain/payments/payment-guards";
import { CustomerInfoForm } from "./customer-info-form";
import { SellerAssignment } from "./seller-assignment";
import { CancelOrderButton } from "./cancel-order-button";
import { MarkPaymentReceivedButton } from "./mark-payment-received-button";
import { VerifyWithSaferpayButton } from "./verify-with-saferpay-button";
import { FulfilmentSection } from "./fulfilment-section";

const EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: "Commande créée",
  SELLER_ASSIGNED: "Vendeur assigné",
  SELLER_CHANGED: "Vendeur modifié",
  ORDER_EDITED: "Commande modifiée",
  ORDER_CANCELLED: "Commande annulée",
  CUSTOMER_PAYMENT_MARKED_PAID: "Paiement client marqué comme reçu",
  SETTLEMENT_COMPLETED: "Règlement à Mélodia enregistré",
  ORDER_PREPARED: "Commande préparée",
  ORDER_HANDED_TO_SELLER: "Commande remise au vendeur",
  ORDER_DELIVERED: "Commande livrée",
  PAYMENT_CONFIRMED_BY_PROVIDER: "Paiement confirmé par Saferpay",
  EMAIL_SENT: "E-mail de confirmation envoyé",
  EMAIL_FAILED: "Échec de l'envoi de l'e-mail de confirmation",
  PAYMENT_ANOMALY_DETECTED: "Anomalie de paiement détectée",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const detail = await getOrderDetail(id);
  if (!detail) {
    notFound();
  }
  const { order, seller, items, payments, events } = detail;

  const eligibleSellers = await listActiveCampaignSellers(order.campaignId);
  const sellerOptions = eligibleSellers.map((s) => ({ value: s.id, label: formatSellerName(s) }));

  return (
    <div className="flex flex-col gap-10">
      <div className="border-border flex flex-col gap-3 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-h2">{order.orderNumber}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={order.status === "CANCELLED" ? "danger" : "accent"}>
              {orderStatusLabel(order.status)}
            </StatusBadge>
            <span className="text-muted-foreground text-body-sm font-sans">
              {orderSourceLabel(order.source)} · Créée le{" "}
              {order.createdAt.toLocaleDateString("fr-CH")} à{" "}
              {order.createdAt.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
        {canCancelOrder(order) ? <CancelOrderButton orderId={order.id} /> : null}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-h3">Client</h2>
        <CustomerInfoForm
          orderId={order.id}
          defaultValues={{
            customerFirstName: order.customerFirstName,
            customerLastName: order.customerLastName,
            customerAddress: order.customerAddress,
            customerPostalCode: order.customerPostalCode,
            customerCity: order.customerCity,
            customerEmail: order.customerEmail,
            customerPhone: order.customerPhone,
            deliveryNote: order.deliveryNote,
          }}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-h3">Vendeur</h2>
        <p className="text-body-sm font-sans">
          Actuel :{" "}
          <span className="font-medium">{seller ? formatSellerName(seller) : "Non assigné"}</span>
        </p>
        {canReassignSeller(order) ? (
          <SellerAssignment
            orderId={order.id}
            orderStatus={order.status}
            currentSellerId={order.sellerId}
            sellerOptions={sellerOptions}
          />
        ) : (
          <p className="text-muted-foreground text-body-sm font-sans">
            Le vendeur a déjà remis l&rsquo;argent de cette commande à Mélodia — il ne peut plus
            être modifié.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-h3">Articles</h2>
        <div className="border-border overflow-x-auto border">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-border bg-surface-muted border-b text-left">
                <th className="px-4 py-3 font-medium">Article</th>
                <th className="px-4 py-3 font-medium">Quantité</th>
                <th className="px-4 py-3 font-medium">Prix unitaire</th>
                <th className="px-4 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-border border-b align-top last:border-b-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.nameSnapshot}</p>
                    {item.bundleComponents.length > 0 ? (
                      <ul className="text-muted-foreground mt-1 text-xs">
                        {item.bundleComponents.map((component) => (
                          <li key={component.id}>
                            {component.quantityPerBundle} × {component.productNameSnapshot}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{item.quantity}</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {formatCHF(money(item.unitPriceAmount))}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {formatCHF(money(item.lineTotalAmount))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-border border-t">
                <td colSpan={3} className="px-4 py-3 text-right font-medium">
                  Total
                </td>
                <td className="px-4 py-3 font-medium whitespace-nowrap tabular-nums">
                  {formatCHF(money(order.totalAmount))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h3">Paiement</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground font-sans">Mode</dt>
            <dd className="font-medium">
              {payments[0] ? paymentMethodLabel(payments[0].method) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground font-sans">Statut du paiement client</dt>
            <dd>
              <StatusBadge tone={order.customerPaymentStatus === "PAID" ? "success" : "warning"}>
                {customerPaymentStatusLabel(order.customerPaymentStatus)}
              </StatusBadge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground font-sans">Règlement à Mélodia</dt>
            <dd>
              <StatusBadge tone="neutral">
                {sellerSettlementStatusLabel(order.sellerSettlementStatus)}
              </StatusBadge>
            </dd>
          </div>
        </dl>
        {canMarkCustomerPaymentReceived(order) ? (
          <div>
            <MarkPaymentReceivedButton
              orderId={order.id}
              formattedAmount={formatCHF(money(order.totalAmount))}
            />
          </div>
        ) : null}

        {canReconcileOnlinePayment(order, payments) ? (
          <div>
            <VerifyWithSaferpayButton orderId={order.id} />
          </div>
        ) : null}

        {payments.some((payment) => payment.provider === "SAFERPAY") ? (
          <div className="flex flex-col gap-2">
            <p className="text-body-sm font-medium">Tentatives de paiement en ligne</p>
            <div className="border-border overflow-x-auto border">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-border bg-surface-muted border-b text-left">
                    <th className="px-4 py-3 font-medium">Méthode</th>
                    <th className="px-4 py-3 font-medium">Montant</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 font-medium">Référence</th>
                    <th className="px-4 py-3 font-medium">Horodatage</th>
                  </tr>
                </thead>
                <tbody>
                  {payments
                    .filter((payment) => payment.provider === "SAFERPAY")
                    .map((payment) => {
                      const timestamp = payment.paidAt ?? payment.failedAt ?? payment.createdAt;
                      return (
                        <tr key={payment.id} className="border-border border-b last:border-b-0">
                          <td className="px-4 py-3">{paymentMethodLabel(payment.method)}</td>
                          <td className="px-4 py-3 tabular-nums">
                            {formatCHF(money(payment.amount))}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              tone={
                                payment.status === "SUCCEEDED"
                                  ? "success"
                                  : payment.status === "FAILED" || payment.status === "CANCELLED"
                                    ? "danger"
                                    : "neutral"
                              }
                            >
                              {paymentAttemptStatusLabel(payment.status)}
                            </StatusBadge>
                          </td>
                          <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                            {payment.providerPaymentId ?? "—"}
                          </td>
                          <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                            {timestamp.toLocaleDateString("fr-CH")}{" "}
                            {timestamp.toLocaleTimeString("fr-CH", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-h3">Préparation et livraison</h2>
        <FulfilmentSection
          orderId={order.id}
          status={order.status}
          hasSeller={order.sellerId !== null}
          canPrepare={canPrepareOrder(order)}
          canHandToSeller={canHandOrderToSeller(order)}
          canMarkDelivered={canMarkOrderDelivered(order)}
          confirmedAt={order.confirmedAt}
          preparedAt={order.preparedAt}
          handedToSellerAt={order.handedToSellerAt}
          deliveredAt={order.deliveredAt}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h3">Historique</h2>
        <ul className="flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id} className="text-body-sm flex items-center justify-between font-sans">
              <span>{EVENT_LABELS[event.type] ?? event.type}</span>
              <span className="text-muted-foreground">
                {event.createdAt.toLocaleDateString("fr-CH")}{" "}
                {event.createdAt.toLocaleTimeString("fr-CH", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
