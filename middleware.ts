import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Demo requests cannot invoke any live server action or mutation endpoint.
  // The mode endpoint can disable demo; its own authorization and origin checks apply.
  if (request.cookies.get("outclass-demo-session")?.value === "1" && request.method !== "GET" && request.method !== "HEAD" && request.nextUrl.pathname !== "/api/demo") {
    return NextResponse.json({ error: "Production writes are disabled in Demo Mode." }, { status: 403 })
  }
  // Update session
  return await createClient(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

