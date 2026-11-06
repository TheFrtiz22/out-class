import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { DEMO_COOKIE } from "@/lib/demo/access"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { validNonce, validWeek } from "@/lib/outlook-busy"
import { OUTLOOK_COOKIE, OUTLOOK_COOKIE_PATH, authorizeUrl, outlookConfig, pkce } from "@/lib/outlook-calendar"
import { requireAuth } from "@/utils/auth"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" }
const refuse = (error: string, status: number) => NextResponse.json({ error }, { status, headers })

/** Starts a one-time, read-only Outlook busy-time lookup for the signed-in interviewer. */
export async function GET(request: NextRequest) {
  const config = outlookConfig()
  if (!config) return refuse("Outlook calendar checks are unavailable.", 404)
  const cookieStore = await cookies()
  if (cookieStore.has(PLATFORM_VIEW_COOKIE) || cookieStore.get(DEMO_COOKIE)?.value === "1")
    return refuse("Exit administrator view or Demo Mode before connecting a calendar.", 403)
  const week = request.nextUrl.searchParams.get("week"), nonce = request.nextUrl.searchParams.get("nonce")
  if (!validWeek(week) || !validNonce(nonce)) return refuse("Invalid request.", 400)
  const { user } = await requireAuth()
  const { state, verifier, challenge } = pkce()
  const redirectUri = new URL(`${OUTLOOK_COOKIE_PATH}/callback`, request.nextUrl.origin).toString()
  const response = NextResponse.redirect(authorizeUrl(config, { redirectUri, state, challenge, loginHint: user.email }), { headers })
  response.cookies.set(OUTLOOK_COOKIE, JSON.stringify({ state, verifier, week, nonce, userId: user.id, expires: Date.now() + 600000 }), {
    httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: OUTLOOK_COOKIE_PATH, maxAge: 600,
  })
  return response
}
