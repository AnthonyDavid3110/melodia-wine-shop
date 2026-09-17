export interface BundleComponentInput {
  productId: string;
  quantityPerBundle: number;
}

export interface DecomposedBundleQuantity {
  productId: string;
  quantity: number;
}

/**
 * Expands N ordered bundles into the per-product bottle quantities they
 * contribute (docs/04-DATA-MODEL.md §17/§28, BR-BUN-004). Shared by
 * order-time snapshotting (OrderBundleComponent) and wine-requirement
 * aggregation — both need exactly this multiplication, just against
 * different data sources (live BundleItem vs. snapshotted
 * OrderBundleComponent).
 */
export function decomposeBundle(
  components: readonly BundleComponentInput[],
  bundleQuantity: number,
): DecomposedBundleQuantity[] {
  if (!Number.isInteger(bundleQuantity) || bundleQuantity < 0) {
    throw new Error(`bundleQuantity must be a non-negative integer, received ${bundleQuantity}`);
  }

  return components.map((component) => ({
    productId: component.productId,
    quantity: component.quantityPerBundle * bundleQuantity,
  }));
}
