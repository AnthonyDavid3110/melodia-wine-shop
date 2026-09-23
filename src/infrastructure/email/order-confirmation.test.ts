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

const { sendOrderConfirmationEmail, dispatchOrderConfirmationEmail, resendOrderConfirmation } =
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
        metadata: {
          emailType: "ORDER_CONFIRMATION",
          variant: "SELLER_PAYMENT",
          trigger: "AUTOMATIC",
        },
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
        metadata: { emailType: "ORDER_CONFIRMATION", variant: "ONLINE_PAID", trigger: "AUTOMATIC" },
      }),
    );
  });

  it("passes a deterministic order-scoped idempotency key to the provider (AUTOMATIC, default)", async () => {
    mockRealSend.mockResolvedValue({ messageId: "sent-3" });
    const { insert } = fakeEventDbHandle();

    await dispatchOrderConfirmationEmail({ insert } as never, "order-3", INPUT);

    expect(mockRealSend).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "order-confirmation/order-3" }),
    );
  });

  it("Gate 11C: ADMIN_RESEND uses a fresh per-attempt key, never the automatic per-order key", async () => {
    mockRealSend.mockResolvedValue({ messageId: "sent-resend-1" });
    const { insert } = fakeEventDbHandle();

    await dispatchOrderConfirmationEmail({ insert } as never, "order-9", INPUT, {
      trigger: "ADMIN_RESEND",
      actor: { type: "ADMIN", adminUserId: "admin-1" },
    });

    const [call] = mockRealSend.mock.calls;
    const key = call?.[0]?.idempotencyKey as string;
    expect(key).toMatch(/^order-confirmation\/resend\/order-9\/[0-9a-f-]{36}$/);
    expect(key).not.toBe("order-confirmation/order-9");
  });

  it("Gate 11C: two ADMIN_RESEND dispatches for the same order get two DIFFERENT keys — an intentional second resend always sends", async () => {
    mockRealSend.mockResolvedValue({ messageId: "sent-resend-2" });
    const { insert: insertA } = fakeEventDbHandle();
    const { insert: insertB } = fakeEventDbHandle();

    await dispatchOrderConfirmationEmail({ insert: insertA } as never, "order-10", INPUT, {
      trigger: "ADMIN_RESEND",
      actor: { type: "ADMIN", adminUserId: "admin-1" },
    });
    await dispatchOrderConfirmationEmail({ insert: insertB } as never, "order-10", INPUT, {
      trigger: "ADMIN_RESEND",
      actor: { type: "ADMIN", adminUserId: "admin-1" },
    });

    const keys = mockRealSend.mock.calls.map((call) => call[0]?.idempotencyKey as string);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("Gate 11C: ADMIN_RESEND records actorType ADMIN and the admin's id on the OrderEvent", async () => {
    mockRealSend.mockResolvedValue({ messageId: "sent-resend-3" });
    const { insert, values } = fakeEventDbHandle();

    await dispatchOrderConfirmationEmail({ insert } as never, "order-11", INPUT, {
      trigger: "ADMIN_RESEND",
      actor: { type: "ADMIN", adminUserId: "admin-42" },
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: "ADMIN",
        adminUserId: "admin-42",
        metadata: expect.objectContaining({ trigger: "ADMIN_RESEND" }),
      }),
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
          trigger: "AUTOMATIC",
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
    ).resolves.toEqual({ status: "EMAIL_SENT" });
  });

  it("never throws even when the send fails AND the event write fails", async () => {
    mockRealSend.mockRejectedValue(new Error("send failed"));
    const insert = vi.fn().mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error("db unavailable")),
    });

    await expect(
      dispatchOrderConfirmationEmail({ insert } as never, "order-8", INPUT),
    ).resolves.toEqual({ status: "EMAIL_FAILED" });
  });
});

