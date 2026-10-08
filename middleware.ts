import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { DEMO_COOKIE } from '@/lib/demo/access'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // The internal delivery route checks its independent bearer secret. Cron needs no Supabase session refresh.
  if (request.nextUrl.pathname === "/api/internal/invitation-delivery") return NextResponse.next()
  // Metadata routes contain only public content and need no session refresh.
  if (["GET", "HEAD"].includes(request.method) && ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/icon", "/apple-icon"].includes(request.nextUrl.pathname)) return NextResponse.next()
  // Static GETs can skip auth refresh; POSTs must never bypass read-only guards by using an image-like URL.
  if (["GET", "HEAD"].includes(request.method) && /\.(svg|png|jpg|jpeg|gif|webp|ico)$/.test(request.nextUrl.pathname) && !/^\/(club|club-access|club-claims|invitations|meetings|platform|api)\//.test(request.nextUrl.pathname)) return NextResponse.next()

  // Identity-provider operations must never replace the preserved administrator login.
  if (request.cookies.has(PLATFORM_VIEW_COOKIE) && (request.nextUrl.pathname.startsWith("/auth/") || request.nextUrl.pathname.startsWith("/api/auth/") || request.nextUrl.pathname === "/api/demo" || ["/platform/login", "/login", "/forgot-password", "/reset-password"].includes(request.nextUrl.pathname))) {
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
  const response = ownsAuth ? NextResponse.next() : await createClient(request)
  // Product views share the homepage URL. Preserve their query parameters and
  // authentication while explicitly keeping those responses out of search.
  const accountView = request.nextUrl.pathname === "/" && ["workspace", "view", "demoClub", "next", "error", "signup"].some(key => request.nextUrl.searchParams.has(key))
  const accountCookie = request.cookies.has(PLATFORM_VIEW_COOKIE) || request.cookies.get(DEMO_COOKIE)?.value === "1" || request.cookies.getAll().some(cookie => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name))
  if (accountView || accountCookie) response.headers.set("X-Robots-Tag", "noindex, nofollow")
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
