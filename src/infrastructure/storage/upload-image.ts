import "server-only";
import { randomUUID } from "node:crypto";
import { isBlobStorageConfigured, vercelBlobProvider } from "./vercel-blob-provider";
import { fakeStorageProvider } from "./fake-test-provider";
import type { StorageProvider, UploadImageInput, UploadImageSuccess } from "./storage-provider";

/**
 * The one real entry point product/bundle admin code will call (Gate
 * ARCH-006-D/E, not yet implemented — this gate is foundation only).
 * Mirrors `order-confirmation.ts`'s `dispatchOrderConfirmationEmail()`/
 * `online-payments.ts`'s `initiateOnlinePayment()`: application code
 * depends on this module, never on `vercel-blob-provider.ts` or
 * `@vercel/blob` directly.
 */

const IMAGE_KINDS = ["products", "bundles"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

const EXTENSION_BY_CONTENT_TYPE: Record<UploadImageInput["contentType"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** `kind/uuid.ext` — never a user-supplied filename (docs/09-SECURITY.md §44). The one place a pathname for this feature is ever generated. */
export function generateImagePathname(
  kind: ImageKind,
  contentType: UploadImageInput["contentType"],
): string {
  return `${kind}/${randomUUID()}.${EXTENSION_BY_CONTENT_TYPE[contentType]}`;
}

/**
 * Defense in depth: even though `generateImagePathname()` is the only
 * intended producer of a pathname, `uploadImage()` below never trusts a
 * caller-supplied pathname at face value — it must still match this
 * exact controlled shape (docs/09-SECURITY.md §43/§44) before any
 * provider ever sees it. Rejects path traversal, arbitrary filenames,
 * and any prefix/extension outside the two kinds and three accepted
 * image types this feature supports.
 */
const CONTROLLED_PATHNAME_PATTERN = new RegExp(
  `^(${IMAGE_KINDS.join("|")})/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)$`,
);

export class InvalidStoragePathError extends Error {
  constructor(pathname: string) {
    super(`Chemin de stockage invalide : « ${pathname} ».`);
    this.name = "InvalidStoragePathError";
  }
}

/**
 * Validates both the pathname's shape AND that its extension actually
 * matches the caller's declared `contentType` — without this second
 * check, a caller could pass a `.jpg` pathname alongside
 * `contentType: "image/png"` and the shape check alone would not catch
 * the mismatch (Gate ARCH-006-B review finding).
 */
function assertControlledPathname(
  pathname: string,
  contentType: UploadImageInput["contentType"],
): void {
  if (!CONTROLLED_PATHNAME_PATTERN.test(pathname)) {
    throw new InvalidStoragePathError(pathname);
  }
  const expectedExtension = EXTENSION_BY_CONTENT_TYPE[contentType];
  if (!pathname.endsWith(`.${expectedExtension}`)) {
    throw new InvalidStoragePathError(pathname);
  }
}

/**
 * Double-gated test-provider seam (Gate ARCH-006-B) — mirrors
 * `src/infrastructure/payments/online-payments.ts`'s and
 * `src/infrastructure/email/order-confirmation.ts`'s `getProvider()`
 * exactly. The fake provider is selected only when BOTH
 * `NODE_ENV !== "production"` AND the explicit
 * `E2E_FAKE_STORAGE_PROVIDER=true` opt-in are true — intended to be set
 * only in `playwright.config.ts`'s own `webServer.env`, once a future
 * gate adds Playwright coverage of actual upload, never in
 * `.env.example` or any real deployment configuration. Even a mistaken
 * production env var alone can never activate it. The return type
 * (`StorageProvider`) structurally forces both `vercelBlobProvider` and
 * `fakeStorageProvider` to satisfy the same shape.
 */
function getProvider(): StorageProvider {
  if (process.env.NODE_ENV !== "production" && process.env.E2E_FAKE_STORAGE_PROVIDER === "true") {
    return fakeStorageProvider;
  }
  return vercelBlobProvider;
}

/**
 * Whether real (non-fake) image upload is currently available — mirrors
 * `isOnlinePaymentAvailable()`. Not yet called from anywhere (no upload
 * UI exists until Gate ARCH-006-D/E); provided now so that future gate
 * can gate its own UI exactly like checkout gates online payment on
 * `isOnlinePaymentAvailable()`.
 */
export function isImageUploadAvailable(): boolean {
  return isBlobStorageConfigured();
}

/** Validates the pathname, then delegates to whichever provider the double gate selects. */
export async function uploadImage(input: UploadImageInput): Promise<UploadImageSuccess> {
  assertControlledPathname(input.pathname, input.contentType);
  return getProvider().uploadImage(input);
}