describe("resendOrderConfirmation — Gate 11C", () => {
  function fakeResendDbHandle() {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    // `sellerId: null` on every order below avoids exercising the
    // seller-lookup `select()` path — that path is covered by the DB
    // integration suite against a real database; this unit test is
    // about eligibility/dispatch wiring, not seller-name resolution.
    const select = vi.fn();
    return { insert, values, select };
  }

  const baseOrder = {
    orderNumber: "ECM-2026-0099",
    customerFirstName: "Jean",
    customerLastName: "Dupont",
    customerEmail: "jean@example.ch",
    customerAddress: "Rue du Lac 15",
    customerPostalCode: "1400",
    customerCity: "Yverdon-les-Bains",
    deliveryNote: null,
    totalAmount: 1800,
    sellerId: null,
  };
  const items = [{ nameSnapshot: "Chasselas", quantity: 1, lineTotalAmount: 1800 }];

  beforeEach(() => {
    delete process.env.E2E_FAKE_EMAIL_PROVIDER;
  });

  it("eligible SELLER order: sends SELLER_PAYMENT and reports SENT", async () => {
    mockRealSend.mockResolvedValue({ messageId: "resend-1" });
    const { insert, values, select } = fakeResendDbHandle();

    const result = await resendOrderConfirmation(
      { select, insert } as never,
      "order-20",
      { ...baseOrder, status: "CONFIRMED", customerPaymentStatus: "PENDING" },
      items,
      [{ provider: "OFFLINE", method: "SELLER", status: "PENDING" }],
      "admin-1",
    );

    expect(result).toEqual({ status: "SENT" });
    expect(mockRealSend).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: "ADMIN",
        adminUserId: "admin-1",
        metadata: expect.objectContaining({ variant: "SELLER_PAYMENT", trigger: "ADMIN_RESEND" }),
      }),
    );
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("eligible ONLINE_PAID order: sends ONLINE_PAID and reports SENT", async () => {
    mockRealSend.mockResolvedValue({ messageId: "resend-2" });
    const { insert, values, select } = fakeResendDbHandle();

    const result = await resendOrderConfirmation(
      { select, insert } as never,
      "order-21",
      { ...baseOrder, status: "DELIVERED", customerPaymentStatus: "PAID" },
      items,
      [{ provider: "SAFERPAY", method: "TWINT", status: "SUCCEEDED" }],
      "admin-1",
    );

    expect(result).toEqual({ status: "SENT" });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ variant: "ONLINE_PAID" }),
      }),
    );
  });

  it("ineligible order: does NOT call the provider, reports INELIGIBLE with a reason, writes no event", async () => {
    const { insert, select } = fakeResendDbHandle();

    const result = await resendOrderConfirmation(
      { select, insert } as never,
      "order-22",
      { ...baseOrder, status: "CANCELLED", customerPaymentStatus: "PENDING" },
      items,
      [{ provider: "OFFLINE", method: "SELLER", status: "PENDING" }],
      "admin-1",
    );

    expect(result).toEqual({ status: "INELIGIBLE", reason: "order-cancelled" });
    expect(mockRealSend).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("a SELLER order already marked PAID is INELIGIBLE — never resends the payment-due template", async () => {
    const { insert, select } = fakeResendDbHandle();

    const result = await resendOrderConfirmation(
      { select, insert } as never,
      "order-23",
      { ...baseOrder, status: "CONFIRMED", customerPaymentStatus: "PAID" },
      items,
      [{ provider: "OFFLINE", method: "SELLER", status: "SUCCEEDED" }],
      "admin-1",
    );

    expect(result).toEqual({ status: "INELIGIBLE", reason: "seller-payment-not-pending" });
    expect(mockRealSend).not.toHaveBeenCalled();
  });

  it("provider failure: reports FAILED and still records the ADMIN_RESEND EMAIL_FAILED event", async () => {
    mockRealSend.mockRejectedValue(new EmailNetworkError());
    const { insert, values, select } = fakeResendDbHandle();

    const result = await resendOrderConfirmation(
      { select, insert } as never,
      "order-24",
      { ...baseOrder, status: "CONFIRMED", customerPaymentStatus: "PENDING" },
      items,
      [{ provider: "OFFLINE", method: "SELLER", status: "PENDING" }],
      "admin-1",
    );

    expect(result).toEqual({ status: "FAILED" });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "EMAIL_FAILED",
        actorType: "ADMIN",
        metadata: expect.objectContaining({ trigger: "ADMIN_RESEND", category: "network" }),
      }),
    );
  });

  it("an intentional second resend of the same order actually sends again", async () => {
    mockRealSend.mockResolvedValue({ messageId: "resend-again" });
    const first = fakeResendDbHandle();
    const second = fakeResendDbHandle();
    const order = { ...baseOrder, status: "CONFIRMED", customerPaymentStatus: "PENDING" };
    const payments = [{ provider: "OFFLINE", method: "SELLER", status: "PENDING" }];

    await resendOrderConfirmation(
      { select: first.select, insert: first.insert } as never,
      "order-25",
      order,
      items,
      payments,
      "admin-1",
    );
    await resendOrderConfirmation(
      { select: second.select, insert: second.insert } as never,
      "order-25",
      order,
      items,
      payments,
      "admin-1",
    );

    expect(mockRealSend).toHaveBeenCalledTimes(2);
    const keys = mockRealSend.mock.calls.map((call) => call[0]?.idempotencyKey as string);
    expect(keys[0]).not.toBe(keys[1]);
  });
});
