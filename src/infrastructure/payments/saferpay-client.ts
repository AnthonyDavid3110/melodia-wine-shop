import "server-only";
import { randomUUID } from "node:crypto";
import { serverEnv } from "@/lib/env";
import type { Money } from "@/domain/money";
import type { SaferpayAssertOutcome } from "@/domain/payments/normalize-saferpay-outcome";

/**
 * Server-only Saferpay JSON API client (Phase 10 Gate 10B). Direct,
 * small, typed `fetch` integration — no third-party Saferpay SDK
 * (CLAUDE.md §38/§104: unnecessary dependency for a straightforward
 * official JSON HTTP API). Every request/response shape and endpoint
 * path here is sourced from the official documentation at
 * https://saferpay.github.io/jsonapi/ (Spec-Version 1.54, consulted
 * live during this gate — see the final gate report for the exact
 * pages read), never from memory or unofficial examples.
 *
 * Pinned to a fixed `SPEC_VERSION` rather than always requesting
 * Saferpay's latest — a moving "latest" target could silently change
 * response shape under us; a deliberate version bump is a reviewed
 * decision, not an accident.
 */

const SPEC_VERSION = "1.54";
const REQUEST_TIMEOUT_MS = 30_000;

const BASE_URL: Record<"test" | "live", string> = {
  test: "https://test.saferpay.com/api",
  live: "https://www.saferpay.com/api",
};

export class SaferpayConfigurationError extends Error {
  constructor() {
    super("La configuration du paiement en ligne est incomplète.");
    this.name = "SaferpayConfigurationError";
  }
}

/** A Saferpay request completed but was rejected — carries the official ErrorName/Behavior for controlled handling upstream, never a raw payload. */
export class SaferpayRequestError extends Error {
  constructor(
    message: string,
    readonly errorName?: string,
    readonly behavior?: string,
  ) {
    super(message);
    this.name = "SaferpayRequestError";
  }
}

/** Network failure, timeout, or a response that isn't valid JSON — never exposes internals to the customer. */
export class SaferpayNetworkError extends Error {
  constructor() {
    super("Le service de paiement en ligne est temporairement indisponible. Veuillez réessayer.");
    this.name = "SaferpayNetworkError";
  }
}

interface SaferpayConfig {
  baseUrl: string;
  customerId: string;
  terminalId: string;
  authorizationHeader: string;
}

/**
 * Whether Saferpay is configured at all — used only to decide whether
 * the checkout UI offers online payment (Gate 10B §19: "online payment
 * is shown only when Saferpay server configuration is available").
 * Never throws, never returns the values themselves.
 */
export function isSaferpayConfigured(): boolean {
  const {
    SAFERPAY_ENVIRONMENT,
    SAFERPAY_CUSTOMER_ID,
    SAFERPAY_TERMINAL_ID,
    SAFERPAY_API_USERNAME,
    SAFERPAY_API_PASSWORD,
  } = serverEnv;
  return Boolean(
    SAFERPAY_ENVIRONMENT &&
    SAFERPAY_CUSTOMER_ID &&
    SAFERPAY_TERMINAL_ID &&
    SAFERPAY_API_USERNAME &&
    SAFERPAY_API_PASSWORD,
  );
}

/** Asserted at the point a request is actually made (matching the DATABASE_URL/BETTER_AUTH_SECRET precedent), never at module load. */
function getSaferpayConfig(): SaferpayConfig {
  const {
    SAFERPAY_ENVIRONMENT,
    SAFERPAY_CUSTOMER_ID,
    SAFERPAY_TERMINAL_ID,
    SAFERPAY_API_USERNAME,
    SAFERPAY_API_PASSWORD,
  } = serverEnv;
  if (
    !SAFERPAY_ENVIRONMENT ||
    !SAFERPAY_CUSTOMER_ID ||
    !SAFERPAY_TERMINAL_ID ||
    !SAFERPAY_API_USERNAME ||
    !SAFERPAY_API_PASSWORD
  ) {
    throw new SaferpayConfigurationError();
  }

  return {
    baseUrl: BASE_URL[SAFERPAY_ENVIRONMENT],
    customerId: SAFERPAY_CUSTOMER_ID,
    terminalId: SAFERPAY_TERMINAL_ID,
    // Built server-side from separate raw credential components — never a
    // precomputed header pasted by the project owner (Gate 10B §2).
    authorizationHeader: `Basic ${Buffer.from(`${SAFERPAY_API_USERNAME}:${SAFERPAY_API_PASSWORD}`).toString("base64")}`,
  };
}

function buildRequestHeader(config: SaferpayConfig) {
  return {
    SpecVersion: SPEC_VERSION,
    CustomerId: config.customerId,
    RequestId: randomUUID(),
    RetryIndicator: 0,
  };
}

interface SaferpayErrorBody {
  ErrorName?: string;
  ErrorMessage?: string;
  Behavior?: string;
  TransactionId?: string;
}

