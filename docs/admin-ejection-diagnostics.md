# Admin ejection diagnostics

The production ejection has not been reproduced. These changes classify failures; they do not establish its cause. No production or staging operations are needed for this investigation.

## Redirect inventory

| Boundary | Destination / behavior | Classification |
| --- | --- | --- |
| `app/platform/page.tsx` via `getAdminOverview` | `/platform/login` only for explicit typed denials; operational failures render recovery | Authentication, authorization, revoked grant, MFA/AAL2, elevation, expired provider session, impersonation; otherwise operational/unknown |
| `app/platform/[section]/page.tsx`, `events/page.tsx`, `claims/page.tsx` | Same guarded login redirect; unexpected guard exceptions render recovery | Same denial categories |
| Unknown Admin section | Next `notFound()` | Unknown route; not an authentication failure |
| `utils/auth.ts` outside Admin diagnostics | `/` for missing/invalid/unverified/non-UVA identity or unavailable/disabled account | Authentication or authorization; existing behavior preserved |
| `app/platform/login/page.tsx` | Successful password/MFA/elevation sends browser to `/platform`; missing sign-in links to `/?view=auth&next=%2Fplatform`; impersonation/demo blocked in place | Authentication, MFA/AAL2, elevation, impersonation, authorization |
| `app/platform/view-as/page.tsx` | Valid support session goes to `/club/<clubId>/workspace` or `/?workspace=student`; unavailable session stays blocked; unexpected failure renders recovery | Impersonation; operational failures separated |
| `components/platform-view-banner.tsx` | Expiry timer navigates to `/platform/view-as`; explicit safe exit navigates to `/platform` | Impersonation expiry / explicit exit |
| `components/admin/admin-directory.tsx` | Explicit successful support-session start goes to `/?workspace=student` | Impersonation |
| `components/admin/admin-shell.tsx`, `components/club-workspace-switcher.tsx`, `components/app-shell.tsx`, `components/shell/product-shell.tsx`, `components/shell/navigation-search.tsx` | User-selected personal/home/club/settings/search destinations; Admin navigation uses `/platform/...` | Intentional navigation, not automatic auth ejection; no authority conferred |
| `components/shell/product-shell.tsx` | Explicit logout goes to `/` only after durable server logout and provider sign-out succeed | Authentication/logout invalidation |
| `contexts/demo-context.tsx` | Explicit demo operations navigate home or selected demo workspace | Explicit mode/navigation; Admin demo writes remain denied |
| `components/support-session-sync.tsx` | Context change reloads current URL | Impersonation synchronization; guards rerun |
| `app/auth/callback/route.ts`, `app/login/page.tsx` | Validated return path on sign-in; home on disallowed email or expired code/back | Authentication/authorization |
| `middleware.ts`, `utils/supabase/middleware.ts` | Refresh provider cookies; block identity changes during impersonation with 403; no login/workspace redirects | Impersonation; provider refresh |
| `app/api/workspace/route.ts` | Converts generic auth redirects to HTTP 401; other denials 403; no navigation | Authentication/authorization; broader API errors remain outside this page fix |
| `next.config.mjs` | Apex hostname redirects to canonical www hostname preserving path | Host canonicalization; not authentication |

No dedicated unauthorized-page redirect exists in the Admin flow. Denial continues to use the existing login flow or an in-place support-session block.

## Classification and confidentiality

`AdminAccessError` is reserved for explicit failed checks. Codes: `ADMIN_AUTH_REQUIRED`, `ADMIN_ACCESS_DENIED`, `ADMIN_GRANT_REVOKED`, `ADMIN_MFA_REQUIRED`, `ADMIN_SUPPORT_SESSION_CONFLICT`, `ADMIN_ELEVATION_REQUIRED`, and `ADMIN_SESSION_EXPIRED`. Expired/revoked/mismatched elevation remains an elevation denial; an ended provider session is a session denial.

Unexpected errors default to `ADMIN_UNKNOWN_SERVER_ERROR`; overview/claims loader failures use `ADMIN_DATA_LOAD_FAILED`. The overview code identifies its combined guarded loader, so infrastructure failures inside that loader can also receive this code. Provider 5xx, throttling, and unrecognized failures remain operational; explicit provider authentication rejections remain denied. Next navigation and dynamic-render signals are rethrown to the framework before logging.

Page failures emit one JSON `admin.request.failure` server-console event with a fixed route label, category, code, and generated UUID support code. No exception text, stack, user ID, tokens, cookies, request headers or database details are included. Successful renders produce no new diagnostic events or audit entries; existing successful-read audit behavior is retained.

Eligibility operational failures return HTTP 500 with a benign support code instead of claiming ineligibility. Elevation operational failures also return a safe 500 instead of exposing raw exception messages in a 403. Expected elevation denials retain safe messages and existing failure audits. An audit-write failure also fails closed with a safe 500. Invalid origin remains 403 before processing credentials.

All original allowlist, active grant, verified identity, AAL2, impersonation, fresh elevation, expiry, actor/session binding, provider-session existence, and logout checks still execute. Recovery never returns protected loader data. No migrations, credentials, session lifetimes or authorization predicates changed.

