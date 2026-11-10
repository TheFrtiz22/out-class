# Turnstile bot checks

Status: implemented, completely off unless BOTH keys are set at build time. Updated on branch `security/turnstile-forms` (student claim, dual-key gate, 2.5 s siteverify timeout, server-side missing-token refusal).

## What is protected, and where it is enforced

| Form | Call | Enforced by |
| --- | --- | --- |
| Student signup (`/signup`) | `supabase.auth.signUp` in `actions/onboarding.ts` | Supabase Auth captcha |
| Signup code resend | `supabase.auth.resend` (browser) | Supabase Auth captcha |
| Password sign-in, email-code request (`/login`) | `signInWithPassword`, `signInWithOtp` (browser) | Supabase Auth captcha |
| Forgot password and account settings reset email | `resetPasswordForEmail` in `/api/auth/password-recovery` | Supabase Auth captcha |
| Admin password re-check (`/platform/login`) | `signInWithPassword` in `/api/platform/elevation` | Supabase Auth captcha |
| School request (`/request-school`) | `/api/school-requests` | OutClass server, Cloudflare siteverify (`lib/turnstile.ts`) |
| Student invitation claim (`/auth/student-claim`) | `/api/auth/student-claim` (`verifyOtp` + `updateUser`, not captcha-aware) | OutClass server, Cloudflare siteverify, before any account lookup |

One verifier per token (a Turnstile token can be redeemed once). Auth paths pass the token to
Supabase instead of verifying it in OutClass, because the login code request, password
sign-in and code resend go straight from the browser to Supabase, and Supabase's Auth
endpoints accept direct calls with the public key: only Supabase's own setting closes that
path. If OutClass also ran siteverify on the server-side Auth calls (signup, password
recovery), the token would be spent and Supabase would reject it. Those server paths only
refuse a missing token when configured (`turnstileTokenPresent`). Paths with no
captcha-aware Supabase call (school requests, student claims) use siteverify. A test fails if
a new direct Auth call is added without the token.

Siteverify has a 2.5 s timeout. A timeout or Cloudflare outage fails closed with "temporarily
unavailable. Please try again." (HTTP 503): availability of those two forms depends on
Cloudflare while configured. The bot-check answer never depends on whether an address has an
account. No CSP change was needed: the only CSP is `frame-ancestors 'self'`, which does not
restrict scripts or child frames. If a `script-src`/`frame-src` policy is added later, include
`https://challenges.cloudflare.com` in both.

Not challenged: `verifyOtp` (code and link verification), Microsoft sign-in, signed-in actions.

## Turning it on (owner)

1. Cloudflare dashboard → Turnstile → add a widget for `www.out-class.net` (and preview
   hostnames if wanted), mode **Managed**. Copy the site key and secret key.
2. Vercel: set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` for Production
   (both must be present at build; either alone keeps everything off). Redeploy (build-time). School requests are now verified; Auth calls now
   carry tokens, which Supabase ignores until step 3.
3. Confirm sign-in, signup and password reset still work on production.
4. Supabase dashboard → Authentication → Bot and Abuse Protection → enable CAPTCHA,
   provider Turnstile, paste the **same secret key**. From now on Supabase rejects Auth calls
   without a valid token.

Reverse order to turn it off (Supabase setting first). Enabling step 4 without step 2 locks
everyone out of password sign-in and signup.

## Behaviour

- The widget uses `appearance: "interaction-only"`: most visitors see nothing.
- Tokens are single use; every form requests a fresh one after each submission.
- If the Cloudflare script is blocked (extension, campus filter, offline), the form shows
  "The security check couldn't load…" with a retry. While the Supabase setting is on, such a
  visitor cannot sign in with a password or email code until the script loads; Microsoft
  sign-in is unaffected.
- A wrong or missing secret on the school-request path is logged (error codes only, never the
  token) and returns "temporarily unavailable" rather than blaming the visitor.

## Verification still needed

Real-browser check with the script allowed and blocked; Supabase enforcement on a staging
project (a direct `POST /auth/v1/signup` without a token must fail); screen-reader pass on the
interactive challenge.
