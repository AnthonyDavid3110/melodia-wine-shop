"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import { Price, Body } from "@/components/ui/typography";
import { demoCart } from "../_data";

export function Cart() {
  const [quantity, setQuantity] = React.useState(2);

  return (
    <div className="border-border max-w-md border p-6">
      <ul className="flex flex-col gap-3">
        {demoCart.items.map((item) => (
          <li
            key={item.id}
            className="border-border flex items-center justify-between border-b border-dotted pb-3 text-sm last:border-b-0 last:pb-0"
          >
            <Body as="span">{item.name}</Body>
            <Price as="span">{item.lineTotalLabel}</Price>
          </li>
        ))}
      </ul>
      <div className="border-border mt-4 flex items-center justify-between border-t pt-4">
        <Body as="span" className="font-medium">
          Total
        </Body>
        <Price as="span" className="text-lg">
          {demoCart.totalLabel}
        </Price>
      </div>
      <Button className="mt-5 w-full" size="lg">
        Commander
      </Button>

      <div className="border-border mt-6 flex items-center justify-between border-t pt-6">
        <Body as="span">Chasselas — quantité</Body>
        <QuantitySelector label="Chasselas" value={quantity} onChange={setQuantity} />
      </div>
    </div>
  );
}
