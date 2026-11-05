# Authorization matrix

Appended by `outclass-authz-matrix`. Release metric: count of `untested` cells on P0 resources (target 0 before pilot).


## 2026-11-05 · AUTH-PATHS · Student workspace paths (branch `routes/student-paths`)

Resource: the personal workspace entry (`/home`, `/explore`, `/explore/categories`, `/applications`, `/applications/status`, `/clubs`, `/clubs/meetings`, `/clubs/tasks`, `/calendar`, `/inbox`, `/profile`) through `components/student-workspace-page.tsx`, plus the signed-in redirect on `/`. No new data access: pages call the same session-scoped `getStudentDashboardData()` the homepage did. Operation covered: read (page render). Create/edit/delete/export/Storage are unchanged server actions and out of scope.

| Actor | Read a student path | `/` | Notification href (trigger) | Test |
|---|---|---|---|---|
| Logged-out visitor | deny → `/login?next=<path>`; no DB or dashboard read | landing | n/a | `tests/student-paths.test.cjs` (authz: logged-out…), browser check |
| Expired session / auth error | deny, same | landing | n/a | same |
| Unconfirmed email | deny, same | landing | n/a | same |
| Non-UVA email | deny, same | landing | n/a | same |
| Disabled account | notice; no dashboard read | notice on `/` itself, including with `?next=` (no redirect) | n/a | `student-paths` (disabled…; / redirect…) |
| Demo (allowed) | fictional client data; no session, DB or dashboard read | landing (unchanged) | n/a | `student-paths` (demo…) |
| Demo cookie without access | falls through to live auth (deny if signed out) | landing | n/a | `student-paths` (demo…) |
| Platform view-as | identity from `requireAuth()` (viewed student) | → `/home` | n/a | `student-paths` (platform view-as…) |
| Student A (confirmed UVA) | own workspace view; onboarding kept without profile | → `/home`, or same-origin `?next` | `/applications` | `student-paths`, `auth-navigation`, `test:migrations` |
| Student A, `?next=` off-site (`//`, `https:`, `\`) | n/a | → `/home` (rejected) | n/a | `student-paths` (/ redirect…) |
| Student B / Student C (other school) | only their own session data; path carries no user, club or school id | same | own rows only (trigger unchanged except href) | **inherited**: `getStudentDashboardData` scoping is unchanged and not re-tested here |
| Expired or invalid platform view-as session | `requireAuth()` throws, as on `/` | same | n/a | **inherited** from `app/page.tsx`; not re-tested |
| Demo cookie + view-as cookie | view-as identity; middleware blocks demo mutations | same | n/a | **inherited**; not re-tested |

Untested cells: 0 for the new entry gates; 3 rows inherited from the homepage are marked above. Mutation-checked: removing the sign-in redirect fails 2 tests; reading dashboard data before the disabled check fails 1.

Second opinion (`authz-reviewer`): no high findings. M1 (branch base predated #127) resolved by fast-forwarding to `2427d3b8`. L1 fixed (disabled check now precedes the `/` redirect) with a test; L2 pinned by test; L3 relabeled above; L4: migration wrapped in BEGIN/COMMIT and `test:migrations` now asserts invoker security, no SET clause and no PUBLIC execute.

Update (same day): E2E against a production build showed Next rewrites a 127.0.0.1/[::1] host to `localhost` in middleware redirects, which dropped host-scoped session cookies (local/CI only; real hostnames unaffected). Middleware now 307s on every other host; loopback-IP requests fall through to `legacyStudentRedirect()` in `app/page.tsx`, whose page redirect keeps the browser's host. Destination is still path-only from `STUDENT_ROUTES`, so no open redirect. Tests: `student-paths` (middleware real host vs loopback; page fallback), `student-paths-e2e` (signed-in, real stack), `application-writing-e2e` (old URL while signed in).
