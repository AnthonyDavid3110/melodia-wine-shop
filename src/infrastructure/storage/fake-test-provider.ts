import "server-only";
import { randomUUID } from "node:crypto";
import type { StorageProvider, UploadImageInput, UploadImageSuccess } from "./storage-provider";

/**
 * Test-only fake storage provider (Phase 15, TBD-ARCH-006, Gate
 * ARCH-006-B) — same shape as `vercel-blob-provider.ts`, mirroring
 * `src/infrastructure/email/fake-test-provider.ts`'s and
 * `src/infrastructure/payments/fake-test-provider.ts`'s safety model
 * exactly. No network call, no real Blob token, no real Blob writes.
 * Never reachable in production — see the double gate in
 * `upload-image.ts`'s `getProvider()` (requires both
 * `NODE_ENV !== "production"` AND the explicit
 * `E2E_FAKE_STORAGE_PROVIDER=true` opt-in).
 *
 * State lives in a module-level array keyed on `globalThis`, not a
 * plain module-level `const` — same documented Next.js dev-mode
 * (Turbopack) module-instance hazard as the other two fake providers.
 */

export interface FakeUploadedImage {
  id: string;
  pathname: string;
  contentType: UploadImageInput["contentType"];
  byteLength: number;
  url: string;
  uploadedAt: Date;
}

const globalForFakeStorageProvider = globalThis as unknown as {
  __fakeUploadedImages?: FakeUploadedImage[];
};
if (!globalForFakeStorageProvider.__fakeUploadedImages) {
  globalForFakeStorageProvider.__fakeUploadedImages = [];
}
const uploadedImages: FakeUploadedImage[] = globalForFakeStorageProvider.__fakeUploadedImages;

/** Deterministic fake URL — derived from the given pathname, never a real Blob host, so a test can assert on it without any network round-trip. */
function fakeUrlFor(pathname: string): string {
  return `https://fake-blob.test/${pathname}`;
}

/** Same signature as `vercel-blob-provider.ts`'s `uploadImage` — never throws, always "succeeds," records the attempt for later inspection. No network. */
async function uploadImage(input: UploadImageInput): Promise<UploadImageSuccess> {
  const url = fakeUrlFor(input.pathname);
  uploadedImages.push({
    id: randomUUID(),
    pathname: input.pathname,
    contentType: input.contentType,
    byteLength: input.bytes.byteLength,
    url,
    uploadedAt: new Date(),
  });
  return { url };
}

export const fakeStorageProvider: StorageProvider = { uploadImage };

/** Test-only inspection helper — never imported by application/domain code, only by tests. */
export function getFakeUploadedImages(): readonly FakeUploadedImage[] {
  return uploadedImages;
}

/** Test-only reset helper, so each test starts from a clean slate regardless of module-instance sharing. */
export function resetFakeUploadedImages(): void {
  uploadedImages.length = 0;
}
