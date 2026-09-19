"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatSellerName } from "@/domain/sellers/format-seller-name";

interface SellerRow {
  id: string;
  firstName: string;
  lastName: string;
  active: boolean;
}

/**
 * Instant, client-side name filter over the full ~70-member roster
 * (Gate 2B §9) — small enough a dataset that a server round trip per
 * keystroke would only add latency, not correctness or scale benefit.
 */
export function SellerSearchList({ sellers }: { sellers: SellerRow[] }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? sellers.filter((seller) =>
        `${seller.firstName} ${seller.lastName}`.toLowerCase().includes(normalized),
      )
    : sellers;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-w-sm flex-col gap-1.5">
        <Label htmlFor="seller-search">Rechercher un vendeur</Label>
        <Input
          id="seller-search"
          type="search"
          placeholder="Nom ou prénom…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-body-sm font-sans">Aucun vendeur ne correspond.</p>
      ) : (
        <div className="border-border overflow-x-auto border">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-border bg-surface-muted border-b text-left">
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((seller) => (
                <tr
                  key={seller.id}
                  className="border-border hover:bg-surface-muted/60 border-b last:border-b-0"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/admin/vendeurs/${seller.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {formatSellerName(seller)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={seller.active ? "success" : "neutral"}>
                      {seller.active ? "Actif" : "Inactif"}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
