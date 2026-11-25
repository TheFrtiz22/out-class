# Overnight launch-readiness run, 2026-11-25

Owner brief: 10-hour unattended run as lead engineer (owner message 2026-11-25 06:02 UTC). Owner approved, for this run only, merging to main, production deploys and production database migrations, under the brief's gates. Everything else in CLAUDE.md and AGENTS.md applies.

Times are UTC. "Ran" means executed here or in CI; "read" means verified by reading code only.

## Session start (06:05)

- main `8a70a46` (#541). Production deployment `dpl_2S19S64aiez6wvH13W1UdWpvHfVM` READY on the same SHA. Previous production (rollback target): `dpl_rTzcqHjQHmTYGLDQgDUx9iVxVULx` (`da2586d`).
- Open PRs: #532 (short-answer question type, includes a production DB change), #288 and #200 (owner drafts, left alone).
- CI on main: dependency audit now green (the zod/picomatch advisories are no longer red). "Applicant workflow / shell" has been cancelled at its 75-minute limit on every recent main run.
- Sentry (production, 7 days): only OUT-CLASS-G/H, the 22-minute database login outage of Nov 24 03:16–03:38. Nothing new since.
- Supabase: production `OutClass` (us-west-2) and `outclass-staging` (us-east-1), both healthy.
- Docs named in the brief: `site-review-backlog-2026-11-16`, the hardening audits, `outclass-execution-plan`, `outclass-roadmap` are not in the repo, the project files or Google Drive (searched by title). Used instead: the Nov 24 web and mobile stress-test reports (project files), the handoff, the task ledger and the feature docs.

## Environment limits

- Linux container: no iOS simulator or Android emulator. App journeys are checked through the app's jest suite (CI `mobile` job), the `/api/mobile/v1` server routes and code reading. None is claimed as run on a device.
- Dependencies: installing the project's lockfile here needs the owner's separate yes (agent rule on installs a project's files list), so the full gates run in GitHub Actions on each PR (`validate` = test, test:migrations, lint, typecheck, build; `mobile`; `dependency-audit`; disposable integrations). Local checks use only what runs without installing.
- Postgres 16 is installed in this container, available as a disposable database.

## Work list

(Built from the stress-test reports and CI, each item checked against main before work.)

| # | Item | Source | Status |
| --- | --- | --- | --- |
| A | CI "Applicant workflow / shell" hangs to the 75-minute limit on every main run | CI on main | PR #544 (fix), CI running |
| B | Club with `isDiscoverable=false` still has a public page | Nov 24 web report | Checked: by design ("unlisted"): noindex, out of Explore/search/sitemap, reachable by link for invite-only recruiting. No change. |
| C | Applying to a hidden club by direct link | Nov 24 web report | Same as B: intended for invite-only recruiting. No change. |
| D | Short links (`/q/[code]`) have no rate limit | Nov 24 web report | Stale: `RATE_LIMITS.shortLinks` (600/min) is applied in `middleware.ts`. Codes are 6-char base62. No change. |
| E | Explore directory reads all future events uncached | Nov 24 web report | Measured fine at launch scale (1.35 MB, ~70 ms at 200 clubs). Low priority. |
| F | PR #532 short-answer question needs a production migration | Open PR | Blocked (production migrations gated). Rehearse on disposable Postgres; do not merge. |
| G | 4 unindexed composite foreign keys (Supabase advisor) | Supabase advisor | Checked: already covered. Each FK's two columns are the leading columns of an existing index, in the other order (e.g. `ApplicantRecusal(clubId, memberId)` for FK `(memberId, clubId)`); the advisor compares column order. No migration needed. |
| H | Authorization review: mobile API and recruiting actions | Brief step 2 | Done. Findings H1–H3 fixed (PRs below); M1, M3, M4, R1, R5, R6 logged under "Found, not fixed". |
| H1 | A reviewer can make a decision on their own application, or on one they are recused from, through direct decision paths | Review | PR #545 |
| H2 | A recused reviewer still sees evaluations, answers and attachments through identity reveal and the attachment route; a reviewer sees their own application's review data | Review | PR #546 |
| H3 | Leaders of a suspended club can still search its applicants (web search, app `explore.search`) | Review | PR #547 |
| M4 | Member reads in suspended clubs | Review | Checked, by design: `requireClubPermission` refuses suspended clubs and the workspace shows a suspended state (docs/club-suspension-review.md). The other user-scoped membership lists (account deletion, alumni) are fine. Search was the one side door (H3). |
| R6 | Résumé access for recused or self interviewers | Review | Checked, fine: every résumé read and the `/api/interview-resumes` route go through `authorizeInterview`, which refuses the applicant themselves and recused members. The president/VP moderation list shows names only. |
| L1 | QR check-in: every member's check-in took the meeting row `FOR UPDATE`, so a room checked in one at a time | Load review | PR #548 (meeting `FOR SHARE` + member's own row `FOR UPDATE`). Burst numbers below. |

## Findings, merges, migrations and deploys


### 06:07 Production migrations are blocked by the environment approval gate

- Dispatched the `Database migrations` workflow as a dry run on `main` (run 45558285500). It waits on the GitHub "Production" environment, whose only required reviewer is the owner.
- Approving that pending deployment from this session was refused by the agent's permission guard. Per the brief, not worked around. Cancelled the waiting dry run so no approval request is left open.
- Consequence: no production migration can run tonight. Migration work (PR #532, the missing indexes, the push-session column) is prepared and rehearsed on disposable Postgres only, and not merged, because `prebuild` (`check-release-database.cjs --vercel-production-build`) blocks a production deploy whose schema is ahead of the database.
- To unblock: the owner approves the workflow run in GitHub (Actions → Database migrations → Review deployments).

### 06:25 Supabase performance advisor: no real gap

- The 4 "unindexed foreign key" findings are covered by existing composite indexes whose leading columns are the FK's columns in a different order. Postgres uses them for the FK equality lookups. No migration.
- 70 "unused index" findings: expected before launch (little traffic). Not dropping any: removing indexes is not additive and could hurt at launch load.
- Auth uses a fixed 10 connections: noted for the owner, a dashboard setting, not code.

### 06:30 Migration rehearsal on disposable Postgres 16

- Fresh local Postgres 16 with the Supabase roles the repo's own harnesses create (`anon`, `authenticated`, `outclass_production_app`, `auth.sessions`): all 101 migrations on main apply cleanly, in order.
- PR #532's `20261123120000_short_answer_question` then applies cleanly on top: adds enum value `SHORT_ANSWER`, nullable `ApplicationQuestion.characterLimit`, and the 1–500 CHECK. Additive, no data rewritten.
- Production ledger (read-only query): 101 applied, 0 unfinished, latest `20261118140000_native_push_platform_required`, matching main.
- #532 stays unmerged: its new column would make `prebuild` block the production deploy until the migration runs, and running it needs the owner's approval in GitHub.

## 06:30 Review findings and fixes in flight

- **PR #545** (self-decision and recusal guard). Red dispatch on test-only commit 7dc88b38. First PR run failed `Native PostgreSQL / transactions` test 12: the new pre-read changed the cross-club refusal text from "Application changed or is not available…" to "Application unavailable.". Fixed in 6007eb04 by keeping the original wording. Re-running.
- **PR #546** (recusal guard on review reads). Red dispatch on 3087354. CI running.
- **PR #547** (suspended-club search). Red dispatch on test-only 8300fd33. CI running.
- Preview deployments log `DATABASE_URL` errors at runtime. Expected: previews are kept off the staging DB on purpose. Not a bug.

## Found, not fixed

- **M1, cross-school application.** `actions/applications.ts` `persistApplication` does not compare `club.schoolId` with the viewer's school. Repro: as a UVA student, `POST /api/mobile/v1/applications.submit` with a club id from another school. Impact today is nil: one school, and sign-in is UVA email only. The fix needs `@/utils/school-scope` mocked in five test fixtures (action-results, autosave-actions, club-suspension, student-applications, graduation); deferred behind higher-impact work.
- **M3, check-in has no school check.** `actions/meetings.ts:195` `checkIn`. Same single-school reasoning as M1.
- **R1, peer scores in the default applicant display.** Any review member sees each reviewer's score; `tests/applicant-intelligence.test.cjs:53` asserts this, so it is current policy. Left for the owner to decide.
- **R5, `stageDecision` is last-write-wins.** Two leaders staging different decisions at once: the later silently replaces the earlier. No data loss beyond the overwritten staging.

## 06:32 Live site baseline (signed out)

- Desktop 1440×900: `/explore` redirects to `/login?next=/explore` with the sign-in form, as designed.
- Phone width 500×900 (the browser's minimum): `/uva` and the public test club `/club/aif` render cleanly; nav collapses to the menu button; no horizontal scroll.
- Signed-in journeys on production are **not** run by hand: this run never types or reads a password, and there is no unattended sign-in for a test account. Signed-in journeys are covered by the CI end-to-end suites (Applicant workflow, Local Auth/settings/navigation) on disposable Supabase.

## 06:35 Load: QR check-in burst (PR #548)

Scenario: a room of members scans the same QR code at once, through the real `checkInMeeting` on disposable PostgreSQL (security suite), 2 ms simulated round trip per statement (co-located pdx1 ↔ us-west-2). Before numbers come from the dispatch on the test-only commit b22b5990; after numbers from the PR run.

- 06:40: both the red dispatch and the first PR run stopped at the held-member test with "Promise resolution is still pending but the event loop has already resolved", so neither gave numbers and the red was not for the intended reason. Diagnosing on a debug branch (not for merge) before trusting the test.

## 06:45 PR #546 review finding

- Codex (P2): the reveal query read answers with no order, and `visibleQuestionIds` only admits a follow-up after its parent, so a visible follow-up essay could drop out of a reveal. Confirmed by reading `lib/student-applications.ts:49`. Test added on red branch `red/reveal-answer-order` (dispatched), fix bdf053b1 orders answers by question order then id, as `lib/pipeline-detail.ts` does. Thread answered and resolved.

## 06:45 App vs website gaps (read from code, not run on a device)

The app calls the same `/api/mobile/v1/*` ops, which run the website's own Server Actions after the bearer-token check; no authorization bypass found. Gaps, most likely to be hit first:

1. Push is off until the person turns it on in Inbox preferences (`mobile/src/components/inbox/preferences.tsx:43`), so students miss interview and decision alerts by default.
2. Leaders cannot open or decide on an applicant in the app; every applicant tap opens the website (`applicants.tsx:155`). There is no op for `setApplicationStatus` or `moveApplicantRound`.
3. Web hand-offs (`openOnWeb`) open a plain in-app browser without the session, so leaders likely sign in again on each one (inferred).
4. Accounts with two-step sign-in: the server answers `TWO_STEP_REQUIRED` but the app has no screen to finish it (`mobile/src/app/sign-in.tsx`); what the person then sees is inferred.
5. App club search matches locally (`mobile/src/components/explore/directory.ts`) instead of the website's Typesense search, so results can differ.
6. Leaders cannot create meetings in the app, only host and close check-in.
7. No email-code sign-in; "Forgot password" opens the website.
8. Nothing is cached between launches, so opening the app offline shows errors, not the last data.

Ops the server offers that the app never calls: `graduation.confirm`, `explore.search`, `leader.rounds`, `applications`, `invitations`, `home.taskNotifications`.

## 06:55 Check-in burst test diagnosis (PR #548)

- Debug run showed the statement hook was never called: the first member checked in straight through. Cause: `utils/prisma.ts` caches its client on `globalThis.outclassPrismaBase` outside production, so every race fixture after the first in a file reused the first fixture's client, with its latency and without the new hook. The test-side bug, not the app.
- Fix 8493a114: `tests/helpers/race-native.cjs` clears the cached client when a fixture starts and ends. Red dispatch on `red/check-in-hold` (b22b5990 + helper fix, old FOR UPDATE lock) to confirm the held-member test now fails for the intended reason.
- PR #545 red dispatch (7dc88b38) confirmed: exactly the five new self-decision and recusal tests failed.
- App hand-offs: `openOnWeb` uses `WebBrowser.openBrowserAsync` (SFSafariViewController / Custom Tabs), which keeps its own cookies, so a leader likely signs in once per device rather than on every hand-off (corrects gap 3 above; still not verified on a device).
- Two-step accounts in the app are only reachable when `OUTCLASS_USER_MFA=1`; the web challenge route is cookie and same-origin based, so an app fix needs a new bearer-token op with the same attempt limit. Not built tonight.
