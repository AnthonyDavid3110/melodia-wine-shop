"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { formatCHF, money } from "@/domain/money";
import {
  customerPaymentStatusLabel,
  orderSourceLabel,
  orderStatusLabel,
} from "@/domain/orders/order-labels";

export interface OrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  createdAt: string;
  sellerName: string | null;
  totalAmount: number;
  status: string;
  customerPaymentStatus: string;
  source: string;
}

const STATUS_TONE: Record<string, StatusTone> = {
  NEW: "neutral",
  CONFIRMED: "accent",
  PREPARED: "accent",
  HANDED_TO_SELLER: "accent",
  DELIVERED: "success",
  CANCELLED: "danger",
};

const PAYMENT_TONE: Record<string, StatusTone> = {
  PENDING: "warning",
  PAID: "success",
  REFUNDED: "neutral",
};

const ALL = "__all__";
const UNASSIGNED = "unassigned";

/**
 * Client-side search/filter over the full order list (Phase 7 §17) —
 * same scale-appropriate convention as Products/Sellers. `initialStatus`/
 * `initialPaymentStatus`/`initialSeller` seed the filter state from
 * `?status=`/`?paymentStatus=`/`?seller=unassigned` query params (Phase
 * 13 Gate 13B) so the dashboard's alert links can deep-link into a
 * pre-filtered view — filtering itself stays entirely client-side and
 * in-memory afterward, unchanged.
 */
export function OrderSearchList({
  orders,
  initialStatus = ALL,
  initialPaymentStatus = ALL,
  initialSeller = ALL,
}: {
  orders: OrderRow[];
  initialStatus?: string;
  initialPaymentStatus?: string;
  initialSeller?: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [paymentStatus, setPaymentStatus] = useState(initialPaymentStatus);
  const [seller, setSeller] = useState(initialSeller);
  const [source, setSource] = useState(ALL);

  const normalized = query.trim().toLowerCase();
  const filtered = orders.filter((order) => {
    if (status !== ALL && order.status !== status) return false;
    if (paymentStatus !== ALL && order.customerPaymentStatus !== paymentStatus) return false;
    if (seller === UNASSIGNED && order.sellerName !== null) return false;
    if (source !== ALL && order.source !== source) return false;
    if (!normalized) return true;
    const haystack = [order.orderNumber, order.customerName, order.sellerName ?? ""]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <Label htmlFor="order-search">Rechercher</Label>
          <Input
            id="order-search"
            type="search"
            placeholder="N° de commande, client, vendeur…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="order-status-filter">Statut</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="order-status-filter" className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les statuts</SelectItem>
              {["NEW", "CONFIRMED", "PREPARED", "HANDED_TO_SELLER", "DELIVERED", "CANCELLED"].map(
                (value) => (
                  <SelectItem key={value} value={value}>
                    {orderStatusLabel(value)}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="order-payment-filter">Paiement</Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger id="order-payment-filter" className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les paiements</SelectItem>
              {["PENDING", "PAID", "REFUNDED"].map((value) => (
                <SelectItem key={value} value={value}>
                  {customerPaymentStatusLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="order-seller-filter">Vendeur</Label>
          <Select value={seller} onValueChange={setSeller}>
            <SelectTrigger id="order-seller-filter" className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les vendeurs</SelectItem>
              <SelectItem value={UNASSIGNED}>Non assigné</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="order-source-filter">Source</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger id="order-source-filter" className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes les sources</SelectItem>
              <SelectItem value="ONLINE">{orderSourceLabel("ONLINE")}</SelectItem>
              <SelectItem value="MANUAL">{orderSourceLabel("MANUAL")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-body-sm font-sans">
          Aucune commande ne correspond.
        </p>
      ) : (
        <div className="border-border overflow-x-auto border">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-border bg-surface-muted border-b text-left">
                <th className="px-4 py-3 font-medium">Commande</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Vendeur</th>
                <th className="px-4 py-3 font-medium">Montant</th>
                <th className="px-4 py-3 font-medium">Paiement</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr
                  key={order.id}
                  className="border-border hover:bg-surface-muted/60 border-b last:border-b-0"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/admin/commandes/${order.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{order.customerName}</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {new Date(order.createdAt).toLocaleDateString("fr-CH")}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {order.sellerName ?? (
                      <span className="text-muted-foreground italic">Non assigné</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {formatCHF(money(order.totalAmount))}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={PAYMENT_TONE[order.customerPaymentStatus] ?? "neutral"}>
                      {customerPaymentStatusLabel(order.customerPaymentStatus)}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={STATUS_TONE[order.status] ?? "neutral"}>
                      {orderStatusLabel(order.status)}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{orderSourceLabel(order.source)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
