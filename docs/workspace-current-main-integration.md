# Current-main integration for PR #29

## Baseline and resolution

Started on `repair/workspace-reliability` at
`6b7f8808d16ce1953f7f5576dc66a98c1ff78e9c`. Fetched and integrated main
`2ceb87487b18c2e7daa17585721f2a3b0d4ba0b4` with a normal merge, preserving both
parents and all earlier feature commits. Main includes the previously inspected
interview/countdown/timezone work plus the newer public-navigation commit. No schema
or migration changed in those main commits.

The one textual conflict, `components/views/leader-dashboard/live-leader-workspace.tsx`,
was an import overlap. Retained ApplicationCycleAssignment and ScheduleDecision plus
main's slotTime, SCHEDULING_TIMEZONE and schedulingDateTime. The merged implementation
retains Eastern interview formatting, decision controls, direct scheduling, rejected
filter/reconsideration, cycle assignment, voting polling and anonymous projections.

Exactly two textually clean overlapping files were inspected:

- `actions/availability.ts`: retains main's validateAvailabilityEdit, legacy coverage
  preservation, round/account locks, revision checks, fixed Eastern overview/preferred
  week; retains this branch's shared availability publication helper and bounded,
  support-attributed transaction path. No submission-deadline check was introduced
  into decision publication or reconsideration.
- `components/availability/admin-overview.tsx`: retains main's Eastern 8 AM–9 PM grid,
  labels and time formatting plus scheduled requests/reminders and management. Shared
  communication scheduling keeps its explicit IANA timezone choice; main's fixed
  interview/availability display timezone does not reinterpret scheduled instants.

Other new main changes retain current published-slot authority, live collaboration
access and authorized session timing. Canonical notifications/preferences/outbox,
shared delivery, offer/membership commands and private assets were not replaced.
The public-navigation change is included unchanged; rendered local sign-in navigation
and its new unit coverage pass.

## Deadline diagnosis and fix

The original main deadline test was reproduced from committed main in an isolated
source directory, then on the integrated working tree before the fix:

| Revision | TZ=UTC | TZ=America/New_York |
|---|---|---|
| Unmodified main 2ceb874 | Deadline test fails (1 !== 0) | All 5 pass |
| Integrated, before fix | Same failure | All 5 pass |

Root cause: the test constructed `new Date(2026, 8, 22, 12)` in the host timezone,
while main now interprets the 11:59 event in America/New_York. On a UTC CI host the
fixture's noon is 8 AM Eastern, before the event, so retaining it is correct. This
was an incorrect test instant, not an implicit product grace period. The original
zero-events expectation remains, with an explicit Eastern noon instant. Other agenda
fixtures now specify their intended Eastern instants too; no production deadline
logic was relaxed or changed.

Added before/exact/after-millisecond coverage, UTC-authoritative startTime coverage,
March/November DST and past-history grouping. An instantaneous agenda marker remains
visible at its exact instant and becomes past one millisecond later; application
submission is already closed at the exact cutoff (`deadline > now`), with no grace.
All seven tests pass under UTC, America/New_York and Asia/Kolkata (21 checks).

A real PostgreSQL test captures a decision before closure, closes applications, proves
new submission is denied, then publishes the reviewed rejection and notification/
letter atomically. Explicit authorized reconsideration preserves submittedAt and the
original letter, and a later scheduled Waitlist creates the next immutable history.
The mixed bulk-voting waves also run with applications closed/past deadline. These
verify that intake deadlines do not veto authorized decisions for submitted applicants.
Execution still revalidates active authority, club suspension, applicant/round/voting
state and version fences. Deadline changes never authorize a new applicant submission.

## Current validation

- Standard `TZ=UTC npm run validate`: **1,086 passed, 24 gated skips, zero failures**
  (1,110 total); all 51 migrations fresh/legacy, lint, TypeScript and production build.
  Lint: zero errors and 28 existing warnings. A first run through the HTTP integration
  wrapper deliberately inherited outbound-disable and fixture Admin variables, which
  conflict with mocked unit-delivery defaults; it was not counted as a pass. Standard
  validation passed without changing application/email configuration.
- Native PostgreSQL scheduling/security: **65 passed**; includes four mixed backlog
  waves, locked clubs, expired crash lease, revoked authority, cancellation/concurrency,
  actual backend termination, complete rollback and closed-deadline publication.
- Native transaction/support/audit checks: **31 passed**; existing native recruitment/
  decision/offer checks: **26 passed**. Provider-latency, timeout/lock, ownership,
  membership, retries and permission revocation remain covered.
- Local built Next + Supabase Auth/Storage: **34 passed**: decisions/private branding 7,
  audiences 5, scheduling 5, invitation/availability 5, Admin sessions 12. Email stays
  disabled; no external provider test or real-data changes.
