import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const nextConfig: NextConfig = {
  allowedDevOrigins: Object.values(networkInterfaces()).flatMap((addresses) =>
    (addresses ?? []).filter((address) => address.family === "IPv4" && !address.internal).map((address) => address.address)
  ),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:3001/api/:path*",
      },
      {
        source: "/health",
        destination: "http://127.0.0.1:3001/health",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};

export default nextConfig;
