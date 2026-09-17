import { describe, expect, it } from "vitest";
import {
  calculateWineRequirements,
  type WineRequirementOrderInput,
} from "./calculate-wine-requirements";

describe("calculateWineRequirements", () => {
  it("aggregates individual bottles across orders", () => {
    const orders: WineRequirementOrderInput[] = [
      { status: "CONFIRMED", items: [{ itemType: "PRODUCT", productId: "wine-a", quantity: 3 }] },
      { status: "DELIVERED", items: [{ itemType: "PRODUCT", productId: "wine-a", quantity: 7 }] },
    ];
    expect(calculateWineRequirements(orders)).toEqual({ "wine-a": 10 });
  });

  it("decomposes bundles and combines with individual bottles (the canonical docs example)", () => {
    // 10 × Wine A individually, 20 × Discovery Box each containing 1 × Wine A → 30 total
    const orders: WineRequirementOrderInput[] = [
      { status: "CONFIRMED", items: [{ itemType: "PRODUCT", productId: "wine-a", quantity: 10 }] },
      {
        status: "CONFIRMED",
        items: [
          {
            itemType: "BUNDLE",
            quantity: 20,
            bundleComponents: [{ productId: "wine-a", quantityPerBundle: 1 }],
          },
        ],
      },
    ];
    expect(calculateWineRequirements(orders)).toEqual({ "wine-a": 30 });
  });

  it("excludes cancelled orders entirely (BR-STA-002)", () => {
    const orders: WineRequirementOrderInput[] = [
      { status: "CONFIRMED", items: [{ itemType: "PRODUCT", productId: "wine-a", quantity: 5 }] },
      { status: "CANCELLED", items: [{ itemType: "PRODUCT", productId: "wine-a", quantity: 999 }] },
    ];
    expect(calculateWineRequirements(orders)).toEqual({ "wine-a": 5 });
  });

  it("excludes cancelled bundle orders from decomposition too", () => {
    const orders: WineRequirementOrderInput[] = [
      {
        status: "CANCELLED",
        items: [
          {
            itemType: "BUNDLE",
            quantity: 100,
            bundleComponents: [{ productId: "wine-a", quantityPerBundle: 1 }],
          },
        ],
      },
    ];
    expect(calculateWineRequirements(orders)).toEqual({});
  });

  it("aggregates multiple distinct products across mixed order types", () => {
    const orders: WineRequirementOrderInput[] = [
      {
        status: "CONFIRMED",
        items: [
          { itemType: "PRODUCT", productId: "wine-a", quantity: 2 },
          { itemType: "PRODUCT", productId: "wine-b", quantity: 1 },
        ],
      },
      {
        status: "PREPARED",
        items: [
          {
            itemType: "BUNDLE",
            quantity: 3,
            bundleComponents: [
              { productId: "wine-a", quantityPerBundle: 1 },
              { productId: "wine-b", quantityPerBundle: 1 },
              { productId: "wine-c", quantityPerBundle: 1 },
            ],
          },
        ],
      },
    ];
    expect(calculateWineRequirements(orders)).toEqual({
      "wine-a": 5,
      "wine-b": 4,
      "wine-c": 3,
    });
  });

  it("returns an empty object for no orders", () => {
    expect(calculateWineRequirements([])).toEqual({});
  });

  it("does not round or otherwise alter exact quantities (BR-REQ-001)", () => {
    const orders: WineRequirementOrderInput[] = [
      { status: "CONFIRMED", items: [{ itemType: "PRODUCT", productId: "wine-a", quantity: 487 }] },
    ];
    expect(calculateWineRequirements(orders)).toEqual({ "wine-a": 487 });
  });
});
