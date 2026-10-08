import type { NextConfig } from "next";
import { getSecurityHeaders } from "./src/lib/security-headers";
import { buildBlobRemotePatterns } from "./src/lib/blob-image-origins";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: buildBlobRemotePatterns(),
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
