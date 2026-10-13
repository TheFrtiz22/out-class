# Shared communication scheduling

Baseline: `repair/workspace-reliability`, audience commit
`8e17b8b643130966b742d59d262469c38cd3fe37`. Origin main was fetched and remains
`ce2c0141291bcb0b8683b8a3a94ad5db62c6d746`; no intervening main changes.
No push, deployment, production migration, provider call or production data change.
The five untracked credential-recovery files are excluded and their hashes preserved.

## Producer inventory and coverage

| Producer | Scheduling coverage |
| --- | --- |
| Club Announcements (`actions/communications.ts`, `components/club-announcements.tsx`) | Send now / Schedule; existing canonical publication extracted and shared with scheduled execution. This is the active standalone freeform club communication composer. |
| Direct / voting recruitment decisions (`actions/applications.ts`, `actions/voting.ts`, `utils/decision-communications.ts`) | Immediate only in this step. Future atomic handler contract below; no decision scheduling UI or early outcome writes. |
| Offer responses and membership commands | Immediate transactional business results; unchanged. Do not delay acceptance/decline or membership to schedule their notices. |
| Invitations / invitation delivery (`utils/invitation-delivery.ts`, `utils/email.ts`) | Existing invitation/expiry/claim workflow and worker remain unchanged. Scheduling an invitation requires a separate business command defining creation and expiry, rather than delaying an already-created invitation's notice. |
| Interview assignments, booking changes, application transitions | Immediate business-event notices / database triggers; no standalone composer. |
| Task assignments/reviews, events/Corkboard publication | Existing business-event/publication flows; not converted to communication drafts. |
| Admin student claim/resend; Auth verification, password reset, MFA and security messages | Immediate. Never enter the optional communication scheduler. |
| Direct messaging / conversations | Retired actions remain rejected; scheduling does not reactivate them. |
| Demo | No live scheduler/group calls. Existing live-account explanation remains. |

## Timing and recipients

Schedules store an explicit IANA timezone, wall time, earlier/later repeated-hour
choice and resolved UTC instant. UTC is authoritative after save. A subsequent
edit recomputes using the installed timezone data. Spring-forward gaps and invalid
calendar dates/zones are rejected. Autumn repeated hours have explicit earlier/later
choices; half-hour transitions are tested. Server validation requires at least one
minute in the future and at most 366 days. No promise of second-accurate execution:
cron runs every minute; bounded throughput, locks and failures can delay publication.

Preview is current eligible selection, not email eligibility or a reservation.
FIXED captures server-owned IDs and their contact boundary. Changing a saved group
or graduation/cohort filter does not reselect those identities. Active members must
remain active members; active applicants must remain eligible identified active
applicants; rejected applicants retain the separate rejected boundary; recorded
contacts must retain authorized club visibility. Disabled accounts, anonymous
applicant identities and lost sender identification permissions remain denied.
Former members are not promoted to event contacts merely because of old RSVPs.
SEND_TIME reevaluates current rules/groups; new matching recipients can enter.
An edit recaptures selection and eligibility; response-loss retries do not.
Client snapshots and raw PEOPLE selectors are rejected; use a saved manual group
for individual selection. Snapshot IDs never leave schedule server actions.

Execution rechecks the original sender's enabled account, active membership,
`meetings.manage`, applicant identification capabilities and operational club under
transaction locks. An empty eligible audience fails without publishing. Existing
20-announcements-per-club/hour limit is retained; a club may queue at most 100
scheduled/failed sends. Managers see all queued sends and 50 latest completed sends.
Only the sender can rewrite content; any currently authorized communications
manager can cancel unstarted/failed sends, with their own audit attribution.
Support impersonation may perform existing immediate actions or attributed
cancellation; it cannot create/edit future authority that outlives its support session.

## State, atomicity and worker

`ScheduledCommunication` is server-only intent. Saving/editing/cancelling writes no
announcement, notification, offer, letter or email outbox. Revisions enforce optimistic
edits and response-loss idempotency. Club lock precedes intent lock in every path.

The authenticated worker commits a PROCESSING claim with an incremented revision
as a fencing token. Its updatedAt is the two-minute lease start. New claims and
expired crash claims use SKIP LOCKED and a revision guard. Edit/cancel loses once
PROCESSING is claimed; the UI hides those commands. A crash before publication is
reclaimed after the lease. A worker that lost its token cannot publish or overwrite
another worker's state. Publication locks the club/intent, rechecks the token and
live authorization, then atomically creates the announcement, canonical
UserNotification rows, existing trigger-produced NotificationEmailOutbox rows,
individual attributed audit and PUBLISHED status. No provider or HTTP Auth work is
inside these transactions. Existing unique club/requestKey and user/eventKey
constraints provide additional duplicate prevention. Crash after commit is already
PUBLISHED and cannot replay.

