/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep production checks from overwriting the running development server's files.
  distDir: process.env.OUTCLASS_PUBLISH_BUILD
    ? ".next-publish"
    : process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  // Turnstile bot checks are completely off (no script, no widget) unless BOTH keys are
  // set at build time. Only this on/off flag reaches the browser, never the secret.
  env: { TURNSTILE_ENABLED: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY ? "1" : "" },
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
        // Pages may be framed only by this origin (the leader workspace frames /api/recruiting-resumes).
        // X-Frame-Options covers browsers without CSP frame-ancestors support.
        { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
      ] },
      ...privateRoutes.map(route => ({ source: `/${route}/:path*`, headers: noindex })),
      ...["workspace", "tasks"].map(route => ({ source: `/club/:clubId/${route}/:path*`, headers: noindex })),
      ...["forgot-password", "reset-password", "auth/callback"].map(route => ({ source: `/${route}`, headers: [{ key: "Referrer-Policy", value: "no-referrer" }] })),
    ]
  },
}

// Readable stack traces without public source maps: on Vercel builds that have an upload
// token, maps are generated hidden (no sourceMappingURL comment), uploaded to Sentry and
// deleted before deploy; scripts/check-no-public-sourcemaps.cjs then fails the build if
// any map is left in the public static folder. Without a token (local builds, CI,
// previews without the secret) the config is exactly the one above.
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN) && process.env.VERCEL === "1"

export default uploadSourceMaps
  ? (await import("@sentry/nextjs/config")).withSentryConfig(nextConfig, {
      org: "outclass-ot",
      project: "out-class",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Upload output stays in the Vercel log, so a failed upload (which then fails the
      // public source map check) shows its cause.
      silent: false,
      telemetry: false,
      widenClientFileUpload: true,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      // Upload and release tagging only. Server code is not wrapped at build time:
      // errors already come from onRequestError and timings from Next.js's own spans.
      webpack: {
        autoInstrumentServerFunctions: false,
        autoInstrumentMiddleware: false,
        autoInstrumentAppDirectory: false,
        treeshake: { removeDebugLogging: true },
      },
    })
  : nextConfig
