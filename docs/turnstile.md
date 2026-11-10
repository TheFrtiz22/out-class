# Turnstile bot checks

Status: implemented, off until configured. Branch `security/turnstile`.

## What is protected, and where it is enforced

| Form | Call | Enforced by |
| --- | --- | --- |
| Student signup (`/signup`) | `supabase.auth.signUp` in `actions/onboarding.ts` | Supabase Auth captcha |
| Signup code resend | `supabase.auth.resend` (browser) | Supabase Auth captcha |
| Password sign-in, email-code request (`/login`) | `signInWithPassword`, `signInWithOtp` (browser) | Supabase Auth captcha |
| Forgot password and account settings reset email | `resetPasswordForEmail` in `/api/auth/password-recovery` | Supabase Auth captcha |
| Admin password re-check (`/platform/login`) | `signInWithPassword` in `/api/platform/elevation` | Supabase Auth captcha |
| School request (`/request-school`) | `/api/school-requests` | OutClass server, Cloudflare siteverify (`lib/turnstile.ts`) |

Auth paths pass the token to Supabase instead of verifying it in OutClass, because Supabase's
Auth endpoints accept direct calls with the public key. Only Supabase's own setting closes that
path. A test fails if a new direct Auth call is added without the token.

Not challenged: `verifyOtp` (code and link verification), Microsoft sign-in, signed-in actions.

## Turning it on (owner)

1. Cloudflare dashboard → Turnstile → add a widget for `www.out-class.net` (and preview
   hostnames if wanted), mode **Managed**. Copy the site key and secret key.
2. Vercel: set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` for Production.
   Redeploy (the site key is build-time). School requests are now verified; Auth calls now
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
