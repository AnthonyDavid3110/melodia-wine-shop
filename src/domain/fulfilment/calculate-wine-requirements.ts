import { decomposeBundle, type BundleComponentInput } from "../orders/decompose-bundle";

export interface WineRequirementItemInput {
  itemType: "PRODUCT" | "BUNDLE";
  /** Set when itemType === "PRODUCT". */
  productId?: string;
  /** Ordered quantity: bottle count for PRODUCT, bundle count for BUNDLE. */
  quantity: number;
  /** Order-time snapshot (OrderBundleComponent rows), set when itemType === "BUNDLE". */
  bundleComponents?: readonly BundleComponentInput[];
}

export interface WineRequirementOrderInput {
  status: string;
  items: readonly WineRequirementItemInput[];
}

/**
 * Aggregates individual bottles and decomposed bundle components across
 * orders, excluding CANCELLED orders (docs/04-DATA-MODEL.md §28,
 * BR-REQ-001, BR-STA-002). No rounding — the exact bottle count is
 * always returned, never rounded up to a carton multiple.
 */
export function calculateWineRequirements(
  orders: readonly WineRequirementOrderInput[],
): Record<string, number> {
  const requirements: Record<string, number> = {};

  const addQuantity = (productId: string, quantity: number) => {
    requirements[productId] = (requirements[productId] ?? 0) + quantity;
  };

  for (const order of orders) {
    if (order.status === "CANCELLED") {
      continue;
    }

    for (const item of order.items) {
      if (item.itemType === "PRODUCT") {
        if (item.productId) {
          addQuantity(item.productId, item.quantity);
        }
        continue;
      }

      for (const component of decomposeBundle(item.bundleComponents ?? [], item.quantity)) {
        addQuantity(component.productId, component.quantity);
      }
    }
  }

  return requirements;
}
