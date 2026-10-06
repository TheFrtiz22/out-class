/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep production checks from overwriting the running development server's files.
  distDir: process.env.OUTCLASS_PUBLISH_BUILD
    ? ".next-publish"
    : process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  poweredByHeader: false,
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  // Native PDF workers resolve the package manifest at runtime, outside the bundle.
  outputFileTracingIncludes: { "/*": ["./node_modules/pdfjs-dist/package.json", "./node_modules/pdfjs-dist/legacy/build/*.mjs", "./node_modules/pdfjs-dist/cmaps/**", "./node_modules/pdfjs-dist/standard_fonts/**", "./node_modules/.pnpm/@napi-rs+canvas*/**/*"] },
  trailingSlash: false,
  htmlLimitedBots: /.*/,
  images: { formats: ["image/avif", "image/webp"] },
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async redirects() {
    return [
      { source: "/:path*", has: [{ type: "host", value: "out-class.net" }], destination: "https://www.out-class.net/:path*", permanent: true },
      { source: "/icon.png", destination: "/icon", permanent: true },
      { source: "/apple-icon.png", destination: "/apple-icon", permanent: true },
    ]
  },
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]
    const privateRoutes = ["api", "auth", "login", "forgot-password", "reset-password", "platform", "settings", "club-access", "club-claims", "invitations", "meetings", "check-in", "interviews", "decisions", "vote", "live-voting", "voting", "preview", "design-system"]
    return [
      { source: "/:path*", headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ] },
      ...privateRoutes.map(route => ({ source: `/${route}/:path*`, headers: noindex })),
      ...["workspace", "tasks"].map(route => ({ source: `/club/:clubId/${route}/:path*`, headers: noindex })),
      ...["forgot-password", "reset-password", "auth/callback"].map(route => ({ source: `/${route}`, headers: [{ key: "Referrer-Policy", value: "no-referrer" }] })),
    ]
  },
}

export default nextConfig
