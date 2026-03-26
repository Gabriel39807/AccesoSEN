import path from "node:path";
import type { NextConfig } from "next";
import { normalizeApiBaseUrl } from "./src/lib/api-config";

const isProduction = process.env.NODE_ENV === "production";
const apiBaseUrl = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL || "");
const allowedConnectSources = ["'self'"];
const repoRoot = path.join(__dirname, "..", "..");

if (apiBaseUrl) {
  allowedConnectSources.push(apiBaseUrl);
}

if (!isProduction) {
  allowedConnectSources.push("http://127.0.0.1:3000", "http://localhost:3000", "ws://127.0.0.1:3000", "ws://localhost:3000");
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      isProduction ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data: blob: https:",
      `connect-src ${allowedConnectSources.join(" ")}`,
      "frame-src 'self' https://view.officeapps.live.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR || ".next",
  outputFileTracingRoot: repoRoot,
  allowedDevOrigins: ["http://172.24.160.1:3000"],
  turbopack: {
    root: repoRoot,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
