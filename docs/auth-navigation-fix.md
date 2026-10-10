# Public authentication navigation repair

## Routing issue

The shared marketing header mixed account creation, account workspaces, and platform administration in its Get Started destination. It fetched `/api/platform/eligibility` and selected `/platform` for eligible signed-in accounts; that protected route can redirect to `/platform/login` when elevation is absent. Signed-out clicks on the landing page were also intercepted according to the student/leader perspective: students opened a signup dialog, while leaders entered the authentication shell. Other public pages used `/?signup=student`. This gave the same CTA different behavior across sessions, pages, and click types.

Read-only production inspection on October 9, 2026 found the signed-out HTML link to `/?signup=student`, and Log In to `/login`. The reported ordinary-user redirect to Superadmin was not reproducible from that signed-out HTML. The source's administrator destination branch is confirmed and removed; no public account-entry destination now depends on platform eligibility.

## Result

- The shared desktop/mobile header always links Get Started to `/signup` and Log In to `/login`, including Landing, How It Works, About, UVA/FAQ, and Request Your School.
- Public club signup/login actions retain the club URL and use the same account entry pages. Landing signup and club-leader CTAs use the same signup route. Legacy `/?signup=student` bookmarks redirect there with their query context intact.
- `/signup` reuses `StudentOnboardingWizard`, `registerStudent`, existing Supabase email/password registration, OTP confirmation/resend, and profile persistence. It also offers the existing UVA Azure OAuth provider, returning to signup for profile completion. The requested welcome copy uses the existing login brand panel, typography, colors, and responsive layout.
- Verified accounts with unfinished profiles resume the existing wizard. Completed accounts go to their personal dashboard or an active, unsuspended club workspace supported by existing membership capabilities. Legacy role strings never grant access.
- Signup retains invitation/claim return paths and rejects direct platform/login/signup return destinations. Switching between login and signup preserves query context. OAuth success and failure retain signup/invitation/claim context.
- Normal login resolves the existing account's default workspace on the server. Deliberate `/login?next=/platform` entry remains available from the separate `/platform/login` flow, with all existing allowlist, database grant, password, MFA, elevation, and session checks intact.
- No provider, account-creation action, permission grant, database schema, OTP policy, recovery API, invitation acceptance, or claim approval behavior changed. New accounts remain students until existing authorization workflows grant contextual club access.
- `/signup` receives the existing private-route indexing policy and impersonation authentication guard. Demo signup requires exiting Demo Mode.

## Authentication inventory audited

| Entry/boundary | Existing behavior retained or reused |
| --- | --- |
| `/login`, homepage auth view | Normal UVA Microsoft, password, existing-account email OTP |
| Homepage student onboarding, new `/signup` | Account registration, confirmation, profile creation |
| `/auth/callback` | PKCE exchange, UVA enforcement, student account upsert, same-origin return |
| `/forgot-password`, `/reset-password`, `/api/auth/password-recovery` | Existing password recovery and verified-email proof |
| `/auth/student-claim`, `/api/auth/student-claim` | Existing identity verification |
| `/invitations/[id]`, `/settings/organizations` | Verified identity, profile completion, invitation acceptance |
| `/club-claims/[clubId]`, public unclaimed club notice | Manual claim and approval, no automatic administration |
| `/platform/login`, `/api/platform/elevation`, `/platform/*` | Separate protected platform authentication |
| `/api/auth/logout`, root AuthProvider, `/api/users/me` | Session lifecycle and verified current identity |
| Root middleware and Supabase middleware | Session refresh, demo/support mutation guards |
| `utils/auth`, `utils/profile-onboarding`, platform/admin guards | Server authorization and onboarding requirements |
| `next.config.mjs` | Canonical host redirect and private-route headers |

## Files changed

Application routes and boundaries:
- `app/signup/page.tsx` (new)
- `app/login/page.tsx`
- `app/auth/callback/route.ts`
- `app/page.tsx`
- `app/robots.ts`
- `middleware.ts`
- `next.config.mjs`

Authentication and public UI:
- `components/auth/signup-page-view.tsx` (new)
- `components/auth/login-page-view.tsx` (new)
- `components/auth/login-brand-panel.tsx`
- `components/auth/login.css`
- `components/views/student-onboarding-wizard.tsx` (responsive OTP slot width only)
- `components/views/auth-view.tsx`
- `components/views/landing-page-view.tsx`
- `components/landing/public-navigation.tsx`
- `components/qr/public-club-page.tsx`
- `components/home-entry.tsx`
- `components/app-shell.tsx`

Routing helpers:
- `lib/auth.ts`
- `utils/auth-entry.ts` (new)

Validation:
- `tests/auth-navigation.test.cjs` (new)
- `tests/integration-audit.test.cjs`
- `tests/login-ui.test.cjs`
- `tests/onboarding-e2e.test.cjs`
- `tests/platform-admin.test.cjs`
- `tests/student-journey.test.cjs`
- `docs/auth-navigation-fix.md` (this report)

The onboarding E2E setup now authenticates through `/api/platform/elevation`; its old direct provider MFA setup omitted the elevation required by the current architecture. The stale recruitment reader check also now exercises the existing `/api/workspace` read boundary instead of looking for a Server Action response from an API-only worker. The delivery concurrency assertion now checks the exact persisted delivery and captured email, allowing the existing background worker to finish before manual workers. Production guards were not relaxed.

## Validation

- `npm test`: 923 tests, 914 passed, 9 environment-gated skips, zero failures. The local onboarding suite was also run separately with its environment enabled.
- Real local onboarding E2E: 12 tests passed, zero skips/failures. Used the production Next build, Supabase Auth/MFA, PostgreSQL and captured SMTP. Confirmed public links, legacy signup redirects, resuming verified incomplete profiles, student/leader destinations, OTP creation/resend/consumed tokens, invitations/claims, permission checks, concurrent delivery, password recovery, and repeated sessions.
- `npm run test:migrations`: all 31 migrations validated on fresh and legacy databases; all 54 tables enforce browser isolation.
- `npm run lint`: passed, zero errors; 25 pre-existing warnings elsewhere in the repository.
- `npm run typecheck`: passed.
- `npm run build`: passed through the isolated runner with local configuration, including lint and TypeScript build checks.
- `git diff --check`: passed.
- Chrome: desktop and 320 CSS-pixel mobile header links and click destinations verified; mobile menu keeps both account buttons visible. Signup had no horizontal overflow at 320 pixels. Login/create-account switching verified. Existing Microsoft OAuth request and callback behavior are covered by executed routing tests; no real university OAuth consent was performed.

Validation logs and browser captures are saved in the ignored `out/auth-navigation/` directory. The temporary local test server/stack were stopped after validation. No deployment was performed.

![Signup desktop preview](../out/auth-navigation/signup-desktop.jpg)

[Mobile navigation capture](../out/auth-navigation/mobile-navigation.jpg)
