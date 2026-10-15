import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const origin = (value: string | undefined) => {
  try { return value ? new URL(value).origin : ""; } catch { return ""; }
};

// Where the browser may connect: this site, the API and Supabase auth.
const connectSources = [
  "'self'",
  origin(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"),
  origin(process.env.NEXT_PUBLIC_SUPABASE_URL),
  // Supabase realtime/auth may use WebSockets on the same host.
  origin(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/^https:/, "wss:"),
].filter(Boolean);

// Next.js emits inline bootstrap scripts, so script-src needs 'unsafe-inline' until nonces are adopted.
// Development additionally needs eval for fast refresh.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  // Property photos are any HTTPS URL (normally Cloudinary); map tiles come from OpenStreetMap.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src ${connectSources.join(" ")}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  // Browser tests build into their own folder so they never overwrite a running dev server's output.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  images: {
    // Keep in sync with OPTIMISED_IMAGE_HOSTS in lib/image-host.ts.
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
