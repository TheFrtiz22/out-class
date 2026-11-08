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

Update (pre-PR review): nextjs-reviewer H1 — profile-less students sent to `/?next=<page>` by `requireCompletedStudentProfile` were redirected straight back (loop). `/` now redirects signed-in visitors only when they have a profile or no `next`; otherwise onboarding runs on `/` and continues to `next` as before. Test: `student-paths` (onboarding hand-off; mutation-checked). Migration reviewer: both trigger functions now `SET search_path = pg_catalog, public`; `test:migrations` asserts it, checks each trigger on its own table, and fires the application trigger to read the stored `/applications` href.

## 2026-11-06 · AUTH-FOCUS · Interview room route and focus frame (branch `ui/focus-frame`)

Resource: the interview room, moved from `/club/[clubId]/workspace?section=recruitment&tool=interviews&interview=1` to `/club/[clubId]/interview` (`app/(focus)/club/[clubId]/interview/page.tsx` → `components/interviews/club-interview-room.tsx` → the unchanged `InterviewWorkspaceView`). Candidate data still comes only from the existing server actions (`getInterviewWorkspace`, `resolveInterviewRoomEntry`, `openInterviewSession`, …), which keep their own checks. The other focus routes only moved into the `(focus)` route group; URLs, pages and their auth are unchanged.

