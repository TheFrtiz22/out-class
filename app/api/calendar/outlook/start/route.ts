import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { DEMO_COOKIE } from "@/lib/demo/access"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { validNonce, validWeek } from "@/lib/outlook-busy"
import { OUTLOOK_COOKIE, OUTLOOK_COOKIE_PATH, authorizeUrl, outlookConfig, pkce, popupResult, redirectOrigin } from "@/lib/outlook-calendar"
import { getSessionUser, requireAuth } from "@/utils/auth"

export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" }

/** Starts a one-time, read-only Outlook busy-time lookup for the signed-in interviewer. */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const week = request.nextUrl.searchParams.get("week"), nonce = request.nextUrl.searchParams.get("nonce")
  // Every outcome reaches the editor that opened this popup; nothing strands it.
  const fail = (error: string, status: number) => new NextResponse(
    popupResult(origin, validWeek(week) && validNonce(nonce) ? { nonce, week, error } : { nonce: "", week: "", error }),
    { status, headers: { ...noStore, "Content-Type": "text/html; charset=utf-8" } })
  const config = outlookConfig()
  if (!config) return fail("unavailable", 404)
  if (!validWeek(week) || !validNonce(nonce)) return fail("unavailable", 400)
  const cookieStore = await cookies()
  if (cookieStore.has(PLATFORM_VIEW_COOKIE) || cookieStore.get(DEMO_COOKIE)?.value === "1") return fail("unavailable", 403)
  const redirectBase = redirectOrigin(origin)
  if (!redirectBase) return fail("unavailable", 400)
  // A signed-out popup gets a message instead of the sign-in redirect.
  const session = await getSessionUser()
  if (session.error || !session.data.user) return fail("signin", 401)
  const { user } = await requireAuth()
  const { state, verifier, challenge } = pkce()
  const redirectUri = new URL(`${OUTLOOK_COOKIE_PATH}/callback`, redirectBase).toString()
  const response = NextResponse.redirect(authorizeUrl(config, { redirectUri, state, challenge, loginHint: user.email }), { headers: noStore })
  response.cookies.set(OUTLOOK_COOKIE, JSON.stringify({ state, verifier, week, nonce, userId: user.id, expires: Date.now() + 600000 }), {
    httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: OUTLOOK_COOKIE_PATH, maxAge: 600,
  })
  return response
}
