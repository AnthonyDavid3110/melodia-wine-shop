import "server-only";
import { put } from "@vercel/blob";
import { serverEnv } from "@/lib/env";
import type { StorageProvider, UploadImageInput, UploadImageSuccess } from "./storage-provider";

/**
 * Server-only Vercel Blob adapter (Phase 15, TBD-ARCH-006, Gate
 * ARCH-006-B). Uses the official `@vercel/blob` package directly — its
 * `put()` signature, options, and `BlobError` hierarchy were read
 * straight from the installed package's own type declarations
 * (`node_modules/.pnpm/@vercel+blob@2.8.1/node_modules/@vercel/blob/dist/index.d.ts`),
 * never assumed from memory (CLAUDE.md §39).
 */

export class StorageConfigurationError extends Error {
  constructor() {
    super("La configuration du stockage d'images est incomplète.");
    this.name = "StorageConfigurationError";
  }
}

/** Blob rejected or failed this specific upload (quota, suspended store, transient service condition) — never exposes the raw provider error, never the token. */
export class StorageNetworkError extends Error {
  constructor() {
    super("Le service de stockage d'images est temporairement indisponible. Veuillez réessayer.");
    this.name = "StorageNetworkError";
  }
}

/** Whether Blob storage is configured at all — mirrors `isResendConfigured()`/`isSaferpayConfigured()`. Never throws, never returns the token itself. */
export function isBlobStorageConfigured(): boolean {
  return Boolean(serverEnv.BLOB_READ_WRITE_TOKEN);
}

/** Asserted at the point an upload is actually attempted, never at module load — same pattern as `getResendConfig()`/`getSaferpayConfig()`. */
function getBlobToken(): string {
  const { BLOB_READ_WRITE_TOKEN } = serverEnv;
  if (!BLOB_READ_WRITE_TOKEN) {
    throw new StorageConfigurationError();
  }
  return BLOB_READ_WRITE_TOKEN;
}

/**
 * Uploads one image to the project's Vercel Blob store. Server-only, no
 * retry loop (CLAUDE.md §46 — no retry framework for this project's
 * scale; a caller can simply re-invoke the Server Action). Never logs
 * the token or the raw provider error — only the sanitized error types
 * below ever leave this module. `allowOverwrite` is left at its default
 * `false`: every pathname this module receives is already a freshly
 * generated, never-reused controlled identifier (`upload-image.ts`), so
 * a collision would itself be a bug worth surfacing loudly rather than
 * silently overwriting.
 */
async function uploadImage(input: UploadImageInput): Promise<UploadImageSuccess> {
  const token = getBlobToken();

  let result;
  try {
    // @vercel/blob's `PutBody` accepts `Buffer` (among other body
    // shapes) but not a plain `Uint8Array` — `Buffer.from()` wraps the
    // same bytes without copying semantics that matter here (a one-shot
    // upload, not a retained reference).
    result = await put(input.pathname, Buffer.from(input.bytes), {
      access: "public",
      contentType: input.contentType,
      token,
      addRandomSuffix: false,
    });
  } catch {
    // Covers both the SDK's own typed `BlobError` subclasses (quota,
    // suspended store, rate limit, pathname conflict) and a raw
    // network/DNS/timeout failure before any typed error could be
    // produced — same defensive, non-distinguishing catch shape as
    // `saferpay-client.ts`/`resend-provider.ts`. Never exposes the raw
    // thrown value.
    throw new StorageNetworkError();
  }

  return { url: result.url };
}

export const vercelBlobProvider: StorageProvider = { uploadImage };
