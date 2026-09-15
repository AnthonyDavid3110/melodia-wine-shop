import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import {
  demoOrders,
  type DemoOrderStatus,
  type DemoPaymentStatus,
  type DemoSettlementStatus,
} from "../_data";

const orderStatusLabel: Record<DemoOrderStatus, string> = {
  NEW: "Nouvelle",
  CONFIRMED: "Confirmée",
  PREPARED: "Préparée",
  HANDED_TO_SELLER: "Remise au membre",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};
const orderStatusTone: Record<DemoOrderStatus, StatusTone> = {
  NEW: "neutral",
  CONFIRMED: "accent",
  PREPARED: "warning",
  HANDED_TO_SELLER: "warning",
  DELIVERED: "success",
  CANCELLED: "danger",
};

const paymentStatusLabel: Record<DemoPaymentStatus, string> = {
  PENDING: "En attente",
  PAID: "Payée",
  REFUNDED: "Remboursée",
};
const paymentStatusTone: Record<DemoPaymentStatus, StatusTone> = {
  PENDING: "warning",
  PAID: "success",
  REFUNDED: "neutral",
};

const settlementStatusLabel: Record<DemoSettlementStatus, string> = {
  NOT_APPLICABLE: "Sans objet",
  PENDING: "À reverser",
  SETTLED: "Reversée",
};
const settlementStatusTone: Record<DemoSettlementStatus, StatusTone> = {
  NOT_APPLICABLE: "neutral",
  PENDING: "warning",
  SETTLED: "success",
};

/**
 * Admin order list — same tokens/typography as the public composition,
 * but density and priorities differ: compact rows, aligned amounts,
 * scannable statuses. Static demo rows only, no table/filter behaviour.
 */
export function AdminOrders() {
  return (
    <div className="border-border overflow-x-auto border">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-border bg-surface-muted border-b text-left">
            <th className="px-3 py-2 font-medium">Commande</th>
            <th className="px-3 py-2 font-medium">Client</th>
            <th className="px-3 py-2 font-medium">Membre</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
            <th className="px-3 py-2 font-medium">Statut</th>
            <th className="px-3 py-2 font-medium">Paiement</th>
            <th className="px-3 py-2 font-medium">Reversement</th>
          </tr>
        </thead>
        <tbody>
          {demoOrders.map((order) => (
            <tr
              key={order.number}
              className="border-border hover:bg-surface-muted/60 border-b last:border-b-0"
            >
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{order.number}</td>
              <td className="px-3 py-2 whitespace-nowrap">{order.customer}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {order.seller ?? <span className="text-muted-foreground italic">Non attribué</span>}
              </td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">{order.total}</td>
              <td className="px-3 py-2">
                <StatusBadge tone={orderStatusTone[order.status]}>
                  {orderStatusLabel[order.status]}
                </StatusBadge>
              </td>
              <td className="px-3 py-2">
                <StatusBadge tone={paymentStatusTone[order.payment]}>
                  {paymentStatusLabel[order.payment]}
                </StatusBadge>
              </td>
              <td className="px-3 py-2">
                <StatusBadge tone={settlementStatusTone[order.settlement]}>
                  {settlementStatusLabel[order.settlement]}
                </StatusBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
