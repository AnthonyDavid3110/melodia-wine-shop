import type { NextConfig } from "next";
import { getSecurityHeaders } from "./src/lib/security-headers";
import { buildBlobRemotePatterns } from "./src/lib/blob-image-origins";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: buildBlobRemotePatterns(),
  },
  experimental: {
    serverActions: {
      // Next.js's own Server Action body parser defaults to 1 MB —
      // far below this app's own 5 MiB product-image policy
      // (src/domain/products/validate-image-upload.ts's
      // MAX_UPLOAD_BYTES), so any real photo was rejected by Next
      // itself (a generic 413 "Body exceeded 1 MB limit" crash) before
      // ever reaching that validation. Confirmed directly against a
      // real admin upload (Gate ARCH-006-D hotfix) — every automated
      // test before this used tiny synthetic fixtures well under 1 MB,
      // so this never surfaced until real usage. 6mb gives headroom
      // above the 5 MiB file-content cap for multipart/form-data
      // framing and the surrounding text fields; the actual content
      // limit administrators see remains the validator's own clear,
      // translated French error, not this raw transport ceiling.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: getSecurityHeaders(process.env.NODE_ENV === "development"),
      },
    ];
  },
};

export default nextConfig;
