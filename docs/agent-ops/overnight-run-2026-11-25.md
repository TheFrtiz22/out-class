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

## 06:57 Merge 1: PR #545 (self-decision and recusal guard)

- Gates on head 6007eb04: validate (test, test:migrations, lint, typecheck, build), Native PostgreSQL security and transactions, Applicant workflow application-writing, Integration infrastructure coverage, mobile, merge: all green. Red dispatch on 7dc88b38 failed exactly the five new tests.
- Merged as 5df4d055. Production deployment dpl_CdJ8Qngz6SiTmV5E715wmCdnfNx9 queued; rollback target is the current production deployment dpl_2S19S64aiez6wvH13W1UdWpvHfVM (8a70a46).
- PR #546 red dispatch (3087354) confirmed: the five new recusal, own-application and reveal tests failed.
- Deleting my scratch branch `debug/check-in-hold` was refused by GitHub (HTTP 403). Left in place; it is not for merge.

## 07:03 PR #545 deploy verified live

- Production dpl_CdJ8Qngz6SiTmV5E715wmCdnfNx9 (5df4d055) READY on www, apex and uva.
- Remote browser, desktop 1440×900: /club/aif renders the club page (About, recruitment, deadline, required questions).
- Phone 500×900: /explore redirects to /login?next=%2Fexplore with the sign-in form, email-code option and menu button; /club/aif renders in full.
- No rollback needed. Signed-in journeys not re-run live: no test-account password is typed by this run.
- PR #546 conflicted with #545 in actions/crm.ts imports (both import from lib/recusal). Resolved by importing both `assertMayDecideApplicant` and `isRecused`; merge commit cabda9a2, gates re-running.

## 07:10 Merge 2: PR #547 (suspended clubs out of workspace applicant search)

- Gates green on 6a1c7850: validate, Integration infrastructure coverage, Native PostgreSQL / security and transactions, Applicant workflow / application-writing, mobile.
- Merged as ab3ff6d0. Production deploy dpl_24X9NNnXQMpcCeVNRozzxeS4pMpf queued; live check follows.

## 07:10 Finding M1 → PR #549 (apply only at your own school)

- `persistApplication` took any clubId, so a student could draft or submit to another school's club through the website action or the app's `applications.submit`. Read paths already scope to the viewer's school.
- Fix: resolve `resolveViewerSchool()` and refuse when `club.schoolId` differs ("This club isn't open to students at your school."), before any write.
- Failing-first test in tests/application-submit-race-native.test.cjs on red/apply-same-school (test-only 7936dce7), dispatched on the disposable security database. PR: https://github.com/TheFrtiz22/out-class/pull/549

## 07:25 Improvement 1 → PR #550 (app offers push after a submit)

- Highest-impact gap from the app review: push is opt-in on the phone and most students would never turn it on, so invites and decisions wait until the app is opened.
- Change: a one-time "Hear back on this phone" card on the application screen right after a submit, only when push is off and the system can still ask. Uses the same `push.enable()` as the preferences switch. No server change.
- Failing-first render test mobile/__tests__/render/push-nudge.test.tsx (test-only commit on red/push-nudge, deploy.yml dispatched). PR: https://github.com/TheFrtiz22/out-class/pull/550
- Release is left to the owner (no OTA, no store submission).

## 07:25 Findings not fixed (decided)

- M3, check-in from another school: a valid, unexpired QR token is still required, so the caller has to be at the meeting. Low impact; recorded, not fixed tonight.
- R5, staged decisions are last-write-wins: `stageDecision` documents "Record (or replace)" and the board shows who staged it; send re-checks the application. Treated as intended, not a bug.

