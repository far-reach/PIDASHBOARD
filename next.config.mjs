/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The E2E harness drives the dev server over 127.0.0.1; without this Next
  // logs a cross-origin warning on every asset request.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // PGlite ships WASM + a native-ish loader; keep it external so Next's
  // server bundler doesn't try to inline the .wasm assets.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "ioredis"],
  headers: async () => [
    {
      // Never cache API responses at the CDN by default; freshness is the product.
      source: "/api/:path*",
      headers: [{ key: "Cache-Control", value: "no-store" }],
    },
    {
      // The worker file itself must never be cached: a cached sw.js pins
      // users to whichever caching strategy it shipped with.
      source: "/sw.js",
      headers: [{ key: "Cache-Control", value: "no-store" }],
    },
  ],
};

export default nextConfig;
