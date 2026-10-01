import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { DEMO_COOKIE } from '@/lib/demo/access'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Static GETs can skip auth refresh; POSTs must never bypass read-only guards by using an image-like URL.
  if (["GET", "HEAD"].includes(request.method) && /\.(svg|png|jpg|jpeg|gif|webp|ico)$/.test(request.nextUrl.pathname) && !/^\/(club|club-access|club-claims|invitations|meetings|platform|api)\//.test(request.nextUrl.pathname)) return NextResponse.next()

  // Identity-provider operations must never replace the preserved administrator login.
  if (request.cookies.has(PLATFORM_VIEW_COOKIE) && (request.nextUrl.pathname.startsWith("/auth/") || request.nextUrl.pathname.startsWith("/api/auth/") || request.nextUrl.pathname === "/api/demo" || ["/platform/login", "/login", "/forgot-password", "/reset-password"].includes(request.nextUrl.pathname))) {
    return NextResponse.json({ error: "Exit impersonation before changing authentication or demo mode." }, { status: 403 })
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
