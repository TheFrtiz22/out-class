import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { DEMO_COOKIE } from '@/lib/demo/access'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Static GETs can skip auth refresh; POSTs must never bypass read-only guards by using an image-like URL.
  if (["GET", "HEAD"].includes(request.method) && /\.(svg|png|jpg|jpeg|gif|webp|ico)$/.test(request.nextUrl.pathname) && !/^\/(club|club-access|club-claims|invitations|meetings|platform|api)\//.test(request.nextUrl.pathname)) return NextResponse.next()

  if (request.cookies.has(PLATFORM_VIEW_COOKIE) && !["GET", "HEAD"].includes(request.method) && request.nextUrl.pathname !== "/api/platform/view-as" && request.nextUrl.pathname !== "/api/platform/view-as/blocked") {
    const headers = new Headers(request.headers)
    headers.set("x-outclass-blocked-path", request.nextUrl.pathname.slice(0, 500))
    return NextResponse.rewrite(new URL("/api/platform/view-as/blocked", request.url), { request: { headers } })
  }
  if (request.cookies.has(PLATFORM_VIEW_COOKIE) && ["GET", "HEAD"].includes(request.method)) {
    if (request.nextUrl.pathname === "/api/users/me") return NextResponse.json({ error: "Exit read-only administrator view to restore account access." }, { status: 403 })
    if (!request.nextUrl.pathname.startsWith("/api/") && !request.nextUrl.pathname.startsWith("/_next/") && !["/platform/view-as", "/platform/login"].includes(request.nextUrl.pathname)) return NextResponse.redirect(new URL("/platform/view-as", request.url))
  }
  // Demo requests cannot invoke any live server action or mutation endpoint.
  // The mode endpoint can disable demo; its own authorization and origin checks apply.
  if (request.cookies.get(DEMO_COOKIE)?.value === "1" && (request.nextUrl.pathname === "/api/users/me" || (request.method !== "GET" && request.method !== "HEAD" && request.nextUrl.pathname !== "/api/demo"))) {
    return NextResponse.json({ error: "Live account access and production writes are disabled in Demo Mode." }, { status: 403 })
  }
  // Update session
  return await createClient(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
