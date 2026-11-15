import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { canAccessDemo, DEMO_COOKIE } from "@/lib/demo/access";
import { allowedWhileSecondFactorPending, RETURN_PATH_HEADER, secondFactorPending, twoStepChallengeHref, TWO_STEP_REQUIRED_MESSAGE, userMfaEnabled } from "@/lib/user-mfa";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

export const createClient = async (request: NextRequest, options: { demoOnly?: boolean } = {}) => {
  // With two-step sign-in on, forward the requested path (overwriting any client value) so a
  // server-side challenge redirect can return to it; requireAuth still passes it through safeReturnPath.
  const forwarded = () => {
    if (!userMfaEnabled()) return request.headers;
    const headers = new Headers(request.headers);
    headers.set(RETURN_PATH_HEADER, request.nextUrl.pathname + request.nextUrl.search);
    return headers;
  };
  // Create an unmodified response
  let supabaseResponse = NextResponse.next({
    request: {
      headers: forwarded(),
    },
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request: { headers: forwarded() },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    },
  );

  // IMPORTANT: You *must* call supabase.auth.getUser() to refresh the auth token.
  const { data: { user }, error } = await supabase.auth.getUser();

  if (options.demoOnly) {
    if (error || !user?.email_confirmed_at || !canAccessDemo(user.email)) {
      const denied = new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
      supabaseResponse.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
      denied.cookies.delete(DEMO_COOKIE);
      return denied;
    }
    supabaseResponse.headers.set("Cache-Control", "private, no-store");
    supabaseResponse.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  // Optional two-step sign-in (flag-gated). A fast first gate only: getSessionUser/requireAuth
  // enforce the same rule for Server Actions and every server loader.
  if (!options.demoOnly && userMfaEnabled() && user && !error && !allowedWhileSecondFactorPending(request.nextUrl.pathname)) {
    const { data: { session } } = await supabase.auth.getSession();
    if (secondFactorPending(user, session?.access_token)) {
      const blocked = request.method === "GET" || request.method === "HEAD"
        ? !request.nextUrl.pathname.startsWith("/api/")
          ? NextResponse.redirect(new URL(twoStepChallengeHref(request.nextUrl.pathname, request.nextUrl.search), request.url))
          : NextResponse.json({ error: TWO_STEP_REQUIRED_MESSAGE }, { status: 401 })
        : NextResponse.json({ error: TWO_STEP_REQUIRED_MESSAGE }, { status: 401 });
      supabaseResponse.cookies.getAll().forEach(cookie => blocked.cookies.set(cookie));
      blocked.headers.set("Cache-Control", "private, no-store");
      return blocked;
    }
  }

  return supabaseResponse;
};
