import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { DEMO_COOKIE } from "@/lib/demo/access"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { OUTLOOK_COOKIE, OUTLOOK_COOKIE_PATH, lookupBusy, outlookConfig, parsePending, popupResult } from "@/lib/outlook-calendar"
import { requireAuth } from "@/utils/auth"

export const dynamic = "force-dynamic"

/** Finishes the lookup, returns busy intervals to the opening editor, and keeps nothing. */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const cookieStore = await cookies()
  const pending = parsePending(cookieStore.get(OUTLOOK_COOKIE)?.value)
  const page = (payload: Parameters<typeof popupResult>[1] | null, status = 200) => {
    const response = new NextResponse(payload ? popupResult(origin, payload) : popupResult(origin, { nonce: "", week: "", error: "expired" }), {
      status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" },
    })
    // The code and verifier are single use: always clear the pending lookup.
    response.cookies.set(OUTLOOK_COOKIE, "", { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: OUTLOOK_COOKIE_PATH, maxAge: 0 })
    return response
  }
  const config = outlookConfig()
  if (!config) return page(null, 404)
  if (!pending) return page(null, 400)
  const fail = (error: string, status = 400) => page({ nonce: pending.nonce, week: pending.week, error }, status)
  const params = request.nextUrl.searchParams
  if (params.get("state") !== pending.state) return fail("expired")
  if (cookieStore.has(PLATFORM_VIEW_COOKIE) || cookieStore.get(DEMO_COOKIE)?.value === "1") return fail("unavailable", 403)
  const providerError = params.get("error")
  if (providerError) {
    // AADSTS65001/90094: the university tenant requires an administrator to approve the app.
    const description = params.get("error_description") || ""
    return fail(/AADSTS(65001|90094|90095)/.test(description) ? "consent" : providerError === "access_denied" ? "declined" : "unavailable")
  }
  const code = params.get("code")
  if (!code || code.length > 4000) return fail("expired")
  // The browser that started the lookup must still be the same OutClass account.
  const { user } = await requireAuth()
  if (user.id !== pending.userId) return fail("expired", 403)
  try {
    const busy = await lookupBusy({ config, code, verifier: pending.verifier, redirectUri: new URL(`${OUTLOOK_COOKIE_PATH}/callback`, origin).toString(), week: pending.week })
    return page({ nonce: pending.nonce, week: pending.week, busy })
  } catch {
    console.warn("Outlook busy-time lookup unavailable")
    return fail("unavailable", 502)
  }
}
