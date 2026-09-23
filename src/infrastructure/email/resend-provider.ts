import "server-only";
import { Resend } from "resend";
import { serverEnv } from "@/lib/env";

/**
 * Server-only Resend adapter (Phase 11 Gate 11A,
 * docs/05-ARCHITECTURE.md TBD-ARCH-005 — resolved: Resend). Uses the
 * official `resend` npm package (v6.28.1 at the time this was written)
 * directly — no custom `fetch` integration, unlike `saferpay-client.ts`,
 * because Resend publishes and maintains an official, small,
 * TypeScript-native SDK (CLAUDE.md §38/§104: prefer the platform/
 * official tooling over reinventing it when it is genuinely thin and
 * well maintained).
 *
 * Request/response shapes, the `{data, error}` result contract, and
 * the full `RESEND_ERROR_CODE_KEY` error-name union below were read
 * directly from the installed package's own type declarations
 * (`node_modules/resend/dist/index.d.mts`) and cross-checked against
 * the official docs at https://resend.com/docs/api-reference/emails/
 * send-email and https://resend.com/docs/api-reference/errors
 * (consulted live during this gate) — never assumed from memory.
 */

export class EmailConfigurationError extends Error {
  constructor() {
    super("La configuration de l'envoi d'e-mails est incomplète.");
    this.name = "EmailConfigurationError";
  }
}

/** Resend rejected this specific send (bad sender, quota, suspended key, flagged content, etc.) — carries the provider's own error name for controlled handling/logging, never the full response body. */
export class EmailProviderRejectedError extends Error {
  constructor(
    message: string,
    readonly providerErrorName?: string,
  ) {
    super(message);
    this.name = "EmailProviderRejectedError";
  }
}

/** Network failure, timeout, or a transient/technical provider condition — safe to retry later, never exposes internals. */
export class EmailNetworkError extends Error {
  constructor() {
    super("Le service d'envoi d'e-mails est temporairement indisponible.");
    this.name = "EmailNetworkError";
  }
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailSuccess {
  /** Resend's own message ID — an opaque provider identifier, never exposed to the customer. */
  messageId: string;
}

/**
 * Whether Resend is configured at all — mirrors
 * `saferpay-client.ts`'s `isSaferpayConfigured()`. Never throws, never
 * returns the values themselves.
 */
export function isResendConfigured(): boolean {
  return Boolean(serverEnv.RESEND_API_KEY && serverEnv.EMAIL_FROM);
}

interface ResendConfig {
  apiKey: string;
  from: string;
}

/** Asserted at the point a send is actually attempted, never at module load — same pattern as `saferpay-client.ts`'s `getSaferpayConfig()`. */
function getResendConfig(): ResendConfig {
  const { RESEND_API_KEY, EMAIL_FROM } = serverEnv;
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    throw new EmailConfigurationError();
  }
  return { apiKey: RESEND_API_KEY, from: EMAIL_FROM };
}

/**
 * Error names the installed SDK types as `RESEND_ERROR_CODE_KEY` that
 * indicate a transient/technical condition on Resend's side — safe to
 * treat as retryable later, never a customer-facing rejection of this
 * specific email:
 *
 *   concurrent_idempotent_requests — a duplicate request is already
 *     being processed (not applicable yet — Gate 11A never sends an
 *     Idempotency-Key, see the Gate 11A report's "Resend idempotency
 *     finding" — kept here for when Gate 11B adds one);
 *   rate_limit_exceeded            — request frequency exceeded;
 *   application_error              — Resend's own unexpected error;
 *   internal_server_error          — Resend's own 5xx.
 *
 * Every other error name in the union reflects something wrong with
 * THIS request (bad sender/recipient/parameter, bad credentials,
 * quota) rather than a transient condition, and is surfaced as
 * `EmailProviderRejectedError` instead.
 */
const TRANSIENT_ERROR_NAMES = new Set([
  "concurrent_idempotent_requests",
  "rate_limit_exceeded",
  "application_error",
  "internal_server_error",
]);

/**
 * Error names that mean OUR configuration/credentials are wrong
 * (as opposed to this specific email being rejected) — normalized to
 * the same `EmailConfigurationError` the pre-flight check above
 * throws, so callers only ever need to handle one configuration-error
 * type regardless of whether the problem was caught before or by
 * Resend itself.
 */
const CONFIGURATION_ERROR_NAMES = new Set([
  "missing_api_key",
  "restricted_api_key",
  "invalid_api_key",
  "invalid_access",
  "invalid_from_address",
]);

/**
 * Sends one transactional email through Resend. Server-only, no
 * automatic retry loop (Gate 11A §6 — retrying belongs to whichever
 * Gate 11B transition point calls this, not to the adapter itself; a
 * blind retry loop here could duplicate a send during a real transient
 * failure with no idempotency key attached yet — see the Idempotency
 * finding in the Gate 11A report). Never logs the API key, the
 * `Authorization` header, or the email body — only the caller-visible,
 * already-sanitized error types below ever leave this module.
 *
 * Not called by any order/payment code path in Gate 11A.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailSuccess> {
  const config = getResendConfig();
  const resend = new Resend(config.apiKey);

  let result;
  try {
    result = await resend.emails.send({
      from: config.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  } catch {
    // The SDK's `send()` is documented to resolve with `{data, error}`
    // for API-level failures, but it wraps `fetch` internally — a
    // genuine connection/DNS/timeout failure can still reject the
    // promise before ever producing that shape. Never exposes the raw
    // thrown value.
    throw new EmailNetworkError();
  }

  const { data, error } = result;
  if (error) {
    if (TRANSIENT_ERROR_NAMES.has(error.name)) {
      throw new EmailNetworkError();
    }
    if (CONFIGURATION_ERROR_NAMES.has(error.name)) {
      throw new EmailConfigurationError();
    }
    throw new EmailProviderRejectedError(error.message, error.name);
  }
  if (!data) {
    throw new EmailNetworkError();
  }
  return { messageId: data.id };
}
