# Microsoft authentication temporarily disabled

`NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH=false` is the default. Only the exact value
`true` enables Microsoft authentication. The shared policy is
`lib/auth-features.ts`; `.env.example` records the disabled setting. Next.js
embeds public environment values during a build, so changing this flag requires
a new build before it changes the application.

Login and signup omit the existing **Continue with UVA** Azure buttons and the
Microsoft icon. Email/password login, existing-account email OTP and password
recovery remain available; the email login form is immediately visible.
The shared login component covers both student and leader entry. Signup keeps
the existing student onboarding wizard and invitation/claim return paths.
Public **Get Started** and **Log In** destinations remain `/signup` and `/login`.
University-email errors no longer prompt users to use Microsoft.

When enabled, the preserved Azure OAuth integration starts through
`GET /auth/microsoft`, using the existing Supabase server client, cookie-based
PKCE, `email` scope and same-origin `/auth/callback`. When disabled, that endpoint
returns HTTP 403 before creating a Supabase client or changing authentication
cookies. Query parameters cannot enable it. Demo/support impersonation guards
still apply when enabled. Callbacks marked `provider=azure` are also rejected
while disabled, without exchanging a code or signing out an existing session.

**Enforcement boundary:** this flag controls OutClass's entry points. Supabase's
separate hosted `/auth/v1/authorize?provider=azure` endpoint is controlled by its
provider configuration, which was deliberately left unchanged. A direct hosted
request can bypass the application initiation endpoint; an unmarked callback
also retains its existing generic exchange behavior. A complete hosted-provider
shutdown requires separately approved Supabase configuration work. The flag is
not represented as disabling that external endpoint.

No provider credentials, Supabase provider settings, dependencies, schemas,
linked-account verification policies or existing session refresh logic changed.
To reactivate, review/test the Entra tenant, credentials and redirect allowlist,
set the flag to `true`, rebuild, and test both normal-login and invitation/claim
signup returns before releasing.

## Verification — October 9, 2026

- Vercel CLI read-only inspection of `outclassuva/out-class` production variables
  found no `NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH` override. The default is disabled
  for the next build. No production environment or deployment changes were made.
- Full test suite: 923 passed, 9 opt-in skips, no failures. The 26 focused tests
  include default-off parsing, disabled UI/handler behavior, direct HTTP denial,
  enabled Azure configuration, safe returns and protected-mode denial.
- TypeScript passed. Lint passed with 25 pre-existing warnings and no errors.
- Production Next.js build passed against the isolated local test stack.
- Real local onboarding E2E: 13 tests passed, zero skips/failures, using Supabase
  Auth/MFA, PostgreSQL and captured SMTP. It covers public CTAs, Microsoft HTTP
  rejection, retained Superadmin elevation, signup/OTP, profile completion,
  invitations/claims, authorization, replay safety and password recovery.
- Browser checks verified desktop and mobile login/signup without Microsoft
  options, with normal email entry and account-creation navigation.

Nothing was deployed. No live Supabase provider settings were altered.
