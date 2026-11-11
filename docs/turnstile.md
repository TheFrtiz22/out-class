# Turnstile bot checks

Status: implemented, completely off unless BOTH keys are set at build time. Updated on branch `security/turnstile-forms` (student claim, dual-key gate, 2.5 s siteverify timeout, server-side missing-token refusal).

## What is protected, and where it is enforced

Two server-only switches: the keys (stage 1) and `TURNSTILE_AUTH_ENFORCED_BY_SUPABASE` (stage 2).

| Form | Call | Stage 1: keys set, flag unset | Stage 2: flag `1` + Supabase captcha on |
| --- | --- | --- | --- |
| Student signup (`/signup`) | `signUp` in `actions/onboarding.ts` | OutClass siteverify; token not forwarded | Presence check; Supabase verifies |
| Forgot password, account settings reset email | `resetPasswordForEmail` in `/api/auth/password-recovery` | OutClass siteverify; token not forwarded | Presence check; Supabase verifies |
| Signup code resend | `auth.resend` (browser) | Not verified | Supabase verifies |
| Password sign-in, email-code request (`/login`) | `signInWithPassword`, `signInWithOtp` (browser) | Not verified | Supabase verifies |
| Admin password re-check (`/platform/login`) | `signInWithPassword` in `/api/platform/elevation` | Missing token refused; not verified | Presence check; Supabase verifies |
| School request (`/request-school`) | `/api/school-requests` | OutClass siteverify | OutClass siteverify |
| Student invitation claim (`/auth/student-claim`) | `/api/auth/student-claim` (`verifyOtp` + `updateUser`, not captcha-aware) | OutClass siteverify, before any account lookup | Same |

One verifier per token: a Turnstile token can be redeemed once, so OutClass never runs
siteverify on a token it then forwards to Supabase (`authTurnstile` in `lib/turnstile.ts`).
Browser-side login (password, email code) and code resend go straight from the browser to
Supabase with the public key, so they are protected **only once Supabase's captcha setting
is on** (stage 2). A test fails if a new direct Auth call is added without the token.

The server requires the build-time `TURNSTILE_ENABLED` flag as well as both keys, so keys
added without a rebuild change nothing on either side.

Siteverify has a 2.5 s timeout. A timeout or Cloudflare outage fails closed with "temporarily
unavailable. Please try again." (HTTP 503): while configured, the forms OutClass verifies
depend on Cloudflare being reachable. The bot-check answer never depends on whether an
address has an account. No CSP change was needed: the only CSP is `frame-ancestors 'self'`,
which does not restrict scripts or child frames. If a `script-src`/`frame-src` policy is added
later, include `https://challenges.cloudflare.com` in both.

Not challenged: `verifyOtp` (code and link verification), Microsoft sign-in, signed-in actions.

## Turning it on (owner)

1. Cloudflare dashboard → Turnstile → add a widget for `www.out-class.net` (and preview
   hostnames if wanted), mode **Managed**. Copy the site key and secret key.
   Vercel Production: set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` (both
   must be present at build; either alone keeps everything off), then redeploy. Signup,
   password recovery, school requests and student claims are now verified by OutClass.
   Confirm they still work on production.
2. Later, in one window (to avoid a gap or a lockout):
   - Vercel: set `TURNSTILE_AUTH_ENFORCED_BY_SUPABASE=1`, redeploy;
   - Supabase dashboard → Authentication → Bot and Abuse Protection → enable CAPTCHA,
     provider Turnstile, paste the **same secret key**.
   Browser-side login and code resend are protected only from this point.

To turn off, reverse: Supabase setting off first, then unset the flag and redeploy, then
remove the keys. Supabase captcha on while the flag is unset rejects signup and password
recovery (their tokens are spent by OutClass); flag set while Supabase captcha is off leaves
those two forms with only a presence check.

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