| Actor | Open `/club/x/interview` | Old `?interview=1` URL | Test |
|---|---|---|---|
| Logged-out visitor | deny → `/login?next=/club/x/interview?…` (same room after sign-in) | → new route, then the same sign-in | `focus-frame-e2e` (signed out…), `focus-frame.test` (route rules) |
| Demo (allowed) | fictional demo data, as in the workspace | → new route | `demo-interview-navigation-browser` |
| Student without membership | "Interview room unavailable"; no candidate read | → new route; same | `focus-frame-e2e` (old URL…), `club-interview-recovery` |
| Member without `applications.review` | same as above | same | `club-interview-recovery` (denied) |
| Member of a suspended club | suspended notice; no room | same | `focus-frame.test` (route rules: suspendedAt) |
| Reviewer of club x | room for club x after club selection; Exit and the room's Back return to the filtered list | → new route keeping `interviewTab`, `date`, `roundId`, `applicationId`, `bookingId`, `slotId`, `roomId` | `club-interview-recovery`, `interview-entry`, `interview-entry-browser`, `interview-room-layout` |
| Reviewer of club y opening club x | treated as no membership in x (membership is looked up by the URL's clubId): unavailable notice, no candidate read | same | `focus-frame-e2e` (old URL…: random club id) |

Exit targets: `safeExitHref` accepts only same-site, non-focus paths (no `//`, backslash, scheme or focus route); the stored last product page is re-validated on read (`focus-frame.test`).

## 2026-11-06 · UI-GLASS-1 · Club home member counts (branch `ui/club-home-glass`)

Change: `getClubWorkspaceOverview` (`actions/club-overview.ts`) adds `members: { active, pendingInvitations } | null` — two **counts** (`clubMember.count` for ACTIVE, non-disabled members; `clubInvitation.count` for PENDING, unexpired, unrevoked member invitations: `requestedRole: MEMBER`, purpose MEMBERSHIP or ACCESS_GRANT, `applicationId: null`; owner designations, leader-role grants and offers are not counted, per owner decision). No identities, emails or invitation rows are returned. Gate: `organizationCapabilities(membership)` `canManageMembers || canChangeRoles`, the same gate as `getOrganizationMemberManagement` (the member directory, which already returns every member and invitation in full). Membership comes from `requireClubMembership(clubId)` (validated session), re-checked after the reads as before. Demo mode returns counts computed from the read-only demo store (`lib/workspace-api.ts`).

| Actor | Overview read | `members` counts | Test |
|---|---|---|---|
| Logged-out / expired session | deny (`requireClubMembership` throws) | not queried | **inherited**: `club-workspace.test` (revoked membership rejects) |
| Owner of club X | allow | counts for club X only (`where.clubId`) | `club-home.test` (overview action…), `club-workspace.test` (review-only… owner) |
| Leader with `members.manage` or `leaders.manage` | allow | counts | `club-home.test` (leaders.manage) |
| Member without member-directory access (plain, reviewer, meetings/tasks manager) | allow (existing subset) | `null`, and neither count is queried | `club-home.test`, `club-workspace.test` (reviewer: `queries.members` undefined) |
| Leader of club Y requesting club X | deny (no membership in X) | not queried | **inherited**: `club-workspace.test` (`id !== clubId` → Denied) |
| Membership revoked between reads | throws "Workspace access changed" (existing post-read recheck) | discarded | **untested for the overview** (pre-existing code; the same recheck is tested for the review queue in `operational-dashboards.test`) |
| Demo | demo store counts only; no server read, no writes | demo counts | `club-home-browser.test` fixture is isolated; demo adapter typed against the action |

Untested cells: 0 for the new counts; 1 pre-existing recheck cell untested; 2 inherited rows marked. `pnpm run test:migrations`: 71 migrations, 85 RLS tables (unchanged; no schema change). Not run against disposable Postgres: the change adds two club-scoped counts behind an existing gate, proven with recorded query shapes.

## 2026-11-07 · PUBLIC-SITE-1 · Signed-out Explore and link previews (branch `ui/public-site-cleanup`)

Changes: (1) signed-out `/explore` renders a Server Component from the existing public projection `getClubDirectory()` (`actions/club-directory.ts`, explicit public fields; `isDiscoverable`, `suspendedAt: null`), filtered to claimed database clubs and projected to card fields only (`lib/public-explore.ts`: id, name, logo text/url/colour, logo presentation keys, category, tagline, applications open, deadline). Search is a GET form evaluated on the server over that projection; no search key or club list is sent to the browser. (2) `lib/public-link-preview.ts` adds two signed-out reads: invitation preview (club name + offered role for a PENDING, unexpired, unanswered, unrevoked invitation of an unsuspended club; selects only `requestedRole`, `schoolIdentityId`, `club.name`) and club link preview (`club.name` of an unsuspended club, the same field public SEO already exposes). (3) `/invitations`, `/club-access`, `/club-claims` layouts become `optional`; each page still runs its existing identity checks for any signed-in session. Accept, claim and access edits are unchanged.

| Actor | Public Explore | Invitation preview `/invitations/[id]` | Club link preview `/club-access`, `/club-claims` | Test |
|---|---|---|---|---|
| Logged-out visitor | allow: claimed, discoverable, unsuspended clubs; card fields only; Apply/Follow → `/login?next=/club/<id>` | allow: club name + role only for a valid pending link; unknown, expired, revoked, answered, suspended-club and malformed ids all return the same "isn't valid" card (no existence or reason leak); no email, inviter, identity | allow: club name; editor data (`getClubAccess`) and claims are never read | `public-entry-points.test` (projection keys, unclaimed/preview excluded; preview where/select; forbidden mocks prove no identity or access read) |
| Expired session | treated as logged out (no `getSessionUser` user) | same as logged out | same | inherited: `getSessionUser` verification (`auth-session` tests) |
| Student A (signed in) | existing student Explore (`StudentWorkspacePage`, unchanged) | existing flow: `requireAuth({verifyEmail})`, completed profile, school identity match; invitation for someone else → "Invitation unavailable" | existing editor/claim flow | inherited: `invitations-*`, `club-access*`, `club-claims*` tests |
| Student C (other school) | same public projection (UVA clubs only exist today) | existing identity match denies | existing | inherited |
| Platform admin view-as | not public: platform cookie forces `requireAuth()` | unchanged | unchanged | inherited |
| Demo | unchanged demo Explore | unchanged | unchanged | inherited |

Untested cells: 0 new. The link-holder disclosure (club name and role to anyone holding a valid invitation id, a 122-bit UUID sent by email) is an owner decision recorded in the PUBLIC-SITE-1 report. `pnpm run test:migrations` unchanged (no schema change).

Update 2026-11-07 (owner decision): Explore stays private. The signed-out Explore view, `lib/public-explore.ts` and the `signedOut` render prop were removed before merge; signed-out `/explore` redirects to `/login?next=/explore` as on main. The Public Explore column above no longer applies. `getPublicClub` now returns the public view of marketing (`presentPublicMarketing`) for the club page, Explore's profile view and `/api/workspace` "publicClub" (`admin-clubs.test`).

## 2026-11-08 · SHELL-1 · Overview views and the persistent shell (branch `ui/shell-persistence-and-dashboard-split`)

Changes: `getClubWorkspaceOverview(clubId, view)` (`actions/club-overview.ts`) takes `view` ∈ `all | club | recruiting | strip` (zod enum; `/api/workspace` accepts `[clubId]` or `[clubId, view]`). A view only **skips** queries; every query that runs keeps its existing gate. New fields: `operations.teamTasks` (per task: title, due, outstanding count; `tasks.manage`, never per person), `operations.rounds[].reviewed` (inside the existing rounds query and its `read` gate), `members.recent` (30-day count, member-directory gate). Part 1 moved routes into `app/(workspace)`: `AuthenticatedPageLayout` keeps each route's rule (now a gate only) and `workspaceFrame()` only picks the chrome; pages keep `requireAuth` / `requireClubPermission` / `requirePlatformAdmin`.

| Actor | Overview any view | `teamTasks` | `rounds[].reviewed` | `members.recent` | Test |
|---|---|---|---|---|---|
| Logged-out / expired session | deny (401/403) | not queried | not queried | not queried | `overview-view-authz-e2e` (signed out, club + strip) |
| Owner of club X | allow, every view | listed (club/all views) | counts | counts | `overview-view-authz-e2e` (5 views 200), `club-home.test` (view scoping, members) |
| Plain member of X | allow | `[]`, no `clubTask` query | `[]`, no raw query | `null`, not queried | `club-home.test` (authz: new fields keep their gates, all 4 views) |
| Reviewer of X | allow | `[]` | counts (existing rounds gate) | `null` | `club-home.test`, `operational-dashboards.test` |
| Leader of club Y requesting X | deny | not queried | not queried | not queried | `overview-view-authz-e2e` (other club, 3 views) |
| Unknown `view` value | 400 at the route, throws in the action | — | — | — | `overview-view-authz-e2e`, `club-home.test` (`'everything'` rejects) |
| Membership revoked between reads | existing post-read recheck throws | discarded | discarded | discarded | untested for the overview (pre-existing, unchanged) |
| Demo | demo store only; adapter ignores `view`; no server read | demo per-task list | demo counts | 0 | `club-home-browser.test` fixture (isolated) |

Shell (Part 1): signed-out on a required route → the route's gate redirects/denies (`settings-navigation.test`); the client shell derives the rail from the account's own memberships (`workspace-shell.test`: no leader rail for a club without workspace access, suspended club → personal rail); access loss still runs the existing `router.replace` reconciliation (unchanged code in `ProductShell`).

Untested cells: 0 new; 1 pre-existing recheck cell untested (unchanged). `pnpm run test:migrations`: see validation-report (no schema change).