A caught publication failure rolls back all business writes and marks only its own
claim FAILED with benign PUBLICATION_UNAVAILABLE. No raw exception is exposed or
logged. Explicit edit/reschedule is the recovery action for FAILED, including lost
permissions, missing groups, empty audiences or the existing hourly rate limit.
Before-claim transient failures remain SCHEDULED. If failure marking is unavailable,
the PROCESSING lease remains recoverable. Cancelled/published history is retained.
Automatic retries are for crashed/unmarked claims; caught FAILED sends require review.

Invocation: existing Vercel cron infrastructure adds
`GET /api/internal/scheduled-communications` every minute, with the existing
`Authorization: Bearer $CRON_SECRET` contract (constant-time comparison); POST is also
supported for an authorized operator. No new public capability or secret variable.
`maxDuration=60`; at most two sends/invocation. Claim: maxWait 1s / transaction 4s /
lock 1s / statement 3s. Publication: maxWait 2s / transaction 12s / lock 2s /
statement 8s. Failure marker: maxWait 1s / transaction 4s / lock 1s / statement 3s.
Worst per-item transaction budgets including waits are 24s; two items stay bounded
below the route deadline apart from connection/query overhead. Route interruption
is safe through durable claims. Initial candidate selection is an indexed bounded query.

Due inbox publication is **not gated by COMMUNICATIONS_EMAIL_ENABLED**. Email still
uses the unchanged shared delivery worker, canonical preferences, digest scheduling,
leases and provider idempotency. Manager email counts are read from canonical
outbox/delivery records (queued, sent, suppressed, needs review), independently of
inbox status. Queued never claims sent; preferences are applied by delivery, not by
preview/publication. Global outbound email remains disabled throughout local checks.

## Future scheduled direct/voting decisions

The kind discriminator currently accepts only ANNOUNCEMENT in code and SQL. Extend
it deliberately with a typed intent and handler operating on the **existing publication
transaction**, not a network call or a second transaction. That handler must lock the
same club/application/voting state, revalidate recruiting/identification authority and
expected decision version, validate current voting readiness and applicable offer
state, and commit decision status/version, optional immutable DecisionLetter,
canonical notification and outbox intent with PUBLISHED and its audit. Request key
and expected version must fence retries. Preparing intent must not write live outcome,
letter, offer, notification or a student-visible preview. Existing direct/voting commands
and membership/offer transactions remain authoritative and are not scheduled here.

## Recruitment cycle gap

Inspected Application.roundId, PipelineRound (club, stage name/type/order, archivedAt)
and ClubMember.cohort/joinedAt. There is no authoritative semester/recruitment-cycle
relationship. Round is a pipeline stage; membership cohort records joining, not the
application cycle. Neither is relabelled, inferred from dates or used as cycle data.

Narrow proposal for the upcoming recruitment step (not implemented here): add a
club-scoped RecruitmentCycle with explicit label/term and optional dates, and a
nullable Application.recruitmentCycleId with a composite club/cycle foreign key.
New recruitment flows select the authoritative cycle. Existing applications remain
unassigned until an explicit reviewed mapping, not a guessed backfill. Round/cycle
configuration should be handled separately if stages become cycle-specific; it is
not required to record an application's cycle. Audience filtering can then use that
actual foreign key. No extra cycle schema is added in this scheduling migration.

## Migration and deployment ordering

`prisma/migrations/20261013005624_scheduled_communications/migration.sql` adds one
private intent table and indexes/constraints. Restrictive false RLS; all privileges
revoked from PUBLIC/anon/authenticated. Conditional ownership transfers only this
new table to existing outclass_production_app, preserving prior schema CREATE state.
No FORCE RLS: authoritative bounded-owner model is retained. No unrelated grants,
new login, existing-table alteration, backfill or historical notification replay.

Apply all pending branch migrations **before code/cron** using the existing reviewed
operator path. This branch also contains unshipped Admin/audience migrations; do not
assume scheduling is the only pending migration. No deployment or migration to
production/staging is authorized/performed by this implementation task.

## Validation and reproduction

- `node --test tests/communication-schedule.test.cjs`: timezone/calendar/future bounds,
  US spring/autumn DST, Lord Howe half-hour transitions, authenticated cron.
