import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { MICROSOFT_AUTH_ENABLED } from "@/lib/auth-features"
import { loginReturnPath } from "@/lib/auth"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { DEMO_COOKIE } from "@/lib/demo/access"
import { createClient } from "@/utils/supabase/server"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store" }

/** The only application entry point for Microsoft OAuth, including direct URLs. */
export async function GET(request: Request) {
  if (!MICROSOFT_AUTH_ENABLED) {
    return NextResponse.json({ error: "This sign-in method is unavailable. Use email sign-in." }, { status: 403, headers })
  }
  const cookieStore = await cookies()
  if (cookieStore.has(PLATFORM_VIEW_COOKIE) || cookieStore.get(DEMO_COOKIE)?.value === "1") {
    return NextResponse.json({ error: "Exit impersonation or Demo Mode before changing authentication." }, { status: 403, headers })
  }
  const { origin, searchParams } = new URL(request.url)
  const callback = new URL("/auth/callback", origin)
  callback.searchParams.set("provider", "azure")
  callback.searchParams.set("next", loginReturnPath(searchParams.get("next")))
  const supabase = await createClient(cookieStore)
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: { scopes: "email", redirectTo: callback.toString(), skipBrowserRedirect: true },
  })
  if (error || !data.url) {
    return NextResponse.json({ error: "Unable to start sign-in. Please try again." }, { status: 503, headers })
  }
  return NextResponse.redirect(data.url, { headers })
}