/**
 * The one HTTP call boundary. Never called with a database transaction
 * open (Gate 10B §10/§29) — callers commit/release their transaction
 * before reaching here. Never logs the raw request/response body
 * (docs/09-SECURITY.md §38/§40) — only the safe, already-typed fields
 * this function extracts are ever surfaced to callers or logs.
 */
async function callSaferpay(
  path: string,
  body: unknown,
  config: SaferpayConfig,
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; error: SaferpayErrorBody }> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: config.authorizationHeader,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new SaferpayNetworkError();
  } finally {
    clearTimeout(timeoutHandle);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new SaferpayNetworkError();
  }

  if (!response.ok) {
    return { ok: false, status: response.status, error: (json ?? {}) as SaferpayErrorBody };
  }
  return { ok: true, data: json };
}

export interface InitializePaymentPageInput {
  /** Integer minor units (CHF rappen) — the persisted, authoritative Order total. */
  amount: Money;
  /** ECM human order number, used as Saferpay's merchant `Payment.OrderId` reference. */
  orderNumber: string;
  description: string;
  /** Melodia's own public return route, carrying the opaque ECM return token — never the Saferpay Token. */
  returnUrl: string;
  paymentMethods: readonly ("TWINT" | "VISA" | "MASTERCARD")[];
}

export interface InitializePaymentPageResult {
  /** The Saferpay session Token — server-side only, persisted as `payments.providerSessionId`, never placed in a public URL (Gate 10B §11). */
  token: string;
  redirectUrl: string;
  expiration: Date;
}

interface InitializeResponseBody {
  Token: string;
  RedirectUrl: string;
  Expiration: string;
}

/** PaymentPage/Initialize — https://saferpay.github.io/jsonapi/#Payment_v1_PaymentPage_Initialize */
export async function initializePaymentPage(
  input: InitializePaymentPageInput,
): Promise<InitializePaymentPageResult> {
  const config = getSaferpayConfig();
  const body = {
    RequestHeader: buildRequestHeader(config),
    TerminalId: config.terminalId,
    Payment: {
      Amount: { Value: String(input.amount), CurrencyCode: "CHF" },
      OrderId: input.orderNumber,
      Description: input.description,
    },
    PaymentMethods: input.paymentMethods,
    ReturnUrl: { Url: input.returnUrl },
  };

  const result = await callSaferpay("/Payment/v1/PaymentPage/Initialize", body, config);
  if (!result.ok) {
    throw new SaferpayRequestError(
      result.error.ErrorMessage ?? "Saferpay Initialize failed",
      result.error.ErrorName,
      result.error.Behavior,
    );
  }

  const data = result.data as InitializeResponseBody;
  return {
    token: data.Token,
    redirectUrl: data.RedirectUrl,
    expiration: new Date(data.Expiration),
  };
}

interface AssertResponseBody {
  Transaction: {
    Status: string;
    Id: string;
    Amount: { Value: string; CurrencyCode: string };
  };
  PaymentMeans?: {
    Brand?: { Name?: string; PaymentMethod?: string };
  };
}

/**
 * PaymentPage/Assert — https://saferpay.github.io/jsonapi/#Payment_v1_PaymentPage_Assert
 * — the sole authoritative result lookup (Gate 10B §1/§15). A
 * successful call (HTTP 200) means `AUTHORIZED`/`CAPTURED` (or
 * `PENDING` for Account-to-Account methods this project doesn't use);
 * a failed/aborted/declined transaction is an HTTP 400+ error response
 * instead — there is no single unified status enum, matching the
 * official protocol exactly rather than forcing a generic webhook
 * shape onto it.
 */
export async function assertPaymentPage(token: string): Promise<SaferpayAssertOutcome> {
  const config = getSaferpayConfig();
  const body = { RequestHeader: buildRequestHeader(config), Token: token };

  const result = await callSaferpay("/Payment/v1/PaymentPage/Assert", body, config);

  if (result.ok) {
    const data = result.data as AssertResponseBody;
    const status = data.Transaction.Status;
    if (status === "AUTHORIZED" || status === "CAPTURED") {
      return {
        kind: "success",
        providerStatus: status,
        transactionId: data.Transaction.Id,
        amountValue: data.Transaction.Amount.Value,
        currencyCode: data.Transaction.Amount.CurrencyCode,
        paymentMethod:
          data.PaymentMeans?.Brand?.PaymentMethod ?? data.PaymentMeans?.Brand?.Name ?? "UNKNOWN",
      };
    }
    if (status === "PENDING") {
      return { kind: "pending" };
    }
    return { kind: "unrecognized", detail: `Unexpected Transaction.Status: ${status}` };
  }

  if (result.error.ErrorName === "TRANSACTION_ABORTED") {
    return { kind: "aborted" };
  }
  if (result.error.ErrorName) {
    return {
      kind: "declined",
      errorName: result.error.ErrorName,
      message: result.error.ErrorMessage ?? "Payment declined",
    };
  }
  return { kind: "unrecognized", detail: `Assert error without ErrorName (HTTP ${result.status})` };
}
