/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep production checks from overwriting the running development server's files.
  distDir: process.env.OUTCLASS_PUBLISH_BUILD
    ? ".next-publish"
    : process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  poweredByHeader: false,
  // Interface icons are one module each (components/icons/<Name>.tsx) behind the
  // components/icons.tsx re-export list. Marking exactly those files
  // side-effect-free lets webpack resolve each page to only the icons it uses
  // instead of bundling every icon wherever any icon is imported.
  webpack(config) {
    config.module.rules.push({ test: /[\\/]components[\\/]icons(?:\.tsx|[\\/][^\\/]+\.tsx)$/, sideEffects: false })
    return config
  },
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  // Native PDF workers resolve the package manifest at runtime, outside the bundle.
  // Link-preview cards read their fonts and artwork from disk at request time (lib/share-card.tsx).
  outputFileTracingIncludes: { "/club/**": ["./app/fonts/libre-caslon-text/*-static.ttf", "./public/brand/premium-board/04_wordmark_no_sword.svg", "./public/images/campus/sunset-rotunda-1600.webp", "./public/logos/**"], "/og/**": ["./app/fonts/libre-caslon-text/*-static.ttf", "./public/brand/premium-board/04_wordmark_no_sword.svg", "./public/images/campus/sunset-rotunda-1600.webp"], "/*": ["./prisma/certs/supabase-root.crt", "./public/brand/premium-board/07_favicon.svg", "./public/apple-icon.png", "./node_modules/pdfjs-dist/package.json", "./node_modules/pdfjs-dist/legacy/build/*.mjs", "./node_modules/pdfjs-dist/cmaps/**", "./node_modules/pdfjs-dist/standard_fonts/**", "./node_modules/.pnpm/@napi-rs+canvas*/**/*"] },
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
    const privateRoutes = ["api", "auth", "login", "signup", "forgot-password", "reset-password", "platform", "settings", "saved-clubs", "club-access", "club-claims", "invitations", "meetings", "check-in", "interviews", "decisions", "vote", "live-voting", "voting", "preview", "design-system"]
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
