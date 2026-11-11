import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { DEMO_COOKIE } from '@/lib/demo/access'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'
import { legacyStudentRedirect, STUDENT_ROUTES } from "@/lib/student-routes"
import { LEGAL_PAGES_PUBLIC } from "@/lib/legal-content"
import { buildCsp, createNonce, cspAppliesTo, cspHeaderName, CSP_NONCE_HEADER } from "@/lib/csp"

/**
 * Page requests get a fresh nonce and Content-Security-Policy (docs/csp.md). The nonce and
 * policy are added to the forwarded request headers, which Next.js reads to nonce its own
 * scripts and the root layout reads through `x-nonce`; every NextResponse.next() and rewrite
 * below forwards `request.headers`. Every page is already dynamic (the root layout reads
 * cookies), so a per-request nonce does not turn any static page dynamic.
 */
export async function middleware(request: NextRequest) {
  let pathname = request.nextUrl.pathname
  try { pathname = decodeURIComponent(pathname) } catch { /* route() answers 400 */ }
  if (!cspAppliesTo(pathname)) return route(request)
  const nonce = createNonce(), policy = buildCsp({ nonce }), header = cspHeaderName()
  // Never trust a client-sent nonce or policy.
  request.headers.delete("content-security-policy")
  request.headers.delete("content-security-policy-report-only")
  request.headers.set(CSP_NONCE_HEADER, nonce)
  request.headers.set(header, policy)
  const response = await route(request)
  response.headers.set(header, policy)
  return response
}

async function route(request: NextRequest): Promise<Response> {
  // Protect both the presenter route and its sample assets before static-file shortcuts.
  let path = request.nextUrl.pathname
  // The uptime probe needs no session, cookies or redirects, and nothing here may rate-limit it.
  if (path === "/api/health" && ["GET", "HEAD"].includes(request.method)) return NextResponse.next()
  try { path = decodeURIComponent(path) } catch { return new NextResponse(null, { status: 400 }) }
  // Student workspace views moved from `/?workspace=student&view=…` to real paths. Old URLs live
  // on in stored notifications and sent email, so this redirect stays (307 until the paths are
  // proven in production; then 308). Next rewrites a 127.0.0.1/[::1] host to localhost in any
  // middleware redirect, which drops host-scoped session cookies, so loopback-IP requests fall
  // through to the same mapping in app/page.tsx, whose redirect keeps the browser's host.
  if (path === "/" && ["GET", "HEAD"].includes(request.method) && !/^(127\.0\.0\.1|\[::1\])(:\d+)?$/.test(request.headers.get("host") ?? "")) {
    const destination = legacyStudentRedirect(request.nextUrl.searchParams)
    if (destination) {
      const response = NextResponse.redirect(new URL(destination, request.url), 307)
      response.headers.set("Cache-Control", "private, no-store")
      return response
    }
  }
  // Privacy and Terms are not public until the owner turns them on: serve the real 404 page (an
  // unmatched path), not a streamed 200, and never their titles.
  if (!LEGAL_PAGES_PUBLIC && (path === "/privacy" || path === "/terms")) {
    return NextResponse.rewrite(new URL("/__not-public", request.url), { request: { headers: request.headers }, headers: { "X-Robots-Tag": "noindex, nofollow" } })
  }
  if (path === "/preview" || path.startsWith("/preview/") || path === "/demo" || path.startsWith("/demo/")) {
    if (!["GET", "HEAD"].includes(request.method) || request.cookies.get(DEMO_COOKIE)?.value !== "1" || request.cookies.has(PLATFORM_VIEW_COOKIE)) {
      return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } })
    }
    return createClient(request, { demoOnly: true })
  }
  // Browser CSP reports carry no identity and change nothing; they skip session refresh and the
  // Demo Mode write guard (a report from a demo page is still a report). The route bounds itself.
  if (request.method === "POST" && request.nextUrl.pathname === "/api/csp-report") return NextResponse.next()
  // The internal delivery route checks its independent bearer secret. Cron needs no Supabase session refresh.
  if (["/api/internal/invitation-delivery", "/api/internal/notification-delivery"].includes(request.nextUrl.pathname)) return NextResponse.next()
  // Metadata routes, the service worker and its offline page contain only public content and need no session refresh.
  if (["GET", "HEAD"].includes(request.method) && ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/icon", "/apple-icon", "/sw.js", "/offline.html"].includes(request.nextUrl.pathname)) return NextResponse.next()
  // Club link-preview cards (opengraph-image / twitter-image) are public and CDN-cached.
  if (["GET", "HEAD"].includes(request.method) && /^\/club\/[^/]+\/(?:opengraph|twitter)-image(?:-[\w-]+)?$/.test(request.nextUrl.pathname)) return NextResponse.next()
  // Static GETs can skip auth refresh; POSTs must never bypass read-only guards by using an image-like URL.
  if (["GET", "HEAD"].includes(request.method) && /\.(svg|png|jpg|jpeg|gif|webp|ico)$/.test(request.nextUrl.pathname) && !/^\/(club|club-access|club-claims|invitations|meetings|platform|api)\//.test(request.nextUrl.pathname)) return NextResponse.next()

  // Identity-provider operations must never replace the preserved administrator login.
  if (request.cookies.has(PLATFORM_VIEW_COOKIE) && (request.nextUrl.pathname.startsWith("/auth/") || request.nextUrl.pathname.startsWith("/api/auth/") || request.nextUrl.pathname === "/api/demo" || ["/platform/login", "/login", "/signup", "/forgot-password", "/reset-password"].includes(request.nextUrl.pathname))) {
    return NextResponse.json({ error: "Exit impersonation before changing authentication or demo mode." }, { status: 403 })
  }
  // Demo requests cannot invoke any live server action or mutation endpoint.
  // The mode endpoint can disable demo; its own authorization and origin checks apply.
  if (request.cookies.get(DEMO_COOKIE)?.value === "1" && (["/api/users/me", "/api/workspace"].includes(request.nextUrl.pathname) || (request.method !== "GET" && request.method !== "HEAD" && request.nextUrl.pathname !== "/api/demo"))) {
    return NextResponse.json({ error: "Live account access and production writes are disabled in Demo Mode." }, { status: 403 })
  }
  // These boundaries verify getUser themselves and can write refreshed cookies.
  // The demo/support mutation guards above still run before this optimization.
  // No identity forwarded by a client/header is trusted by downstream loaders.
  const ownsAuth = request.nextUrl.pathname === "/api/workspace" || request.nextUrl.pathname === "/api/users/me" ||
    request.method === "POST" && request.headers.has("next-action")
  const response = ownsAuth ? NextResponse.next({ request: { headers: request.headers } }) : await createClient(request)
  // Product views share the homepage URL. Preserve their query parameters and
  // authentication while explicitly keeping those responses out of search.
  const accountView = request.nextUrl.pathname === "/" && ["workspace", "view", "demoClub", "next", "error", "signup"].some(key => request.nextUrl.searchParams.has(key)) ||
    // /corkboard predates the move and stays a public page.
    STUDENT_ROUTES.some(route => route.path !== "/corkboard" && route.path === request.nextUrl.pathname)
  const accountCookie = request.cookies.has(PLATFORM_VIEW_COOKIE) || request.cookies.get(DEMO_COOKIE)?.value === "1" || request.cookies.getAll().some(cookie => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name))
  if (accountView || accountCookie) response.headers.set("X-Robots-Tag", "noindex, nofollow")
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
