import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderConfirmationEmailInput } from "@/domain/email/order-confirmation-content";

const mockRealSend = vi.hoisted(() => vi.fn());
const mockFakeSend = vi.hoisted(() => vi.fn());

vi.mock("./resend-provider", () => ({ sendEmail: mockRealSend }));
vi.mock("./fake-test-provider", () => ({ sendEmail: mockFakeSend }));

const { sendOrderConfirmationEmail } = await import("./order-confirmation");

const INPUT: OrderConfirmationEmailInput = {
  order: {
    orderNumber: "ECM-2026-0042",
    customerFirstName: "Jean",
    customerLastName: "Dupont",
    customerEmail: "jean@example.ch",
    customerAddress: "Rue du Lac 15",
    customerPostalCode: "1400",
    customerCity: "Yverdon-les-Bains",
    deliveryNote: null,
    totalAmount: 1800,
  },
  items: [{ nameSnapshot: "Chasselas", quantity: 1, lineTotalAmount: 1800 }],
  paymentMethod: "SELLER",
  sellerName: null,
};

const originalNodeEnv = process.env.NODE_ENV;
const originalOptIn = process.env.E2E_FAKE_EMAIL_PROVIDER;

beforeEach(() => {
  mockRealSend.mockReset().mockResolvedValue({ messageId: "real-msg" });
  mockFakeSend.mockReset().mockResolvedValue({ messageId: "fake-msg" });
});

afterEach(() => {
  vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test");
  if (originalOptIn === undefined) {
    delete process.env.E2E_FAKE_EMAIL_PROVIDER;
  } else {
    process.env.E2E_FAKE_EMAIL_PROVIDER = originalOptIn;
  }
  vi.unstubAllEnvs();
});

describe("sendOrderConfirmationEmail — provider selection (production guard)", () => {
  it("uses the REAL provider by default (no opt-in set)", async () => {
    delete process.env.E2E_FAKE_EMAIL_PROVIDER;
    await sendOrderConfirmationEmail(INPUT);
    expect(mockRealSend).toHaveBeenCalledTimes(1);
    expect(mockFakeSend).not.toHaveBeenCalled();
  });

  it("uses the FAKE provider only when NODE_ENV is not production AND the explicit opt-in is set", async () => {
    vi.stubEnv("NODE_ENV", "test");
    process.env.E2E_FAKE_EMAIL_PROVIDER = "true";
    await sendOrderConfirmationEmail(INPUT);
    expect(mockFakeSend).toHaveBeenCalledTimes(1);
    expect(mockRealSend).not.toHaveBeenCalled();
  });

  it("NEVER uses the fake provider in production, even with the opt-in set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.E2E_FAKE_EMAIL_PROVIDER = "true";
    await sendOrderConfirmationEmail(INPUT);
    expect(mockRealSend).toHaveBeenCalledTimes(1);
    expect(mockFakeSend).not.toHaveBeenCalled();
  });

  it("uses the real provider when the opt-in variable is set to something other than the literal string 'true'", async () => {
    vi.stubEnv("NODE_ENV", "test");
    process.env.E2E_FAKE_EMAIL_PROVIDER = "1";
    await sendOrderConfirmationEmail(INPUT);
    expect(mockRealSend).toHaveBeenCalledTimes(1);
    expect(mockFakeSend).not.toHaveBeenCalled();
  });
});

describe("sendOrderConfirmationEmail — composition", () => {
  it("builds content from the input and sends to the order's customer email", async () => {
    delete process.env.E2E_FAKE_EMAIL_PROVIDER;
    const result = await sendOrderConfirmationEmail(INPUT);
    expect(mockRealSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jean@example.ch",
        subject: "Commande ECM-2026-0042 confirmée — Les Vins de Mélodia",
      }),
    );
    expect(result).toEqual({ messageId: "real-msg" });
  });
});
