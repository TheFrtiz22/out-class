import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { canAccessDemo, DEMO_COOKIE } from "@/lib/demo/access";
import { allowedWhileSecondFactorPending, RETURN_PATH_HEADER, twoStepChallengeHref, TWO_STEP_REQUIRED_MESSAGE, userMfaEnabled } from "@/lib/user-mfa";

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

  // Demo pages are a presenter-only boundary that needs the server's email-confirmation state,
  // so they keep the remote Auth check. Demo requests are rare.
  if (options.demoOnly) {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.email_confirmed_at || !canAccessDemo(user.email)) {
      const denied = new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
      supabaseResponse.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
      denied.cookies.delete(DEMO_COOKIE);
      return denied;
    }
    supabaseResponse.headers.set("Cache-Control", "private, no-store");
    supabaseResponse.headers.set("X-Robots-Tag", "noindex, nofollow");
    return supabaseResponse;
  }

  // Refresh the session cookies and check the access token's signature locally. getClaims reads
  // the session (refreshing it through Auth when it is about to expire, which writes the new
  // cookies above) and verifies the JWT against the project's published signing keys, cached
  // in memory, so a signed-in request no longer waits for a round trip to Auth. Middleware
  // grants nothing: every Server Component, Server Action and route handler still verifies the
  // exact token with Auth, binds it to a live auth.sessions row and applies the disabled-account
  // and two-step rules (getSessionState in utils/auth.ts).
  // A thrown error (signing keys unreachable, Auth down mid-refresh) must not take every page
  // down: pass through and let the server's own Auth check decide, as it always does.
  let claims: { aal?: unknown } | null = null;
  try {
    const { data, error } = await supabase.auth.getClaims();
    claims = error ? null : data?.claims ?? null;
  } catch (error) {
    console.warn(JSON.stringify({ event: "middleware.claims.unavailable", error: error instanceof Error ? error.name : "unknown" }));
  }

  // Optional two-step sign-in (flag-gated). A fast first gate only: getSessionUser/requireAuth
  // enforce the same rule with the Auth-verified user for Server Actions and every server loader.
  // A verified aal2 token has passed its second factor. Otherwise Supabase's assurance check reads
  // the factors that Auth returned with this session; that record lives in the cookie, so it only
  // decides whether to send the visitor to the challenge early, never whether to let them in.
  if (claims && userMfaEnabled() && claims.aal !== "aal2" && !allowedWhileSecondFactorPending(request.nextUrl.pathname)) {
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2") {
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
