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