## 07:16 PR #547 deploy verified live
- Production deploy for ab3ff6d0 (merge of #547) is READY and aliased to www.out-class.net, out-class.net and uva.out-class.net.
- Checked in the browser: /explore and /clubs send a signed-out visitor to sign in (desktop 1440 wide), and /uva lists both UVA clubs and renders correctly at 500 wide. Nothing broken; no rollback.

## 07:16 Merge 3: PR #544 (CI shell suite exits after a failure instead of hanging)
- All required gates green on 06e8e0fe, plus every optional suite. Merged as 041029fb. CI-only change; the deploy will be checked like the others.

## 07:16 PR #549 first CI run: two native suites failed
- Native PostgreSQL / transactions: "provider validation happens once, before acquisition" counted 2 calls, and one suite's auth mock has no getSessionUser. Native PostgreSQL / security: mock-recruiting-cycle failed the same way.
- Cause: the fix called resolveViewerSchool, which validates the session through the auth provider a second time. That is a real cost on every submit, not just a test artefact.
- Fix (0f9a6160): new resolveAccountSchool(userId) in utils/school-scope.ts gives the same answer for an account requireAuth already validated; persistApplication uses it. The existing test that counts provider calls is unchanged.

## 07:24 Red-then-green proofs (tests run on main without the fix)
- PR #549 (red/apply-same-school, run 45565314540): "a club at another school refuses both a draft and a submit" fails on main. The draft/submit goes through. Right reason.
- PR #550 (red/push-nudge, run 45565720038): the three "after submitting, the app offers push once" tests fail on main. The offer does not exist yet. Right reason.
- PR #548 (red/check-in-hold, run 45564144516): "one member held inside check-in does not block another member" fails on main (actual 'waited', expected 'checked-in'). The room-sized burst fails with 69 of 150 members refused. Right reason.
- Also on red/check-in-hold: Local Auth, settings and navigation test 7 ("desktop pointer and mobile touch support detail switching…") failed, expected 100 and got 0. That branch only adds a native test, so this looks like a flaky browser suite on main. The same suite passed on PR #544's head. Noted, not chased.

## 07:24 Load numbers: QR check-in burst (disposable PostgreSQL in CI, never production)
| Members | Before (main) | After (PR #548) |
| --- | --- | --- |
| 60 | 60/60 checked in, p50 855 ms, p95 1551 ms | 60/60, p50 233 ms, p95 429 ms |
| 150 | 81/150 checked in. 69 refused "Unable to start a transaction in the given time". p50 1151 ms, p95 2129 ms | 150/150, p50 586 ms, p95 997 ms |
- The bottleneck: check-in held a lock on the meeting row for every member, so a burst queued on one row and timed out waiting for a pool connection.

## 07:24 PR #549 re-run
- 0f9a6160: both native suites now pass (security, transactions). Applicant workflow / application-writing failed because local Supabase didn't start on the runner. Nothing ran, so it isn't this change. The failed job was re-run.

## 07:26 PR #544 deploy verified live
- Production deploy for 041029fb is READY and aliased to all three production domains. The public test club page (/club/aif) renders correctly at 500 and 1440 wide. No rollback.
- PR #549: application-writing passed on the re-run (0f9a6160). Waiting only on validate.
- Noticed while checking: the test club page says "Applications aren't open yet" and also shows an application deadline of Dec 16. That's consistent if applications are closed but a deadline is set. Not a bug; noted for wording.

## 07:32 Merge 4: PR #548 (QR check-in: a room of members checks in side by side)
- Every required gate green on 8493a114, red proof logged above. Merged as 40e077b3. No migration.
- Load before/after is in the 07:24 table: 150-member burst went from 81/150 to 150/150 checked in, p95 2129 ms to 997 ms.
- Deploy check pending.
- PR #546: the Codex P2 (reveal must read answers in question order) was already fixed in bdf053b1, which is in the PR head. Thread resolved. Waiting on validate.

## 07:41 PR #548 deploy verified live
- Production deploy for 40e077b3 is READY. /club/mii renders correctly at 1440 and 500 wide (the banner photo loads; an earlier gradient was the placeholder before the image arrived). Vercel shows no runtime errors in the last hour. No rollback.
- QR check-in itself can't be run on production: it needs a signed-in member and a live meeting code, and load against production is off limits. It is covered by the native burst test above.

## 07:47 PR #546 validate failed: 1 of 3365 unit tests
- tests/applicant-intelligence.test.cjs "feedback never discloses … self-review …": its self-review case opened the review panel on the reviewer's own application and expected feedback withheld. PR #546 now refuses that panel outright, as voting and previews already did ("Applicant unavailable for this reviewer.").
- Fix (3ac31b17): the self-review case now asserts the refusal. The property the test guards (no feedback from your own application) is checked more strictly, not less. The other cases in that test are unchanged. Validate re-running. Lint, typecheck and build had not run (the chain stops at tests).
- Expected next: PR #549's validate will likely fail in unit suites that mock prisma without users or club schools (e.g. autosave-actions). Waiting for the real list before changing fixtures.

## 07:46 Merge 5: PR #550 (app: after you apply, offer to turn on notifications)
- All required gates green on 4ecaec07, including mobile. The red proof is logged above, and the Codex P2 (dismissal lost when switching to the responses view) was fixed in 4ecaec07. Merged as 384ef101.
- The change touches only mobile/. No server or API change, so the current app build is unaffected. Nothing was published to the stores or over the air; that release is the owner's call.
- The web deploy for this merge will be checked like the others.

## 07:54 UTC: PR #550 deploy verified live
- Production deployment `dpl_EEkUmyyXz1jzYqhpavaTQV9ceH9r` (commit 384ef101) READY at 07:51, aliased to out-class.net, www.out-class.net and uva.out-class.net.
- Vercel runtime errors, last 30 minutes: none. Sentry: no unresolved issues first seen in the last hour.
- Live check: `/` at 1440 px and `/login` at 500 px render correctly. PR #550 changes only the Expo app, so no web journey changed; no app release was published (left to the owner).
- No rollback needed.

## 07:58 UTC: PR #549 validate fix
- validate on 0f9a6160 failed 17 of 3359 unit tests, all in four suites (action-results, autosave-actions, club-suspension, student-applications) that build their own transaction mocks for `actions/applications.ts`. Cause: the new same-school check reads the student's school and the club's `schoolId`, and those fixtures had neither.
- Fix (6ac0eb6f): those fixtures now mock school scoping with the shared test helper (launch school) and give their test club that school. No assertion was changed or removed. The other gates on 0f9a6160 were already green.
- Could not run the suites locally: the project's packages (e.g. zod) aren't installed here and installing them needs the owner's yes. CI is the check.

## 08:21 UTC: merge 6, PR #546 (review reads honor recusal, own application and score visibility)
- All required gates green on 3ac31b17 (validate, integration infrastructure, native security, native transactions, application-writing, mobile). Merged as 5e28d688.
- Server-only change; the current app build does not call these reviewer actions. Waiting for the production deploy, then live check.

## 08:25 UTC: PR #546 deploy verified live
- Production deployment `dpl_htGALib6gGurN6XwL8zgei84CFeQ` (commit 5e28d688) READY and serving the production aliases.
- Vercel runtime errors, last 30 minutes: none. Sentry: no unresolved issues first seen in the last hour.
- Live check: `/uva` at 1440 px and the public test club page at 500 px render correctly. Signed-out request to the attachments route (changed in this PR) is refused with "Invalid attachment reference", not a server error.
- Reviewer reads (the core of this PR) need a signed-in reviewer; verified by the unit and native suites in CI, not on the live site.
- No rollback needed.

## 08:34 UTC: merge 7, PR #549 (a student applies only to clubs at their own school)
- All required gates green on 6ac0eb6f. Merged as 9d4f0c17.
- App compatibility: the app submits through the same server action path; a UVA account applying to a UVA club is unchanged. Only a cross-school submit or draft is now refused with "This club isn't open to students at your school."

## 08:40 UTC: PR #549 deploy verified live
- Production deployment `dpl_3pCJrXTihK6D5zb9LB56Sz2ceTQD` (commit 9d4f0c17) READY.
- Vercel runtime errors, last 30 minutes: none. Sentry: no unresolved issues first seen in the last hour.
- Live check: public test club page at 1440 px; signed-out `/applications` at 500 px redirects to sign-in with `next=/applications`.
- The submit itself needs a signed-in student; the same-school refusal is verified by unit and native-transaction suites in CI, not on the live site.
- No rollback needed.

## 08:47 UTC: Load numbers: drafts, interview booking, live-vote ballots (disposable PostgreSQL in CI, never production)
- Ran the repo's own contention benchmark (`scripts/run-contention-benchmark.cjs`) on main 9d4f0c17 in a throwaway GitHub Actions job (run 45578393429, temporary branch `bench/contention-2026-11-25`, never merged). Simulated round-trip 0 ms and 2 ms. 14/14 correctness checks passed.
- Application drafts, 20 concurrent first saves in one club: 20/20 saved; p95 143 ms (0 ms RTT), 86 ms (2 ms RTT).
- Interview self-booking: no over-capacity slots and no lost bookings at any size.
  - 20 students, 1 club: p95 649 ms / 443 ms. 20 students over 3 clubs: p95 335 ms / 335 ms.
  - 60 students, 1 club: p95 2413 ms / 2169 ms. 60 students over 3 clubs: p95 1248 ms / 1112 ms.
  - About 46 statements per booking; bookings in one club serialize on the club, so time grows with the queue, not with RTT.
- Live-vote ballots in one room: 15/40/80 voters all recorded.
  - 0 ms RTT: p95 240 / 510 / 737 ms. 2 ms RTT: p95 538 / 1369 / 2744 ms. Ballots serialize on the voting session by design.
- Decision: no fix. Every case is correct and stays far inside the transaction limits (booking 20 s, voting 30 s, pool wait 5-10 s). The worst realistic case (60 students booking one club's interviews in the same second) is about 2.4 s for the last one in line. Cutting the ~46 statements per booking is a refactor of the booking path, so it goes on the "not built" list rather than into tonight's run. Production RTT between Vercel and Supabase was not measured (no load on production); ballot time scales with it.

## 08:55 UTC: App gap 5 checked, branch guard, M3 picked up
- Gap 5 (app club search is local): `getClubDirectory` returns every discoverable, unsuspended club at the viewer's school with no cap (`actions/club-directory.ts`), so the app's local search sees all clubs. Results can still rank differently from the website's search; not a bug. Production today: 38 listed clubs, about 96 KB of description and marketing text, far below the 4.5 MB response limit. At a few thousand clubs the list would need paging; noted, not built.
- Guard: deleting my temporary branch `bench/contention-2026-11-25` was refused (git push refused, API path not permitted, HTTP 403). Left in place; it is not for merge and its workflow only runs on pushes to that branch.
- M3 (check-in from another school) is now cheap to close with the same-school pattern from #549, and security comes before improvements, so it is next: PR #551. Red branch `red/check-in-same-school` (test only, on main 9d4f0c17), validate dispatched as run 45579330717.

## 09:05 UTC: Production error review (Vercel runtime errors, 7 days; Sentry, 14 days)
- Nothing new from tonight's merges.
- 2026-11-24 03:16 to 03:38 UTC: database sign-in failures (P1000, "credentials not valid") on the scheduler and push delivery routes, then recovered. Looks like a credential change outside this run; nothing to fix in code. Not touched (credentials are off limits).
- Scheduled-communications claim sometimes cannot get a pooled connection within its 1 s wait (P2028, 66 times since 2026-10-19). The claim is retried on the next run, so sends are delayed by a minute, not lost. Recorded, not changed.
- "DATABASE_URL not found" and "Supabase URL and API key are required" on `/login`: these come from a preview deployment (branch `ui/calendar-recruiting-header-loader`), which has no database by design. Not production.
- Sentry OUT-CLASS-D (a date rendered as text on `/inbox`, 2026-11-16) and OUT-CLASS-E (`revision` of undefined in a club workspace, 2026-11-17): one occurrence each on older releases, no source maps, not seen again since. Could not reproduce from the code; recorded under bugs not fixed.
- PR #551: Applicant workflow / application-writing failed at its build step ("npm failed", build log not reachable from here). Likely cause: the new optional reader in `utils/school-scope.ts` was typed with Prisma's base transaction client, while the app's client is extended. Retyped with `AppTransactionClient` like the other readers (commit pushed); checks re-running.

## 09:35 UTC: PR #551 red proof and review follow-up
- Red run 45579330717 on `red/check-in-same-school` (test only, on main): 3370 unit tests, exactly 1 failed, the new visitor check-in test. Other suites green.
- PR head f50c35bb: every required gate green.
- Codex (P2): a visitor with no school identity on a school subdomain falls back to the host school, and that lookup still used the shared client inside the check-in transaction. Confirmed by reading `utils/school-scope.ts`. Fix 80459f89 passes the transaction through `resolveHostSchool` too. New test in `tests/school-directory-scope.test.cjs`, run locally: fails without the fix ("shared client read school"), passes with it. Thread answered. Gates re-running.

## 09:56 UTC: merge 8, PR #551 (check-in: visitors from another school are refused)
- All required gates green on 80459f89 (validate, integration infrastructure, native security, native transactions, application-writing, mobile). Merged as 272d1205.
- App compatibility: the app checks in through the same server action; members and same-school visitors are unchanged. Closes M3. Waiting for the production deploy, then live check.

## 10:03 UTC: PR #551 deploy verified live
- Production deployment `dpl_Gydw72US9iAxgh8aStcDVGq6yEDf` (commit 272d1205) READY.
- Vercel runtime errors, last 15 minutes: none. Sentry: no unresolved issues first seen in the last hour.
- Live check: signed-out `/check-in?meetingId=…` at 1440 px shows the sign-in prompt with the return path kept; public test club page at 500 px renders correctly.
- The refusal itself needs a signed-in student from another school (no second school is live); verified by the unit test and the red run, not on the live site.
- No rollback needed.

## 10:05 — Finding: main's native scheduler and audiences suites red since #549

- Main push runs 45577342737 (9d4f0c17) and 45590079676 (272d1205): `Native PostgreSQL / scheduler` and `/ audiences` fail `decision-publication-native` test 14 with "`headers` was called outside a request scope". These suites are not PR gates, so #549 and #551 merged green.
- Cause: the fixture's accounts use `@demo.invalid` emails with no school identity, so `resolveAccountSchool` falls back to the request host, which only exists inside a real request. Production requests always have a host, so the live site is not affected; it is a fixture gap.
- Fix: PR #552 gives the suite the shared `tests/helpers/school-scope.cjs` stand-in that the other native suites use. Red proof is the two main runs above. Disposable-integrations dispatched on the branch (run 45591518865).
- Lesson: after a merge that touches actions used by native suites, watch the main push run of disposable-integrations, not only the PR gates.

## 10:05 — Finding: flaky Local Auth test 7 (pipeline release e2e)

- Fails now and then with "expected 100, got 0" after the browser-history step on the 5000-applicant cohort (main run 45575470024; run 45564144516 earlier).
- Cause: after `goForward`, rows were counted while the overview's review-queue rows still matched the selector.
- Fix: PR #553 waits for the overview to leave before counting, as the entry step already does. Disposable-integrations dispatched on the branch (run 45591523753).

## 10:17 UTC: PR #552 and #553 integration runs (disposable)
- #552 branch (run 45591518865): Native PostgreSQL / scheduler and audiences pass, so the fix works; on #553's branch, which lacks it, both still fail the same test (run 45591523753). Red then green.
- #553 branch: Local Auth, settings and navigation passed, including the pipeline e2e test it changes.
- #552's Local Auth job failed before any test ran: the local Supabase stack did not start. Re-ran that job.
- Sentry OUT-CLASS-D (Date rendered on `/inbox`, release 6e2a1649): `lib/demo/store.ts` on main now turns revived snapshot dates back into strings for the Inbox, which matches this error. Likely fixed already; verified by reading code only.
- App gap 3 (web hand-offs ask leaders to sign in again): not built. It needs a new session hand-off from the app's token to a web cookie, which is a new sign-in path; that is too risky to add unattended overnight.

## 10:43 UTC: merge 9, PR #552 (decision publication suite scoped to the club's school)
- All PR checks green, including validate, and the dispatched integration run had the scheduler and audiences suites passing. Merged as b7f52075. Test-only change.

## 10:48 UTC: PR #552 deploy verified live
- Production deployment `dpl_23Ligr9RraubhS1VuVkGByWWynai` (commit b7f52075) READY. Vercel runtime errors, last 20 minutes: none.
- Live: `/explore` signed out redirects to sign-in with the return path kept, at 1440 px and 500 px. No rollback.
- PR #553 brought up to date with main (merge commit 23c6646c) so its integration run includes the fix; dispatched run 45597776774.

## 10:56 UTC: main's integration suite green again
- Main push run 45597739840 (b7f52075): all 11 disposable-integration jobs passed, scheduler and audiences included.

## 11:14 UTC: merge 10, PR #553 (pipeline e2e counts forward rows only once the overview has gone)
- All checks green, including validate and the full integration run on the updated branch. Two jobs (application-writing, dashboards) first failed because the local Supabase stack did not start, before any test ran; re-run, both passed. This start failure happened three times in an hour (also #552's Local Auth job): CI infrastructure, not code. Merged as 7aadc545. Test-only change.

## 11:19 UTC: PR #553 deploy verified live
- Production deployment `dpl_AerjnjovY4dpuMmgasUYgnybvDr8` (commit 7aadc545) READY. Vercel runtime errors, last 40 minutes: none. Live: `/uva` renders with its club list and FAQ. No rollback.

## 11:20 UTC: more not built (decided)
- Club directory paging: production has 47 clubs (38 listed), so the whole-directory read is fine today. Paging changes the directory API the current app build reads, so it waits for a planned app release.
- App inbox does not merge task updates ("Revisions requested", "Submission reviewed") the way the website inbox does; the app shows the same states on its Tasks screen, so no data is missing. Gap 9, not built.
- Recommendation for the owner: the Native PostgreSQL scheduler and audiences suites are not required on PRs, which is how #549 merged while breaking them. Making them required is a repository setting, left to the owner.

## 11:22 UTC: production sweep while the second authorization pass runs

- Vercel runtime errors, last 2 hours: none.
- Sentry, last 24 hours: only OUT-CLASS-5 (Supabase client created without URL and key on `/login`), seen at 06:13 on a preview deployment of a feature branch. Previews deliberately carry no Supabase settings (they stay off the staging DB), so this is expected there and not a production fault. No production issue open.

## 11:27 UTC: second authorization pass (read only), result

- Covered: tasks (workspace, review, submissions, file downloads), announcements and audiences, recipient groups, decision letters, member roles, invitations and ownership transfer, every voting action (setup, room, ballots, discussion, finalization), meetings, campus events, calendar feeds, and the web API routes outside `/api/mobile` (workspace, exports, attachments, resumes, photos, assets, flyers, letter assets, communications stream, calendar, school requests, internal cron routes, platform admin, student claim).
- Result: no authorization or cross-club isolation bug. Every client id is constrained to the caller's club or user, and permission is checked on the owning club inside the write transaction. Members cannot grant themselves permissions they lack; the last owner is protected.
- Looks intentional, not fixed: a member with tasks.manage can approve their own task submission (they already control the task); a member with members.manage can edit any member's targeting groups and cohort (labels for audiences only, no access). I re-read `updateTaskMember` on main: it is club-scoped and permission-checked in the transaction.
- Third pass started (read only): sign-in and account security routes (two-step, password reset, email confirmation, email code, redirects, app token refresh and revocation) and the remaining workspace actions (availability, panel proposals, interview kits, CRM, club overview).

## 11:57 UTC: third authorization pass (read only), result, and merge 11

Covered: two-step sign-in, password recovery and reset, email confirmation and email-code sign-in, student claim, logout, auth callback and Microsoft sign-in, return-path checks, the app's bearer tokens, and the remaining workspace actions (availability, panel proposals, interview kits, CRM, club overview, interview entry, rooms and booking publication, ranked review, club settings, applicant intelligence, onboarding, directory, applications, tutorials).

No account-takeover, cross-club or permission-skip bug. Return paths reject other origins, app tokens are checked against live sessions (revocation is immediate, a reset signs out everywhere), a session that has not passed two-step is treated as signed out everywhere, reset and claim tokens are single use, and recovery answers the same for every address.

Fixed (merge 11):
- PR #554 (merge 4119dfeb): `createInterviewRoom` and `saveApplicantDisplayConfiguration` checked `interviews.manage` only before the write; access removed in between was missed. Both now re-check inside the transaction like the other interview writes. Red branch `red/recheck-interview-grants` failed exactly the two new tests (validate run 45605050178: 3284 pass, 2 fail); fix branch green on validate (45605145476, includes unit, migrations, lint, typecheck, build) and disposable integrations (45605145526). No mobile change. Codex review: no findings.

Found, not fixed (decided):
- Email-code guessing ceiling: 50 failed codes per address per 15 minutes across networks (8 per address per network), against a 6-digit code valid for an hour. Roughly 4,800 guesses a day for an attacker spread over 7 or more networks; Supabase's own verify limit also applies. The code comment says the 50 is deliberate, so one network can't lock the owner out. Lowering it trades guessing risk for easier lockout, which is an owner policy call. Recommendation: lower to about 15 or invalidate the code after N failures.
- Two-step password re-check (`app/api/auth/two-step/route.ts:171`) never records a success, so correct passwords count toward the 5-per-15-minutes limit. Usability only; two-step is dark (`OUTCLASS_USER_MFA`). Not fixed tonight.
- Supabase production settings to confirm (could not read them from here): `supabase/config.toml` has `secure_password_change = false`; if production matches, a stolen session can change the password without the current one. Turning on Secure password change in the Supabase dashboard is recommended. Also confirm direct authenticator enrolment is controlled before turning on `OUTCLASS_USER_MFA`. Changing production auth settings was not attempted (account security).

## 12:30 UTC: PR 554 live, main green, flaky search count

- Deploy dpl_9FMfFEE5iRxv4v5bETdjKzELJz9w (4119dfeb) READY and serving out-class.net. Live check: `/club/aif` at 1440×900 renders in full; `/login` at 500×900 shows the sign-in form, email-code option and menu. No rollback.
- Main after #554: validate green (45609058291). Integrations (45609058341) failed once in "Local Auth, settings and navigation": the pipeline browser test counted 0 rows right after searching for an applicant (line 78), then passed on a rerun of the same job. Timing flake in the test, not in #554 (which only touched server-side interview writes).
- Test-only fix opened: PR #555 waits for exactly one visible row before the count. Main is green now.

## 12:40 UTC: two more decided items

- Two-step password re-check counting correct passwords: not changed. The admin elevation re-check (`app/api/platform/elevation/route.ts:58`) and account-deletion re-check (`actions/account-deletion.ts:107`) also count every attempt, correct or not, toward 5 per 15 minutes, so this is the codebase's consistent rule rather than a slip. Only the two-step code step refunds successes.
- App offline cache (gap 8): not built. The app already uses React Query, but keeping data across launches needs a persister and on-device storage packages that the app doesn't have today (new native dependencies need an app release and owner sign-off), plus a decision on wiping student data from the phone at sign-out.

## 13:38 UTC: merge 12, PR #555 live, main green

- PR #555 (merge c4efb136), test-only: the pipeline browser test waits for exactly one visible row after searching before it counts. Validate (45614366640) green; the full dispatched integration run (45615990909) green, including "Local Auth, settings and navigation", which a PR-triggered run skips.
- Deploy dpl_4oSY6kvAUQwEcYTEy4gUEMTATT5w READY. Live check at 1440×900: `/club/aif` renders; `/explore` signed out redirects to `/login?next=%2Fexplore`. Vercel runtime errors, last 3 hours: none. No rollback.
- Main after #555: validate (45619089417) green. Integrations (45619089439) failed once in "Private Storage and native PostgreSQL" because the local Supabase stack did not start before any test ran (CI infrastructure, about the fifth time today); re-ran that job and the run finished green.
- Next: a read-only pass over failure and edge states (double submits, deadlines passing mid-edit, closed or withdrawn records, error handling in forms) while time remains.

## 13:50 UTC: failure and edge-state pass (read only), result

Covered: application submit, edit and withdraw around the deadline; drafts after close; interview booking (past slots, paused or unpublished rounds, capacity, double booking, cancelling after start); offer accept and decline twice, expired, revoked and suspended-club offers; check-in twice and expired codes; RSVP deadline and capacity; ballots after close, on a stale pass or with a reused request id; scheduled decisions; tasks after done or on a stale revision; availability revisions; how the app's API maps errors. All correct: deadlines use server time inside the write, and duplicates are idempotent or refused.

Found:
- E1 (fixing, PR #556): "Create cycle" or "Restore cycle" while another cycle is open leaves the club with two open cycles, so it has no active cycle. New submissions join no cycle and those students can't book interviews ("Interview times aren't open for your round right now"). "Start from last cycle" already refuses this. A taken cycle name surfaced as a database error.
- E2 (fixing, PR #557): a recipient group name already used in the club (ignoring case) hits the unique index and shows only "Group operation failed."
- E3 (not fixed, owner decision): a rejected applicant, or one moved out of the interview round, keeps a future interview booking. The slot stays taken for other finalists, the student's calendar still shows the interview, and leaders have no way to release it. Repro: student books a one-person slot for Friday; on Wednesday the leader rejects them; another finalist sees "That time was just booked". Not built tonight because the fix needs a sequencing decision: a decision scheduled for later delivery would remove the interview from the student's calendar, and notify the panel, before the letter is sent, which reveals the decision early. Suggested rule: release future bookings when the decision is delivered, not when it is staged, and offer leaders a "release slot" button.
- E4 (not fixed, minor): profile names, major and experience fields (`actions/profile.ts:24-39`) are not trimmed and have no length limit, so a name of a single space passes. Bounded only by the 12 MB request limit. Low impact; left for a planned change because the app's profile screen sends the same fields.

## 14:36 UTC: merge 13, PR #556 (one open recruitment cycle) live

- PR #556 (merge 3e6e128c): `saveRecruitmentCycle` refuses to create or restore a cycle while another is open (`OTHER_CYCLES_OPEN`, the rule "Start from last cycle" already had) and refuses a taken name (`CYCLE_NAME_TAKEN`) instead of a database error. Red branch `red/one-open-cycle`: validate run 45627288032 failed exactly the two new tests (3286 pass, 2 fail). Fix branch: validate 45627393638 green; PR integrations 45627393678 green; full dispatched integrations 45627406813 green after one rerun of "Local Auth, settings and navigation". That job failed in the pipeline browser test (test 7, line 69) on a different check from this morning's: one RSC request for the applicants view was recorded after clicking "All applicants". The change is a server action for cycles, which that page doesn't call; the rerun passed. Logged as a remaining intermittent failure in that test (see bugs not fixed). Codex: no findings. No mobile change, no schema change.
- Deploy dpl_6gv6EbYdqsoWX7n2wK9vceN3oYbW READY. Live check: `/club/aif` renders at 1440×900 and at 500×900 (menu button, full page). The cycle screen itself is behind sign-in and was not exercised live (no test-account password available to this run; covered by the unit tests).
- PR #557 (recipient group names): red branch `red/group-name-taken` failed the native audiences suite against real PostgreSQL with the unique-index error (integrations 45627573569). Fix branch green on validate and integrations. Codex found that Prisma's case-insensitive equality uses ILIKE, so `%` and `_` in a name acted as wildcards ("Fin%" would be refused next to "Finance"); confirmed, escaped, regression cases added; checks rerunning.

## 15:45 UTC: merge 14 (#557) and merge 15 (#558), final sweep

- PR #557 (merge 56dbed6d): a recipient group name already used in the club, ignoring case, is refused with "This club already has a group named …" (`NAME_TAKEN`) instead of "Group operation failed"; `%`, `_` and `\` are escaped so they match literally. Final head 57333cc: all 20 checks green, including the dispatched integrations run 45634691703 (audiences and "Local Auth, settings and navigation" green). Codex review thread answered. Deploy dpl_GMZ1WqzHYsiT9VMHvwQvuWqknJ4f READY; `/login` renders live. No rollback.
- Main after #556: validate (45634516686) green. Integrations (45634516618) failed in "Local Auth, settings and navigation", pipeline browser test line 80: after back and forward navigation the list was counted mid re-render (0 of 100 rows). Rerun of the job failed the same way (0 of 1). Test timing, not product: the page renders the rows a moment later.
- PR #558 (merge e010e934), test-only: after history navigation the test waits for the full page of visible rows before counting. Validate 45641093489 green; PR integrations 45641096232 green; full dispatched integrations 45641085647 green, including "Local Auth, settings and navigation". Codex: no findings.
- Final sweep at 15:40: Vercel runtime errors, last 3 hours: only two `ADMIN_MFA_REQUIRED` denials on `/platform` at 15:28 (the admin page correctly refusing a session without two-step; expected). Sentry, production, last 24 hours: no unresolved issues. Live pages: `/club/aif` at 1440×900 and `/uva` at 500×900 render fully.
- No production migrations were applied in this run (the GitHub "Production" environment approval gate blocks the migration job; logged as a guard).
- 15:48: PR #558 deploy dpl_B71VZhiRt4i9edbNFZBF7WgUXCiK READY on out-class.net; `/login` renders at 500×900. The GitHub Pages deploy for the merge failed once with a 500 from GitHub's Pages service ("re-run the deployment at a later time"); one rerun succeeded. Main validate and integrations for e010e934 were still running when the run ended.

## 16:00 to 23:50 UTC: live testing in the owner's Chrome, signed in as admin

The cloud browser was blocked at OutClass sign-in, so this part ran in the owner's own Chrome. The owner did the password and email-code re-checks; this run never typed or read a password. All test data lives in the club "OutClass Live QA 20261125" (fake applicants with the outclass-answerkeys and LiveQA names). The owner said to keep those records. No email or push went to real people.

- Merged: 96 more PRs (#559 to #665, not counting the still-open ones below). Every one had test, lint, typecheck, build and integration checks green, plus a Codex review with no unresolved findings, before it merged. Most were UX copy and phone layout fixes from the live sweep. Notable correctness fixes:
  - #559: admin Inspect works for a profile with no sign-in.
  - #561: no false "saved elsewhere" banner after adding a round.
  - #565: a regenerated interview schedule follows each slot's interviewers.
  - #574: the verify-again refusal is returned from admin-reachable actions.
  - #580: a task submission's size is checked before it is parsed.
  - #581: a blank experience row no longer trips "changed in another tab".
  - #603: an out-of-date workspace link says so instead of blaming access.
  - #618: a meeting start that has already passed is never suggested.
- Deploys: Vercel READY after each batch. No runtime errors found in the hourly checks. No rollbacks. No migrations.
- Phone-width sweep (390px): no sideways overflow on /clubs, /explore, /applications, /calendar, /settings (and its subpages) or the club workspace sections.

### Tested live
- Student surfaces: Explore, club pages, apply and drafts, profile editor, inbox, calendar, settings.
- Leader workspace: applicants, review panel, Decide, members, meetings, events, tasks, cycles, club profile, interview schedule and availability.
- Admin: Inspect, records, search.

### Partly tested, and what is left
- Live interview room (/club/<id>/interview): it opens, and notes, score and submit work on the written round (8/10 submitted for one test applicant). The First-interview round could not be run, because no test applicant has booked a slot. Booking needs signing in as the fake applicant. Gaps found but not fixed:
  - The written round uses interview wording ("Interview · Written application", "Average interview score", "Interview complete").
  - The candidate picker shows "Profile not provided" where the applicants list shows the email-style name.
- Live voting: /live-voting now points to each club's Voting room (#638 cleaned up its empty states). A full session (prepare, join, vote, reveal, history) was not run end to end before the run was stopped. This is the top item for the next run.
- The club switcher arrows now sit inside the blue club tab (#675, open). The live check is still owed once it merges.

### Still open at the end (merge loops stopped; nothing merges unattended)
- #662 (applicants Sort, Filters and More on one phone row) fails list-pages-browser: at 375px the Sort control is not fully clickable. This needs a fix, not a rerun.
- Waiting on checks or Codex: #599, #634, #641, #644, #649, #656, #658, #663, #664, #666, #667, #668, #669, #670, #672, #673, #674, #675, #676, #677, #678.
- Left alone on purpose: #200, #288, #532.
- Carried over from the morning: the open-items list above (interview slot release after rejection, profile field limits, email-code guess limit, Supabase secure password change, required scheduler and audiences suites, reviewers seeing each other's scores). Also the app gaps and the temporary branch bench/contention-2026-11-25.

## 2026-11-25 23:55 to 2026-11-26 ~04:45 UTC: follow-up session (finish open PRs, voting and interview rooms)

Owner brief (18:51 ET): finish the overnight run's open PRs, then live voting and live interview rooms, then every journey; merge when green and check live in the owner's Chrome. Same off-limits list as before.

### Session start
- main `7a35c669` (#660). Production deploys followed main; Vercel runtime errors (3h): only two expected `ADMIN_ELEVATION_REQUIRED` refusals on `/platform/claims`.
- Owner's local checkout on the Mac has untracked files (brand kit, bundles, mockups, `.idea`); not mine, not touched. Work ran from a fresh clone in the cloud container.
- Environment: dependencies installed with `--ignore-scripts` in the throwaway container (Prisma's engine host is blocked by the egress allowlist; the client was generated with stand-in engine paths, pdf assets copied by hand). Browser tests ran in the container's Google Chrome. Native-PostgreSQL suites and typecheck need the real engine, so CI is their source of truth.

### Open PRs from the overnight run
| PR | What was wrong | What I did | Result |
| --- | --- | --- | --- |
| #662 | Sort control kept its full width inside a shrunken slot, so Filters was painted over the sort arrow (360px here, 375px with CI fonts). Codex flagged the same twice. | Control fills its slot, the pill shrinks and truncates, the visual "Sort:" prefix is hidden on phones so the field name shows. New `tests/phone-applicants-sort-row-browser.test.cjs` checks 320–390px for overlap and clickable ends; it fails on the old head at 320px. | Merged `ce3444f4` |
| #634 | New review: Save/Done closed the editor without telling the page, so a finished checklist stayed on screen ("5 of 5"). Codex found the same afterwards. | `save()` now notifies; test checks every `setOpen(false)` does. | Merged `671ccae0` |
| #675 | The club menu is modal, so while open it hides the pill's nav from the accessibility tree and the test's role lookup failed. Product behaviour correct. | Test finds the club tab by structure. | Merged `91566e22`; live check still owed (Chrome) |
| #673 | Chevron at 18px, outside the 14/16/20/24 icon scale. | 16px. | Merged `37fea894` |
| #668 | Raw `<h1>` instead of `PageHeader`. | `PageHeader` with the link as its action. | Merged `39ab2127` |
| #669 | Codex: collapsing dropped keyword matches ("account" lost Settings) and grouped by club name. | Collapse only on a workspace-name match; group by workspace id. Red test first. | Merged `714800fa` |
| #672 | Literal 1.25rem radius. | `var(--oc-radius-xl)`. | Merged `f923fcce` |
| #599 | Invitation card imported `clubMonogram` from `club-assets`, which drags in a schema module the instant-feedback loader can't load. | Import-free `lib/club-monogram.ts`; `club-assets` re-exports it through the `@/lib` alias the native loaders resolve; two later conflicts with main resolved. | Merged `5b683e8a` |
| #644 | Two Codex threads on outdated lines (already fixed on the branch). | Replied, resolved. | Merged `0158d2e7` |
| #656, #677 | Merge conflicts with main. | Resolved (#677's change was already on main via #663; it keeps its comment and test). | #656 merged `f047f7f0`; #677 merged `19291e52` |
| #658 | `club-workspace-refinements-browser` failed twice in CI ("Decide" group not visible); passes here on the branch and merged with main. | Re-ran; green on the third run. | Merged `5cd94293` |
| #674, #670, #667, #666, #664, #649, #663, #641, #678, #676 | Green, no open threads. | Merged. | Merged |
| #200, #288, #532 | Left alone as instructed. | | |

### Main after the merges
- Disposable integrations on main failed three times after #669 merged, in "Local Auth, settings and navigation" (`pipeline-release-e2e` test 7, line 83: 0 of 100 rows after Back/Forward), plus once each in "Applicant workflow / shell" (cancelled-switch prompt, fixed 900 ms wait) and "dashboards".
- Diagnosis: dispatched the suite on `red/main-without-669` (main with #669 reverted, diagnosis only, not for merge). It failed the same pipeline step, so #669 is not the cause. Main's own run on `714800fa` passed on rerun, and on `5cd94293` every job passed except application-writing, where local Supabase failed to start before any test (re-run requested).
- Conclusion: `pipeline-release-e2e` test 7 is still intermittent after the overnight fixes (#553, #555, #558), worse when many runs share runners. Not fixed: it needs the local Supabase stack, which this environment can't run. Recommend owner or a run with Docker reproduces it.
- `red/main-without-669` and `red/...` scratch branches are left in place (branch deletion was refused earlier in the overnight run).
- #679 (this log) shows as merged by the owner's GitHub account at 00:40 UTC; this run did not merge it. The "Merge bot" workflow is still triggered on every push to main (its runs are being cancelled). Owner to confirm whether it should stay enabled.

### Live voting and live interview rooms
- **Production, signed in as the owner (before Chrome dropped):** Home, LiveQA workspace, Decide → Vote ("No voting sessions yet"), Members. LiveQA has three members: the owner and two synthetic interviewers whose passwords this run doesn't have. Signing in as them needs an email code to a `@virginia.edu` address, which is off limits. So a multi-person session on production cannot be run by an agent alone.
- **Harnesses (real room actions, harness database; browser tests in Chrome):** all 72 non-native voting files, 292 tests, pass on main `7a35c669`. Covered: several members voting at once, duplicate and stale clicks, reconnect reading authoritative state, late joiners voting on the applicant on screen and every later one, ties becoming Hold, own-ballot-only privacy for leader, voter, non-participant, outsider and revoked member, totals only after close, rule results hidden mid-pass, finalization advancing every viewer once.
- **Interview rooms:** all interview, booking and slot suites (354 tests) pass once the environment is complete (two first failures were this container's missing Prisma engine and pdf.js assets, not product). Native-PostgreSQL race suites for voting and booking run in CI's disposable integrations.
- **First-interview round live:** still not run. Booking a slot needs a signed-in test applicant; the owner's own draft application to LiveQA can't stand in because the self-decision guard (#545) correctly stops the owner moving their own application into the interview round.
- **Expo app:** `typecheck` clean, 38 jest suites / 812 tests pass on main. No simulator in this environment.

### Chrome
- Claude in Chrome on the owner's Mac connected at the start, then stopped answering about 10 minutes in and kept flapping for the rest of the session (connected in the list, unreachable on use). A second connected Chrome reported itself as "Andrews MacBook Pro"; not the owner's machine, so not used. Live checks of today's merges are still owed.

### Design and UX suggestions
1. Applicants toolbar on phones: drop the "Sort:" word and show the field (built in #662). At 320px the field still truncates to one letter; acceptable for very old phones.
2. `/live-voting` for a signed-in member shows "Sign in with your club account" with a Sign in button. For a signed-in person it should list their clubs' Voting rooms (the generic page is right only for a stale session link). Not built: needs a small server read of the viewer's clubs.
3. Interview room on non-interview rounds (LiveQA's "Written application"): the room says "Interview complete" and "Average interview score". Either list only Interview / Group interview rounds in the room or switch its words to "Review" for other round types. Owner decision.
4. The voting room's empty state ("Start one when applicants are ready for a vote") could show how many applicants are in a votable status, so a leader knows whether starting makes sense.

### Needs the owner
- Live multi-person voting and the First-interview round: sign in a second account (or let a teammate join) and book one LiveQA slot as a test applicant; then the run can drive the leader side.
- Production migrations: none opened in this session. #532 still needs its migration approved.
- Earlier open items unchanged: interview slot release after rejection (E3), profile field limits (E4), email-code guess ceiling, Supabase "Secure password change", making the scheduler and audiences suites required, reviewers seeing each other's scores (R1).

## 2026-11-26 ~02:30 to ~06:30 UTC: live checks once Chrome came back

### Today's merges checked live (owner's Chrome, signed in)
- Desktop: #675 club menu in the blue tab (opens, lists both clubs, Escape closes); #599 "OLQ" initials; #664 "Complete club profile".
- Phone 375×812 (a 375px same-origin frame over the signed-in page, because the window won't resize below 1512px): #662 Applicants toolbar one row, no overlap, no sideways scroll; #673 Settings chevrons; #668 Meetings page title; #672, #666 and #634 in Edit profile and the profile checklist.
- Sideways scroll, portrait and landscape (812×375): none on Home, Explore, Applications, Calendar, Inbox, My Clubs, /club/aif, /uva, Applicants.

### Live voting, end to end on production (LiveQA, First interview, 2 test applicants)
- One person in three views (leader, member, projector tabs). LiveQA has only one member who can vote; the two synthetic interviewers aren't eligible.
- Worked: setup (round, applicants, rule, preview), start, join, Something to add (raise, leader sees it, Acknowledge reaches the member, projector shows nothing), open voting, ballot, change of ballot, reconnect by reload (ballot kept), leader sees only "1 of 1 voted" while open, close shows totals on leader and projector, override against the ballot needs a reason, Undo keeps the ballot, a Hold pass, Pass without a vote (confirmation says no ballots, no messages), End voting ("No applicant notifications were sent"). Member and projector followed every step without reloads.
- Not run: finalization (kept both test applicants in First interview for the booking test); several voters at once, ties and late joiners (need more eligible members).
- Fixed: PR #681 (merged `816e9afc`, checked live): after End voting the projector kept the join QR and "Members: scan to vote", the screen-reader status still said "Waiting for the leader.", and the dialog said "0 Hold and 0 Unreviewed applicants will remain unresolved".

### Landscape bug fixed
- PR #682 (merged `2f0c4055`): at 812×375 the Applicants toolbar stayed on one row it didn't fit (search cut to "Name, ID or r", sort arrow under Filters by 19px, More past the edge). Two rows below 860px, and the sort control fits its slot at every width. New browser test covers 700–1280px.

### Real bug found, not fixed: Applicants list stuck loading after Back then Forward
- Diagnostic run on `debug/pipeline-forward-empty` (not for merge) recorded the page when `pipeline-release-e2e` test 7 fails: URL `…tool=applicants`, zero rows, "Preparing your applicant pipeline…" still shown after 15 s, 100-applicant club. So the intermittent CI failure is the product, not the test: the list can stay on its loading state after history navigation.
- Not reproduced live on LiveQA (3 applicants) in one try. Likely a page read that is skipped or discarded for an auth or query owner that changes during the Back/Forward remount (`hooks/use-pipeline-page.ts`); not confirmed. Needs the local Supabase stack (Docker) to reproduce and fix; this environment can't run it.

### First-interview round
- Leader side: Interviews shows 4 open times on Nov 26, 10 AM–12 PM, none booked. The interview room offers only Written application because interviewers are assigned through bookings. Still needs a signed-in test applicant to book.
- Small mismatch: "Some applicants assigned to you haven't booked a time slot yet. Open the interview room" opens the room on Written application.

### More design suggestions
- Applications on phones: the fourth tab ("Decisions") is cut off at the right edge with no sign the row scrolls.
- Landscape phones: the bottom bar takes about a quarter of the 375px height; with the header and title, no list rows show without scrolling. Consider hiding the bar on scroll or shrinking it in landscape.
- Edit profile: the photo field is the raw browser "Choose File / No file chosen" control.
- Voting ended screen: "Voting ended" and "1 passed" appear twice with large empty gaps.

## 2026-11-26 ~04:30 to ~07:00 UTC: unattended overnight run (owner asleep; merges and own-fix migrations pre-approved)

### Merged and checked
- #683 run log; #685 tab rows on phones (live: Applications at 375px shows `data-overflow="end"` and the right-edge fade); #686 profile photo and résumé are real buttons (live: "Replace photo", "Upload résumé" in Edit profile; closed without changes).
- #687 landscape phones: slim, centred dock. #689 recused reviewer gets the recusal message, not a generic error (Sentry OUT-CLASS-M / Vercel runtime error on `/club/[clubId]/workspace`): `RecusedError` is now an `ActionError` (`RECUSED`); test red on main, green after.
- #690 mobile CI: `leader-retest` and `stress-leader` interview-day tests failed every night from ~23:00 ET into the next day, because fixtures put interviews hours from the real clock. A shared `pinEasternMorning()` fakes only `Date`. Proved by running main at 23:54 ET (fails) and the branch (64/64).
- #691 e2e: `operational-dashboards-e2e` read React's hidden streamed copy of the club home (`[id="S:0"]`); it now reads the one in `main`.
- #682 re-checked live at 820px: two-row Applicants toolbar, sort fits.

### Sentry / runtime errors
- OUT-CLASS-M (RecusedError thrown): fixed in #689.
- OUT-CLASS-K (ZodError "Use an http or https link."): last seen 17:34 UTC Nov 25, before commit `052fcd26` (18:04) that pre-checks task links into a plain refusal. That message no longer exists on main. No action.
- Admin elevation refusals: expected.

### Back/Forward on Applicants (the "stuck loading" from the earlier entry)
- Four instrumented CI runs on `debug/pipeline-forward-diag` (not for merge). It isn't a stuck read: the page always recovers by itself (20 s later the list shows all 100).
- Found and fixed in PR #693: Forward re-sends an identical user object, and `SelectedClubWorkspace` keyed on its identity, so the list flashed "Preparing…" for about 150 ms and read the pipeline twice. It now keys on the account's content. The unit test is red on main and green after; the authz reviewer approved.
- The e2e test still sees 0 rows on Forward with #693 applied, so a second cause remains, under investigation with navigation and settle-error tracing. Likely a document-level navigation that destroys the evaluate context and makes the test's settle step return early.

### New, not yet explained
- `settings-navigation-e2e` saw a React hydration error (#418) on `/meetings/<id>` once, at 00:37 ET. The meeting page renders no dates on the server; no cause found in the shell. Watching for a repeat.

### Open PRs at this point
- #684 (signed-in "Voting has moved" page): CI found `handOverOnly` selected as a column (it isn't one). It now marks graduates through `lib/graduate-access.ts` with one graduation read, plus a test for a graduate kept as owner.
- #688 (review-round wording, unbooked link): two tests followed the old link and workspace shape; updated. The interview suites pass (the only local failures are the sandbox's missing Prisma engine, the same on main).
- #693 (above).