## Capture the next real failure

These diagnostics are available only after this change is deployed through the normal release process. This task does not deploy it.

1. Before reproducing, open browser Developer Tools → Network and enable **Preserve log**. Record local time with timezone.
2. Record the Admin URL immediately before the ejection and the final address-bar URL, including the pathname and ordinary query parameters. Do not copy authentication callback fragments or credential parameters.
3. Inspect the original `GET /platform` or failing `GET /platform/<section>` request. On client navigation it may be a Fetch/RSC request with `?_rsc=...`; on refresh it is a Document request. Record method, pathname, status, timing and the redirect `Location` path if present.
4. A denial can be HTTP **307**, or a streamed HTTP **200** response carrying Next redirect instructions. Record both the original request and subsequent `/platform/login` request. A recovery page is normally HTTP **200** with “Admin temporarily unavailable”; status alone does not establish authorization success.
5. Copy only the displayed `ADMIN_...:<uuid>` support code. If the failure is during login/elevation, inspect `POST /api/platform/elevation`: record **403** (expected denial) or **500** (operational), and only its benign `supportCode`/message. For a missing Admin switcher, inspect `GET /api/platform/eligibility`: operational failure is **500** with a support code. Expected eligibility false remains **200**.
6. If a redirect has no displayed code, record timestamp, original route, final route and status. The matching server event has a denial code and UUID; narrow logs by route and time. This implementation does not propagate a request header correlation ID.
7. In the hosting platform's server/function runtime logs for the deployment serving the request, search for `admin.request.failure` and the support code (or route/time for a redirect). On Vercel, use the project's runtime Logs for that deployment. Locally, events appear on the Next server console/stderr. Build logs are not runtime logs.
8. Do not export a HAR, copy “as cURL,” or share request headers, cookies, request bodies, tokens, MFA codes or password values. A screenshot cropped to status/path/support code is sufficient.

## Validation limitations and follow-up

Real local session and broader Admin integration require the guarded disposable fixture at the OS temporary `outclass-corkboard-e2e/config.json`, local Supabase/Docker, and the runner's disposable SMTP certificate. This environment has no running Docker daemon or fixture. Attempts to run both integration modes stop before database access. Hard-refresh and token-refresh scenarios exist in the pre-existing session integration test but cannot be claimed as passed here.

P0/P1: none demonstrated by this work; the production incident's severity and cause remain unproven. P2: real local integration and production reproduction remain outstanding; some non-redirecting support/workspace APIs retain generic broad-denial responses and client-loaded section actions have their existing error handling. P3: existing lint warnings; denial redirects have route/time correlation rather than a browser-visible UUID. No deployment, commit or push is part of this task.

## Final validation (October 9, 2026)

| Check | Result |
| --- | --- |
| Focused diagnostics/elevation/authorization/platform/workspace tests | 42 passed, 0 failed |
| Full `npm test` | 852 total: 844 passed, 8 environment-dependent integration skips, 0 failed |
| `npm run test:migrations` | Passed in embedded local SQL stack; 29 migrations and 53 RLS-protected tables verified |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed: 0 errors, 25 existing warnings |
| Production `npm run build` | Passed with localhost-only database/provider overrides and a non-secret placeholder public key; no runtime diagnostic noise in final build |
| `git diff --check` | Passed |
| `node scripts/run-admin-local.cjs session-integration` | Blocked before access: missing disposable fixture; Docker daemon unavailable |
| `node scripts/run-admin-local.cjs integration` | Same environment blocker |

Regression coverage includes explicit auth, authorization, elevation, AAL2, revoked-grant, closed-provider-session and impersonation denials; valid overview rendering; simulated overview loader failure rendering recovery; unexpected guard/loader failures returning no protected data; provider operational failure returning a safe 500; eligibility operational failure; safe logging; Next framework control-flow preservation. Hard refresh and provider token refresh still require the real local session integration run.

## Exact task files

Modified:

- `app/api/platform/elevation/route.ts`
- `app/api/platform/eligibility/route.ts`
- `app/platform/page.tsx`
- `app/platform/[section]/page.tsx`
- `app/platform/claims/page.tsx`
- `app/platform/events/page.tsx`
- `app/platform/view-as/page.tsx`
- `tests/admin-elevation.test.cjs`
- `utils/admin-elevation.ts`
- `utils/auth.ts`
- `utils/platform-admin.ts`

Added:

- `components/admin/admin-recovery.tsx`
- `docs/admin-ejection-diagnostics.md`
- `lib/admin-failure.ts`
- `tests/admin-diagnostics.test.cjs`
- `utils/admin-page.ts`

Pre-existing work preserved without edits: `components/events/events.css`, `public/images/events/cork.svg`, `scripts/run-admin-local.cjs`, and untracked `tests/admin-session-e2e.test.cjs`.

Final Git state: 14 modified tracked files and 6 untracked files, including that pre-existing work. No files staged, committed or pushed.