- Actual current-main 43→51 populated Prisma deploy/status repeated with the updated
  baseline helper, plus full fresh 51-history and populated pre-controls upgrade.
  Communications, letter snapshots, pending outbox/preferences, membership/cohort,
  availability participation and legacy Admin expiry survive. Bounded ownership,
  restrictive RLS and browser denial remain; no historical migration is rewritten.
- Prisma validate, migration-path and diff checks pass. Prisma validation used a
  non-secret loopback placeholder URL (configuration validation only).

Logs: `/tmp/outclass-main-deadline-{UTC,America-New_York}.log` (reproduction),
`/tmp/outclass-integrated-deadline-{UTC,America-New_York}.log` (pre-fix),
`/tmp/outclass-main-integration-deadline-{UTC,NY,Kolkata}.log` (fixed),
`/tmp/outclass-current-main-{validation,native,transactions,migration-upgrade,prisma,migration-path}.log`
and `/tmp/outclass-current-main-{decision,scheduling,invitation,audience,session}-http.log`.

## Rendered browser QA

Authenticated Chrome against the integrated production build and isolated local
Supabase, desktop and 390×844 mobile. Evidence: `/tmp/outclass-current-main-qa/`.

- Decision Letters toggle/editor and fictional preview/private logo render; keyboard
  focus reaches controls. Historical letter behavior and private delivery pass HTTP tests.
- Rejected Applicants search/review, retained review privacy, cycle assignment and
  permission-controlled reconsideration reason/enablement render on mobile.
- Recruitment cycle creation through the UI succeeds and retains unknown legacy
  assignments. The fixture is synthetic and remains available for review.
- A closed-deadline club displays a booking at **Nov 1, 2026, 12:00–12:30 PM Eastern**
  from persisted 17:00–17:30Z instants. Direct Send now/Schedule coexist; frozen content,
  explicit zone/DST and honest timing copy remain. Mobile scroll and keyboard focus
  reach all schedule fields and submit controls without horizontal clipping.
- Actual voting intent persists, reviewed candidates expand, and UI cancellation
  transitions SCHEDULED→CANCELLED. Student status stays **In review**; no decision
  letter, decision notification or offer is exposed early. Synthetic history is retained.
- Merged Eastern availability overview still exposes scheduled requests/reminders;
  zero eligible recipients clearly leaves submission disabled. Main navigation reaches
  normal sign-in. No production browser mutation or email was performed.

## Reinspected migration package

Read-only connector inspection of project **htlgjluegmdwfjkzzwic** on October 14 found
**43 completed entries, no incomplete/rolled-back entries**, matching current main's
entire committed history, including the four previously verified CRLF equivalents.
No new prerequisite migrations exist in advanced main. Exactly these eight remain:

1. `20261012171752_admin_session_bound_elevation`
2. `20261013002253_recipient_audiences`
3. `20261013005624_scheduled_communications`
4. `20261013014837_decision_letter_controls`
5. `20261013014950_recruitment_cycles`
6. `20261013015200_scheduled_decisions`
7. `20261013140024_scheduled_invitation_emails`
8. `20261013141510_scheduled_availability_requests`

The builder now uses current main 2ceb874 and **requires the fresh live-ledger JSON**.
It verifies the actual names/checksums/completion/project/runtime assumptions and
records that snapshot's SHA256. Missing/extra/incomplete/checksum-changed/wrong-project
snapshots are tested to refuse before payload emission. A discrepancy requires review
of all prerequisites, never an assumption that the old eight suffice.

Final committed-source package: `/tmp/outclass-current-main-release-package/`.
Its manifest identifies the full final source/base SHA and original/payload checksums.
Exact SQL executes before truthful history in each guarded atomic transaction; local
failure injection, replay/stale guards, every intermediate resume point, populated
preservation, actual bounded access/browser denial and Prisma status/deploy no-op are
validated. See [workspace-migration-package.md](workspace-migration-package.md).
The read-only snapshot is `/tmp/outclass-current-main-live-ledger.json`; no credentials
are included. Production execution is **not** performed.

## Manifest and limitations

[workspace-release-manifest.txt](workspace-release-manifest.txt) is the exact release
diff against current main 2ceb874. All earlier reliability/Admin/audience/scheduler/
decision/capacity commits remain ancestors. Five recovery files retain their hashes,
remain untracked and unstaged; temporary scripts/logs/screenshots/packages are excluded.

Hosted throughput remains unverified, particularly iad1→us-west-2 latency. Bulk jobs
can fail atomically at the unchanged 20s bound; no exact-time SLA is promised. Hosted
instant/digest delivery requires the provider owner and remains unverified. Earlier
paginated PDF evidence is retained and **not rerun** in this integration pass. Physical
mobile devices/printers and the fixture-incompatible older broad Admin/assets runner
remain untested; current local Auth/Storage checks passed separately. New main's broad
availability browser automation was not rerun; affected overlap received rendered QA
and unit/database regression checks. Source CI and preview outcomes are recorded on
PR #29 after pushing, distinct from local passes.

No production migration, main merge, production deployment, credential/configuration
change, real preference/queue mutation or outbound email enablement occurred.
