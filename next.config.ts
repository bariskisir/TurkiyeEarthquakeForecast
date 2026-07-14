/**
 * @fileoverview Defines the next.config repository configuration module and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
import type { NextConfig } from "next";
import packageInfo from "./package.json";

const development = process.env.NODE_ENV === "development";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.basemaps.cartocdn.com",
  "font-src 'self' data:",
  `connect-src 'self'${development ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  ...(development ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: packageInfo.version,
  },
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingIncludes: {
    "/api/forecast": ["./data/*.json"],
  },
  /**
   * Applies a single defensive browser policy to pages, assets, and API responses while retaining the CARTO tiles and inline framework bootstrap required by the dashboard.
   *
   * Development-only eval and WebSocket allowances keep source maps and hot reload functional without weakening the production policy.
   */
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
