import os from "node:os";
import type { NextConfig } from "next";

function localDevOrigins() {
  const origins = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);
  try {
    for (const list of Object.values(os.networkInterfaces())) {
      for (const net of list ?? []) {
        if (net.family === "IPv4") {
          origins.add(net.address);
        }
      }
    }
  } catch {
    /* network interface listing is blocked in some sandboxes */
  }
  return [
    ...origins,
    "192.168.*",
    "10.*",
    "172.16.*",
    "172.17.*",
    "172.18.*",
    "172.19.*",
    "172.20.*",
    "172.21.*",
    "172.22.*",
    "172.23.*",
    "172.24.*",
    "172.25.*",
    "172.26.*",
    "172.27.*",
    "172.28.*",
    "172.29.*",
    "172.30.*",
    "172.31.*",
  ];
}

const nextConfig: NextConfig = {
  // Standalone is for Electron/desktop packaging. Vercel injects an adapter that
  // conflicts with standalone on Next 16.3 (missing next-server.js.nft.json).
  output: process.env.VERCEL ? undefined : "standalone",
  allowedDevOrigins: localDevOrigins(),
  async headers() {
    return [
      {
        source: "/api/download/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
