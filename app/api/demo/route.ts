import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { canAccessDemo, DEMO_COOKIE } from "@/lib/demo/access"

async function access() {
  const jar = await cookies()
  const client = await createClient(jar)
  const {
    data: { user },
  } = await client.auth.getUser()
  return { allowed: canAccessDemo(user?.email), enabled: jar.get(DEMO_COOKIE)?.value === "1" }
}
export async function GET() {
  const state = await access()
  const response = NextResponse.json(
    { allowed: state.allowed, enabled: state.allowed && state.enabled },
    { headers: { "Cache-Control": "no-store" } },
  )
  if (!state.allowed) response.cookies.delete(DEMO_COOKIE)
  return response
}
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
  const input = await request.json().catch(() => null)
  if (typeof input?.enabled !== "boolean")
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
  const state = await access()
  if (input.enabled && !state.allowed)
    return NextResponse.json(
      { error: "Demo access is not enabled for this account." },
      { status: 403 },
    )
  const response = NextResponse.json({ enabled: input.enabled })
  response.cookies.set(DEMO_COOKIE, input.enabled ? "1" : "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: input.enabled ? 60 * 60 * 8 : 0,
  })
  return response
}
