"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatProductCategory } from "@/domain/catalog/product-category-label";

interface ProductRow {
  id: string;
  name: string;
  category: string;
  producer: string | null;
  vintage: number | null;
  active: boolean;
}

/**
 * Instant, client-side filter over the Product master library (Gate 2C
 * §8) — covers name, producer, category (French label and raw value)
 * and vintage, matching the same client-side-filter convention already
 * used for Sellers at this dataset size.
 */
export function ProductSearchList({ products }: { products: ProductRow[] }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? products.filter((product) => {
        const haystack = [
          product.name,
          product.producer ?? "",
          formatProductCategory(product.category),
          product.category,
          product.vintage != null ? String(product.vintage) : "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalized);
      })
    : products;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-w-sm flex-col gap-1.5">
        <Label htmlFor="product-search">Rechercher un produit</Label>
        <Input
          id="product-search"
          type="search"
          placeholder="Nom, producteur, catégorie, millésime…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-body-sm font-sans">Aucun produit ne correspond.</p>
      ) : (
        <div className="border-border overflow-x-auto border">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-border bg-surface-muted border-b text-left">
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="px-4 py-3 font-medium">Producteur</th>
                <th className="px-4 py-3 font-medium">Millésime</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr
                  key={product.id}
                  className="border-border hover:bg-surface-muted/60 border-b last:border-b-0"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/admin/produits/${product.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {product.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatProductCategory(product.category)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {product.producer ?? <span className="text-muted-foreground italic">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {product.vintage ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={product.active ? "success" : "neutral"}>
                      {product.active ? "Actif" : "Inactif"}
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
