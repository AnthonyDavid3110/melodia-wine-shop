import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderConfirmationEmailInput } from "@/domain/email/order-confirmation-content";

const mockRealSend = vi.hoisted(() => vi.fn());
const mockFakeSend = vi.hoisted(() => vi.fn());

// `importOriginal` preserves the real Email*Error classes —
// `dispatchOrderConfirmationEmail()`'s classifyEmailFailure() does
// `instanceof` checks against them (see resend-provider.ts).
vi.mock("./resend-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./resend-provider")>();
  return { ...actual, sendEmail: mockRealSend };
});
vi.mock("./fake-test-provider", () => ({ sendEmail: mockFakeSend }));

const { sendOrderConfirmationEmail, dispatchOrderConfirmationEmail } =
  await import("./order-confirmation");
const { EmailNetworkError, EmailProviderRejectedError } = await import("./resend-provider");

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

  it("Gate 11B: forwards a caller-supplied idempotencyKey to the provider", async () => {
    delete process.env.E2E_FAKE_EMAIL_PROVIDER;
    await sendOrderConfirmationEmail(INPUT, "order-confirmation/order-1");
    expect(mockRealSend).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "order-confirmation/order-1" }),
    );
  });
});

describe("dispatchOrderConfirmationEmail — Gate 11B", () => {
  function fakeEventDbHandle() {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    return { insert, values };
  }

  beforeEach(() => {
    delete process.env.E2E_FAKE_EMAIL_PROVIDER;
  });

  it("records EMAIL_SENT with the SELLER_PAYMENT variant on success", async () => {
    mockRealSend.mockResolvedValue({ messageId: "sent-1" });
    const { insert, values } = fakeEventDbHandle();

    await dispatchOrderConfirmationEmail({ insert } as never, "order-1", {
      ...INPUT,
      paymentMethod: "SELLER",
    });

    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        type: "EMAIL_SENT",
        actorType: "SYSTEM",
        adminUserId: null,
        metadata: { emailType: "ORDER_CONFIRMATION", variant: "SELLER_PAYMENT" },
      }),
    );
  });

  it("records EMAIL_SENT with the ONLINE_PAID variant for TWINT/CARD", async () => {
    mockRealSend.mockResolvedValue({ messageId: "sent-2" });
    const { insert, values } = fakeEventDbHandle();

    await dispatchOrderConfirmationEmail({ insert } as never, "order-2", {
      ...INPUT,
      paymentMethod: "TWINT",
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { emailType: "ORDER_CONFIRMATION", variant: "ONLINE_PAID" },
      }),
    );
  });

  it("passes a deterministic order-scoped idempotency key to the provider", async () => {
    mockRealSend.mockResolvedValue({ messageId: "sent-3" });
    const { insert } = fakeEventDbHandle();

    await dispatchOrderConfirmationEmail({ insert } as never, "order-3", INPUT);

    expect(mockRealSend).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "order-confirmation/order-3" }),
    );
  });

  it("records EMAIL_FAILED with a sanitized category, never the raw provider message, on EmailProviderRejectedError", async () => {
    mockRealSend.mockRejectedValue(
      new EmailProviderRejectedError("Invalid to field", "validation_error"),
    );
    const { insert, values } = fakeEventDbHandle();

    await dispatchOrderConfirmationEmail({ insert } as never, "order-4", INPUT);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "EMAIL_FAILED",
        metadata: {
          emailType: "ORDER_CONFIRMATION",
          variant: "SELLER_PAYMENT",
          category: "provider-rejected",
        },
      }),
    );
    const [call] = values.mock.calls;
    expect(JSON.stringify(call?.[0])).not.toContain("Invalid to field");
  });

  it("records EMAIL_FAILED with category 'network' on EmailNetworkError", async () => {
    mockRealSend.mockRejectedValue(new EmailNetworkError());
    const { insert, values } = fakeEventDbHandle();

    await dispatchOrderConfirmationEmail({ insert } as never, "order-5", INPUT);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "EMAIL_FAILED",
        metadata: expect.objectContaining({ category: "network" }),
      }),
    );
  });

  it("records EMAIL_FAILED with category 'unknown' for an unrecognized thrown value", async () => {
    mockRealSend.mockRejectedValue(new Error("something else"));
    const { insert, values } = fakeEventDbHandle();

    await dispatchOrderConfirmationEmail({ insert } as never, "order-6", INPUT);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "EMAIL_FAILED",
        metadata: expect.objectContaining({ category: "unknown" }),
      }),
    );
  });

  it("never throws even when the send succeeds but the event write fails", async () => {
    mockRealSend.mockResolvedValue({ messageId: "sent-7" });
    const insert = vi.fn().mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error("db unavailable")),
    });

    await expect(
      dispatchOrderConfirmationEmail({ insert } as never, "order-7", INPUT),
    ).resolves.toBeUndefined();
  });

  it("never throws even when the send fails AND the event write fails", async () => {
    mockRealSend.mockRejectedValue(new Error("send failed"));
    const insert = vi.fn().mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error("db unavailable")),
    });

    await expect(
      dispatchOrderConfirmationEmail({ insert } as never, "order-8", INPUT),
    ).resolves.toBeUndefined();
  });
});
