import type { NextConfig } from "next";
import { getSecurityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
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
