/**
 * Content-Security-Policy for HTML documents (docs/csp.md).
 *
 * Built per request in middleware.ts with a fresh nonce. Next.js reads the nonce from the
 * forwarded request header and applies it to its own scripts; app code reads `x-nonce`.
 * Pure and edge-safe: no Node APIs, so middleware and node:test both load it.
 *
 * Rollout: sent as Content-Security-Policy-Report-Only unless OUTCLASS_CSP_ENFORCE=1.
 * The separate, always-enforced `frame-ancestors 'self'` header from next.config.mjs stays.
 */
type Env = Record<string, string | undefined>

export const CSP_NONCE_HEADER = "x-nonce"
export const CSP_REPORT_PATH = "/api/csp-report"

export function cspEnforced(env: Env = process.env) {
  return env.OUTCLASS_CSP_ENFORCE === "1"
}
export function cspHeaderName(env: Env = process.env) {
  return cspEnforced(env) ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only"
}

/** 128 random bits, base64. Web Crypto exists in the edge runtime, browsers and Node 22. */
export function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const origin = (value: string | undefined) => {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : undefined
  } catch { return undefined }
}

/**
 * Only HTML page routes get the policy. API routes (JSON, the résumé PDF the leader workspace
 * frames, file downloads), metadata routes, the service worker and public files keep only the
 * frame-ancestors header: a document policy on a PDF response can stop the browser's viewer.
 */
export function cspAppliesTo(pathname: string) {
  if (pathname === "/api" || pathname.startsWith("/api/") || pathname.startsWith("/_next/") || pathname.startsWith("/_vercel/")) return false
  if (["/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/icon", "/apple-icon", "/sw.js", "/offline.html"].includes(pathname)) return false
  // Link-preview images (opengraph-image, twitter-image, /og/*.png) and every public file have an extension or are images.
  if (/\/(?:opengraph|twitter)-image(?:-[\w-]+)?$/.test(pathname)) return false
  return !/\.[a-z0-9]+$/i.test(pathname.slice(pathname.lastIndexOf("/") + 1))
}

/**
 * Every origin the browser actually talks to (inventory in docs/csp.md):
 * - Supabase (NEXT_PUBLIC_SUPABASE_URL): auth/REST from the browser client, and wss for Realtime
 *   (inbox and communications live updates).
 * - Sentry ingest, derived from NEXT_PUBLIC_SENTRY_DSN, only when it is set.
 * - Cloudflare Turnstile, only when TURNSTILE_ENABLED (both keys set at build time).
 * Vercel Analytics and Speed Insights load from and post to same-origin /_vercel/* paths, so
 * 'self' covers them; the bundle injects their script, which 'strict-dynamic' trusts.
 * Typesense is queried only from server actions, and Microsoft sign-in and Outlook are
 * top-level navigations or popups (not form posts), so neither needs a browser directive.
 */
export function buildCsp({ nonce, env = process.env }: { nonce: string; env?: Env }) {
  const development = env.NODE_ENV === "development"
  const supabase = origin(env.NEXT_PUBLIC_SUPABASE_URL)
  let sentry: string | undefined
  try { sentry = env.NEXT_PUBLIC_SENTRY_DSN ? `https://${new URL(env.NEXT_PUBLIC_SENTRY_DSN).host}` : undefined } catch { sentry = undefined }
  const turnstile = env.TURNSTILE_ENABLED === "1" ? "https://challenges.cloudflare.com" : undefined
  const list = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(" ")

  const directives: [string, string][] = [
    ["default-src", "'self'"],
    // 'strict-dynamic' lets nonced scripts load their chunks; browsers without it fall back to
    // 'self' plus the listed hosts. 'wasm-unsafe-eval' is pdf.js image decoding (scanned résumés).
    // React Refresh needs eval in development only.
    ["script-src", list("'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "'wasm-unsafe-eval'", development && "'unsafe-eval'", turnstile)],
    // React style={...} attributes and the landing audience gate need inline styles. Accepted:
    // style injection cannot run script, and every script still needs the nonce.
    ["style-src", "'self' 'unsafe-inline'"],
    // Club logos, banners and gallery images can be legacy https links entered by leaders.
    ["img-src", "'self' data: blob: https:"],
    ["font-src", "'self'"],
    ["connect-src", list("'self'", supabase, supabase?.replace(/^http/, "ws"), sentry)],
    // The résumé frame is a same-origin route; Turnstile renders its challenge in a frame.
    ["frame-src", list("'self'", turnstile)],
    // The service worker and the self-hosted pdf.js worker.
    ["worker-src", "'self'"],
    ["manifest-src", "'self'"],
    ["media-src", "'self'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'self'"],
  ]
  // Ignored (with a console warning) in Report-Only, and would break plain-http local builds.
  if (cspEnforced(env) && !development) directives.push(["upgrade-insecure-requests", ""])
  // report-uri only: Chrome ignores it whenever report-to is present, and report-to's batched
  // Reporting API delivery was not observed in local Chrome testing (docs/csp.md).
  directives.push(["report-uri", CSP_REPORT_PATH])
  return directives.map(([name, value]) => value ? `${name} ${value}` : name).join("; ")
}