- `node scripts/test-communication-schedules-local.cjs`: disposable native PostgreSQL,
  bounded actual runtime connection; complete fresh migration history; populated
  41-to-42 upgrade preserving groups/entries, preferences, membership/cohort/labels,
  announcement, notification and outbox; Prisma migrate status up to date. Includes
  existing audience checks and new scheduling checks, concurrent claims, cancellation
  races, stale edits, response-loss retry, fixed/dynamic selection, disabled accounts,
  sender revocation, suspension, cross-club/Demo boundaries, canonical outbox counts,
  injected post-notification rollback, actual PostgreSQL connection termination,
  stale PROCESSING crash lease/reclaim and browser CRUD denial under accidental
  grants/permissive policies. No hosted connection configuration is read.
- `OUTCLASS_ADMIN_LOCAL_PROJECT=outclass-admin-session-e2e node scripts/run-admin-local.cjs migrate`
- Same helper `build`, `start`, `scheduling-integration`, `audience-integration`: actual
  loopback Supabase Auth / production Next server actions / authenticated cron;
  delivery disabled, provider key empty. Native fixture is automatically removed;
  HTTP/browser synthetic fixture/history remain local for reproducibility.
- `node scripts/test-decision-transactions-local.cjs`: 31 repair + 26 existing native
  transaction/security checks passed separately; intentional latency/lock/timeout cases.
- Full suite, TypeScript, lint, Prisma validation, production build and migration RLS
  checks rerun for the feature; final totals recorded below after final verification.

Rendered QA uses actual Chrome against the authenticated local Next application,
not CSS inspection. Desktop 1512x861 and mobile 390x844: group management, include/
exclude and saved-group selectors, current-recipient previews, schedule controls,
keyboard Tab/native date editing, confirmation, editing/cancelled/published/failed
management states and empty/error recovery. Initial mobile manager overflow (470px
in a 390px viewport) was fixed to 390px; group editor now uses the existing padded
workspace drawer. Evidence lives outside the repository in
`/tmp/outclass-scheduling-qa/`; fixture routes are in
`$TMPDIR/outclass-scheduling-browser.json` (non-secret IDs only).
The failed UI fixture is deliberately seeded; actual failures/rollback are tested in
PostgreSQL, not claimed from that seeded screenshot. Native datetime automation
fill does not work reliably with Chrome's segmented control; keyboard editing is
verified with the real native control instead. No mobile-device hardware testing.
No hosted cron/provider/email behavior is claimed; no external test email was sent.

## Exact feature manifest

```
actions/communication-schedules.ts
actions/communications.ts
app/api/internal/scheduled-communications/route.ts
components/club-announcements.tsx
components/communication-schedules.tsx
components/recipient-audiences.tsx
docs/communication-scheduling.md
docs/recipient-audiences.md
lib/communication-schedule.ts
prisma/migrations/20261013005624_scheduled_communications/migration.sql
prisma/schema.prisma
scripts/run-admin-local.cjs
scripts/test-communication-schedules-local.cjs
tests/communication-schedule.test.cjs
tests/communication-schedules-e2e.test.cjs
tests/communication-schedules-native.test.cjs
utils/announcement-publication.ts
utils/recipient-audience.ts
utils/scheduled-communications.ts
vercel.json
```

## Final results

- Focused communication/audience/timezone tests: 15 passed, 0 failed.
- Native PostgreSQL: 18 scheduling + 16 audience checks passed, 0 skipped/failed;
  complete fresh history and populated 41-to-42 upgrade passed, ledger up to date.
- Real local Auth/Next/cron scheduling: 5 passed; audience integration: 5 passed.
- Native decision/support regressions: 31 repair + 26 existing checks passed.
- Full suite: 1,012 passed, 19 explicitly gated skips, 0 failed (1,031 total).
  Final group empty-state/retry copy was subsequently checked with the focused
  tests, TypeScript, lint and production build rather than another full-suite run.
- All 42 migrations pass fresh/legacy checks; 69 tables enforce browser RLS denial.
- TypeScript, Prisma validation, production build and diff checks passed.
- Lint: 0 errors, 28 existing warnings.
- Final rendered desktop/mobile checks passed. Real native keyboard entry created
  2026-11-01 01:00 America/New_York, later occurrence (06:00Z), fixed selection;
  mobile confirmation and persisted SCHEDULED row verified. Desktop saved-group
  preview, manual group creation/checkbox selection, rule-group editing and schedule
  edit verified. Published row shows 2 inbox recipients / 2 email queued / 0 sent.
  Local permission revocation generated the rendered retry error; permissions were
  restored afterward. Padded drawer and empty-group/loading/retry states verified.
  Final 390px mobile layout has 390px scroll width, no horizontal overflow.
- No remaining P0/P1/P2 finding identified. Explicit limitations: scheduled decisions
  and cycle filtering are future work; hosted cron/email and physical mobile devices
  were not tested. Failed sends require review/reschedule; throughput and hourly
  announcement limit are intentional, documented bounds.
