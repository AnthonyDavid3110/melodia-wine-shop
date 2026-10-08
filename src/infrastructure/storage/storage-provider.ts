/**
 * The smallest provider boundary Phase 15 (TBD-ARCH-006, Gate
 * ARCH-006-B) needs — mirrors `08-PAYMENTS.md`'s `PaymentProvider`
 * boundary and `src/infrastructure/email/email-provider.ts`'s
 * `EmailProvider`, scaled to what product/bundle image upload actually
 * requires: one operation, not a general-purpose file store. Deliberately
 * NOT a generic arbitrary-file upload service — `contentType` is a
 * closed union of the three accepted image types, never an open string.
 *
 * Both `vercel-blob-provider.ts` and `fake-test-provider.ts` structurally
 * satisfy this shape (enforced at each module's own `export const ...:
 * StorageProvider` site, same precedent as `resend-provider.ts`).
 */
export interface UploadImageInput {
  bytes: Uint8Array;
  /**
   * Caller-supplied, but never trusted as-is — `upload-image.ts`'s
   * `uploadImage()` validates this against a controlled-identifier
   * pattern before any provider ever sees it (docs/09-SECURITY.md §44:
   * never a user-supplied filename).
   */
  pathname: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
}

export interface UploadImageSuccess {
  url: string;
}

export interface StorageProvider {
  uploadImage(input: UploadImageInput): Promise<UploadImageSuccess>;
}
