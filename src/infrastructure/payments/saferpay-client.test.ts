import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { money } from "@/domain/money";
const mockServerEnv = vi.hoisted(() => ({
  SAFERPAY_ENVIRONMENT: "test" as "test" | "live" | undefined,
  SAFERPAY_CUSTOMER_ID: "286754" as string | undefined,
  SAFERPAY_TERMINAL_ID: "17780336" as string | undefined,
  SAFERPAY_API_USERNAME: "test-user" as string | undefined,
  SAFERPAY_API_PASSWORD: "test-pass" as string | undefined,
}));

vi.mock("@/lib/env", () => ({ serverEnv: mockServerEnv }));

const {
  assertPaymentPage,
  capturePayment,
  initializePaymentPage,
  SaferpayConfigurationError,
  SaferpayNetworkError,
  SaferpayRequestError,
} = await import("./saferpay-client");

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  mockServerEnv.SAFERPAY_ENVIRONMENT = "test";
  mockServerEnv.SAFERPAY_CUSTOMER_ID = "286754";
  mockServerEnv.SAFERPAY_TERMINAL_ID = "17780336";
  mockServerEnv.SAFERPAY_API_USERNAME = "test-user";
  mockServerEnv.SAFERPAY_API_PASSWORD = "test-pass";
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("configuration", () => {
  it("throws SaferpayConfigurationError when a required variable is missing", async () => {
    mockServerEnv.SAFERPAY_API_PASSWORD = undefined;
    await expect(
      initializePaymentPage({
        amount: money(1800),
        orderNumber: "ECM-2026-0001",
        description: "Test",
        returnUrl: "https://example.test/retour",
        notifyUrl: "https://example.test/notify",
        paymentMethods: ["TWINT"],
      }),
    ).rejects.toThrow(SaferpayConfigurationError);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("initializePaymentPage", () => {
  it("sends the correct base URL, Basic auth header, RequestHeader, TerminalId, and CHF amount", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, {
        ResponseHeader: { SpecVersion: "1.54", RequestId: "r1" },
        Token: "token-abc",
        RedirectUrl: "https://test.saferpay.com/vt2/api/Payment/PaymentPage/xyz",
        Expiration: "2026-01-01T00:00:00Z",
      }),
    );

    const result = await initializePaymentPage({
      amount: money(1800),
      orderNumber: "ECM-2026-0001",
      description: "Commande ECM-2026-0001",
      returnUrl: "https://vins.ecmelodia.ch/retour?rt=abc",
      notifyUrl: "https://example.test/notify",
      paymentMethods: ["TWINT"],
    });

    expect(result).toEqual({
      token: "token-abc",
      redirectUrl: "https://test.saferpay.com/vt2/api/Payment/PaymentPage/xyz",
      expiration: new Date("2026-01-01T00:00:00Z"),
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("https://test.saferpay.com/api/Payment/v1/PaymentPage/Initialize");
    const headers = init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from("test-user:test-pass").toString("base64")}`,
    );
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init!.body as string);
    expect(body.RequestHeader.CustomerId).toBe("286754");
    expect(body.RequestHeader.SpecVersion).toBeTruthy();
    expect(body.RequestHeader.RequestId).toBeTruthy();
    expect(body.TerminalId).toBe("17780336");
    expect(body.Payment.Amount).toEqual({ Value: "1800", CurrencyCode: "CHF" });
    expect(body.Payment.OrderId).toBe("ECM-2026-0001");
    expect(body.PaymentMethods).toEqual(["TWINT"]);
    expect(body.ReturnUrl).toEqual({ Url: "https://vins.ecmelodia.ch/retour?rt=abc" });
  });

  it("registers the SAME notifyUrl as both Notification.SuccessNotifyUrl and FailNotifyUrl (Gate 10C-B1)", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, {
        ResponseHeader: {},
        Token: "token-abc",
        RedirectUrl: "https://test.saferpay.com/vt2/api/Payment/PaymentPage/xyz",
        Expiration: "2026-01-01T00:00:00Z",
      }),
    );

    await initializePaymentPage({
      amount: money(1800),
      orderNumber: "ECM-2026-0001",
      description: "Commande ECM-2026-0001",
      returnUrl: "https://vins.ecmelodia.ch/commande/retour?rt=abc",
      notifyUrl: "https://vins.ecmelodia.ch/api/payments/saferpay/notify/abc",
      paymentMethods: ["TWINT"],
    });

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(init!.body as string);
    expect(body.Notification.SuccessNotifyUrl).toBe(
      "https://vins.ecmelodia.ch/api/payments/saferpay/notify/abc",
    );
    expect(body.Notification.FailNotifyUrl).toBe(body.Notification.SuccessNotifyUrl);
    // Never the Saferpay Token, a DB UUID, or the human order number in
    // either callback URL — only the opaque token this test itself
    // supplied via notifyUrl/returnUrl.
    expect(body.Notification.SuccessNotifyUrl).not.toContain("token-abc");
    expect(body.Notification.SuccessNotifyUrl).not.toContain("ECM-2026-0001");
    expect(body.ReturnUrl.Url).not.toContain("token-abc");
    expect(body.ReturnUrl.Url).not.toContain("ECM-2026-0001");
  });

  it("generates a distinct RequestId on every call", async () => {
    // A fresh Response per call — a Response body can only be read once.
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(
        jsonResponse(200, {
          ResponseHeader: {},
          Token: "t",
          RedirectUrl: "https://test.saferpay.com/x",
          Expiration: "2026-01-01T00:00:00Z",
        }),
      ),
    );

    const input = {
      amount: money(1800),
      orderNumber: "ECM-2026-0001",
      description: "d",
      returnUrl: "https://example.test",
      notifyUrl: "https://example.test/notify",
      paymentMethods: ["TWINT"] as const,
    };
    await initializePaymentPage(input);
    await initializePaymentPage(input);

    const [, initA] = vi.mocked(fetch).mock.calls[0]!;
    const [, initB] = vi.mocked(fetch).mock.calls[1]!;
    const requestIdA = JSON.parse(initA!.body as string).RequestHeader.RequestId;
    const requestIdB = JSON.parse(initB!.body as string).RequestHeader.RequestId;
    expect(requestIdA).not.toBe(requestIdB);
  });

  it("maps a provider rejection (400+) to SaferpayRequestError carrying ErrorName/Behavior", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(400, {
        ErrorName: "VALIDATION_FAILED",
        ErrorMessage: "Payment.Amount.Value is invalid",
        Behavior: "DO_NOT_RETRY",
      }),
    );

    const call = initializePaymentPage({
      amount: money(1800),
      orderNumber: "ECM-2026-0001",
      description: "d",
      returnUrl: "https://example.test",
      notifyUrl: "https://example.test/notify",
      paymentMethods: ["TWINT"],
    });
    await expect(call).rejects.toBeInstanceOf(SaferpayRequestError);
    await expect(call).rejects.toMatchObject({
      errorName: "VALIDATION_FAILED",
      behavior: "DO_NOT_RETRY",
    });
  });

  it("maps a network failure to SaferpayNetworkError, never leaking the raw error", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      initializePaymentPage({
        amount: money(1800),
        orderNumber: "ECM-2026-0001",
        description: "d",
        returnUrl: "https://example.test",
        notifyUrl: "https://example.test/notify",
        paymentMethods: ["TWINT"],
      }),
    ).rejects.toThrow(SaferpayNetworkError);
  });

  it("maps a malformed (non-JSON) response to SaferpayNetworkError", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("<html>not json</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    );

    await expect(
      initializePaymentPage({
        amount: money(1800),
        orderNumber: "ECM-2026-0001",
        description: "d",
        returnUrl: "https://example.test",
        notifyUrl: "https://example.test/notify",
        paymentMethods: ["TWINT"],
      }),
    ).rejects.toThrow(SaferpayNetworkError);
  });
});

describe("assertPaymentPage", () => {
  it("normalizes an AUTHORIZED success response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, {
        ResponseHeader: {},
        Transaction: {
          Type: "PAYMENT",
          Status: "AUTHORIZED",
          Id: "txn-1",
          Amount: { Value: "1800", CurrencyCode: "CHF" },
        },
        PaymentMeans: { Brand: { Name: "TWINT", PaymentMethod: "TWINT" } },
      }),
    );

    const outcome = await assertPaymentPage("token-abc");
    expect(outcome).toEqual({
      kind: "success",
      providerStatus: "AUTHORIZED",
      transactionId: "txn-1",
      amountValue: "1800",
      currencyCode: "CHF",
      paymentMethod: "TWINT",
    });
  });

  it("normalizes a CAPTURED success response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, {
        ResponseHeader: {},
        Transaction: {
          Type: "PAYMENT",
          Status: "CAPTURED",
          Id: "txn-2",
          Amount: { Value: "2000", CurrencyCode: "CHF" },
        },
        PaymentMeans: { Brand: { Name: "VISA", PaymentMethod: "VISA" } },
      }),
    );

    const outcome = await assertPaymentPage("token-abc");
    expect(outcome.kind).toBe("success");
  });

  it("normalizes a PENDING response (Account-to-Account) to kind: pending", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, {
        ResponseHeader: {},
        Transaction: {
          Type: "PAYMENT",
          Status: "PENDING",
          Id: "txn-3",
          Amount: { Value: "1800", CurrencyCode: "CHF" },
        },
      }),
    );

    const outcome = await assertPaymentPage("token-abc");
    expect(outcome).toEqual({ kind: "pending" });
  });

  it("normalizes a payer-aborted transaction (TRANSACTION_ABORTED) to kind: aborted", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(400, {
        ErrorName: "TRANSACTION_ABORTED",
        ErrorMessage: "This transaction has been aborted by the payer",
        Behavior: "DO_NOT_RETRY",
      }),
    );

    const outcome = await assertPaymentPage("token-abc");
    expect(outcome).toEqual({ kind: "aborted" });
  });

  it("normalizes a processor decline to kind: declined", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(400, {
        ErrorName: "TRANSACTION_DECLINED",
        ErrorMessage: "Card declined",
        Behavior: "OTHER_MEANS",
      }),
    );

    const outcome = await assertPaymentPage("token-abc");
    expect(outcome).toEqual({
      kind: "declined",
      errorName: "TRANSACTION_DECLINED",
      message: "Card declined",
    });
  });

  it("normalizes an unexpected Transaction.Status to kind: unrecognized, never success or a terminal state", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, {
        ResponseHeader: {},
        Transaction: {
          Type: "PAYMENT",
          Status: "SOME_FUTURE_STATUS",
          Id: "txn-4",
          Amount: { Value: "1800", CurrencyCode: "CHF" },
        },
      }),
    );

    const outcome = await assertPaymentPage("token-abc");
    expect(outcome.kind).toBe("unrecognized");
  });

  it("normalizes an error response with no ErrorName to kind: unrecognized", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(500, {}));

    const outcome = await assertPaymentPage("token-abc");
    expect(outcome.kind).toBe("unrecognized");
  });

  it("sends the Token in the request body", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, {
        ResponseHeader: {},
        Transaction: {
          Type: "PAYMENT",
          Status: "AUTHORIZED",
          Id: "txn-5",
          Amount: { Value: "1800", CurrencyCode: "CHF" },
        },
      }),
    );

    await assertPaymentPage("my-token-123");
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(init!.body as string);
    expect(body.Token).toBe("my-token-123");
  });
});

describe("capturePayment", () => {
  it("sends the correct base URL, Basic auth, RequestHeader, and TransactionReference — no Amount (full capture)", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, {
        ResponseHeader: {},
        CaptureId: "cap-abc",
        Status: "CAPTURED",
        Date: "2026-01-01T00:00:00Z",
      }),
    );

    const outcome = await capturePayment("txn-1");
    expect(outcome).toEqual({ kind: "captured", captureId: "cap-abc" });

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("https://test.saferpay.com/api/Payment/v1/Transaction/Capture");
    const headers = init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from("test-user:test-pass").toString("base64")}`,
    );

    const body = JSON.parse(init!.body as string);
    expect(body.RequestHeader.CustomerId).toBe("286754");
    expect(body.RequestHeader.RequestId).toBeTruthy();
    expect(body.TransactionReference).toEqual({ TransactionId: "txn-1" });
    expect(body.Amount).toBeUndefined();
  });

  it("normalizes a PENDING capture response to kind: pending", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, { ResponseHeader: {}, CaptureId: "cap-2", Status: "PENDING" }),
    );

    const outcome = await capturePayment("txn-2");
    expect(outcome).toEqual({ kind: "pending", captureId: "cap-2" });
  });

  it("normalizes TRANSACTION_ALREADY_CAPTURED to kind: already_captured — a success signal, not an error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(400, {
        ErrorName: "TRANSACTION_ALREADY_CAPTURED",
        ErrorMessage: "Transaction already captured",
        Behavior: "DO_NOT_RETRY",
      }),
    );

    const outcome = await capturePayment("txn-3");
    expect(outcome).toEqual({ kind: "already_captured" });
  });

  it("normalizes a genuine provider rejection (e.g. AMOUNT_INVALID) to kind: unrecognized — never a customer-facing decline", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(400, {
        ErrorName: "AMOUNT_INVALID",
        ErrorMessage: "Amount is invalid",
        Behavior: "DO_NOT_RETRY",
      }),
    );

    const outcome = await capturePayment("txn-4");
    expect(outcome.kind).toBe("unrecognized");
  });

  it("normalizes an unexpected Status value to kind: unrecognized", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, { ResponseHeader: {}, CaptureId: "cap-5", Status: "SOME_FUTURE_STATUS" }),
    );

    const outcome = await capturePayment("txn-5");
    expect(outcome.kind).toBe("unrecognized");
  });

  it("maps a network failure to SaferpayNetworkError", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNRESET"));
    await expect(capturePayment("txn-6")).rejects.toThrow(SaferpayNetworkError);
  });

  it("maps a malformed (non-JSON) response to SaferpayNetworkError", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("<html>not json</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    );
    await expect(capturePayment("txn-7")).rejects.toThrow(SaferpayNetworkError);
  });

  it("throws SaferpayConfigurationError when configuration is incomplete, without calling fetch", async () => {
    mockServerEnv.SAFERPAY_API_USERNAME = undefined;
    await expect(capturePayment("txn-8")).rejects.toThrow(SaferpayConfigurationError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("generates a distinct RequestId on every call", async () => {
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(
        jsonResponse(200, { ResponseHeader: {}, CaptureId: "cap-x", Status: "CAPTURED" }),
      ),
    );
    await capturePayment("txn-9");
    await capturePayment("txn-9");

    const [, initA] = vi.mocked(fetch).mock.calls[0]!;
    const [, initB] = vi.mocked(fetch).mock.calls[1]!;
    const requestIdA = JSON.parse(initA!.body as string).RequestHeader.RequestId;
    const requestIdB = JSON.parse(initB!.body as string).RequestHeader.RequestId;
    expect(requestIdA).not.toBe(requestIdB);
  });
});
