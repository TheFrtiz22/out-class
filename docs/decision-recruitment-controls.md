# Decision publication controls, scheduling and recruitment history

## Baseline and scope

Branch: `repair/workspace-reliability`; implementation starts after
`d3425d3d617ae49435e28105cdd2df75cec167aa`. Fetched main:
`e8f33ecfd114fa5c0971623c7c139edeb0d2f6a5` (unchanged on final fetch).
The three incoming commits (`9a3b3db`, `661a2ff`, `e8f33ec`) add availability,
panel proposals and official panel publication. Their shared overlaps include
student dashboard loading, canonical inbox/email delivery and Prisma schema.
They do not replace recruitment decisions, letters, audiences or the shared
scheduler. This task does not merge main. A future integration must retain main's
panel notification handling alongside the optional-letter destination validator;
validation here applies to this branch, not to a hypothetical merged code tree.
The native populated upgrade also applies all three incoming main migrations to
verify schema coexistence before applying this feature's migrations.

All writes/tests are local and disposable. Global outbound email remains disabled.
No production/staging database, deployment, preferences or existing queue was
accessed or changed. The five credential-recovery files remain excluded and intact.

## Decision letters

Recruiting navigation exposes Decision Letters. The existing template editor,
escaped text rendering, fictional preview, signatures and private branding remain
canonical. `Club.sendFormalDecisionLetters` defaults to true, preserving existing
behavior. Disabling it affects future publications only: status/version, offer
commands, canonical DECISION notification and transactional outbox still publish,
but no new DecisionLetter is created. Historical letters remain immutable and
readable by their original application owner.

A canonical application decision URL without `letterId` displays current status
and appropriate offer controls when no current letter exists. An explicit historical
letter URL retains its original content and cannot act on a newer offer. Email
links accept only the anchored canonical decision path, with an optional UUID
letter parameter. Letter controls explicitly distinguish the formal-letter toggle
from optional decision-availability email preferences and worker enablement.
Rendered QA also found the old Return to Status alias opened Home; the letter
view now uses the canonical student Status destination.

## Scheduled publication

Direct and completed voting publication expose Send now and Schedule. The existing
ScheduledCommunication table, authenticated minute cron, claim/fencing/lease logic
and shared worker are reused; no parallel notification or delivery system exists.

The reviewed application IDs/outcomes, application status/version/state revision,
round configuration, voting revision, complete default/custom templates, formal
letter toggle, recipient names and branding references are frozen at scheduling.
Decision dates and offer deadlines are assigned at actual publication. Scheduling
writes only the private intent and audit; it does not update applications, create
letters/offers, change membership or enqueue student notifications early.

At execution, Club and intent locks serialize workers and commands. Live active
sender membership/capabilities, user/club state, recipient enabled state, application
and round state, and voting revision/readiness are checked again. A changed state
fails the entire intent; no intervening decision is silently overwritten. A trigger
increments Application.decisionStateRevision on status, round, decision-version or
cycle changes, detecting ABA transitions as well as current-value differences.
Anonymous review retains zeroed version/identity projections; a SHA-256 optimistic
concurrency token exposes no raw versions and never substitutes for authorization.

Decision status/version, offers, optional immutable letters, canonical notifications,
trigger-created outbox, voting candidate/session state and intent completion commit
in one transaction. Individual audit writes retain the existing real/effective
actor and support-session attribution. Temporary support impersonation cannot
schedule future authority; immediate support publications retain the established
transaction wrapper and safeguards.

A committed PROCESSING claim has a two-minute lease and incremented revision as a
fencing token. Crashed claims are reclaimable. A failed publication rolls back all
domain writes and receives a benign FAILED state. Cancellation versus claim has
one serialized winner; processing/published work cannot be cancelled retroactively.
Edit/retry means cancel and create a newly reviewed intent. Response-loss retries
reuse the same request identifier and frozen snapshot. Reusing a completed/failed
identifier reports its actual state rather than pretending to requeue it.

Management exposes scheduled/processing/published/failed/cancelled states, anonymized
reviewed candidate labels/outcomes, time in the stored explicit timezone, and email
queued/sent/suppressed/attention counts separately from in-app publication.
Only currently authorized identified decision managers/publishers can inspect it;
announcement managers cannot read/edit/cancel decision intents via announcement APIs.

### Work limits and throughput

A scheduled voting intent permits at most 50 distinct applicants. Capture reads
only selected candidates and each latest pass, with at most 500 ballots each.
Execution reads selected candidate metadata and frozen reviewed outcomes; it never
reloads unrelated candidates or complete ballot/pass history. This bounds work
inside an intent, not merely the number of intents per invocation.

Claim: maxWait 1s, transaction 4s, lock 1s, statement 3s. Decision publication:
maxWait 2s, transaction 20s, lock 2s, statement 8s. Announcement publication retains
its existing 12s transaction. Failure marker: maxWait 1s, transaction 4s. At most two
intents are considered; no new claim starts after the invocation's 15s admission
window. A second worst-case 32s claim/publication/marker fits below the 60s route
budget when admitted. Unclaimed work stays due for the next invocation. This is a
bounded failure/recovery design, not solely a timeout increase.

Native PostgreSQL measured a 50-applicant mixed Acceptance/Waitlist/Rejection batch
with 10ms simulated latency per ORM operation. Final exact timing is recorded below.
This is isolated/simulated evidence, not a hosted throughput guarantee. Publication
seals the voting session just as immediate publication does; unselected candidates
retain their status. Larger atomic scheduled batches are deliberately unavailable.

## Rejected applicants and reconsideration

Rejected Applicants is a recruiting destination with existing search/filter/review
capabilities. Active list/kanban queues exclude REJECTED only after actual publication;
scheduling a rejection leaves the application active until due. Decisions retains
its existing explicit final-status groups. No account archive/disable/delete or
cross-club membership change is used for organization.

Explicit reconsideration requires current decision-management and identity
capabilities, an active round, an unchanged concurrency token and a recorded reason.
It returns REJECTED to IN_REVIEW and increments the decision version/state revision;
answers, evaluations, notes, audits and immutable letters remain intact. Anonymous
applications can be reconsidered using the opaque token without exposing identity
or raw versions. Generic final-status reopening and round-move prohibitions remain.

A new acceptance following explicit reconsideration may create a fresh offer when
the previous offer was revoked/expired/declined. The old closed offer, timestamps
and audits remain; its unique current-application link moves to the new offer, with
an offer.superseded audit linked to the application. Ordinary reversed-decision
retries do not revive offers. Existing membership, leadership and inactive-member
protections remain unchanged. Active-applicant audiences exclude rejected records;
REJECTED is an explicit separate source.

## Application cycles

RecruitmentCycle is club-scoped, named and archivable. Leaders create/rename/archive/
restore cycles and explicitly assign submitted applications in identified rounds.
Anonymous-round assignment is deliberately withheld; cycle values are not added
to anonymous-review projections. Existing unknown application cycles remain null.
There is no guessed backfill or relabeling of rounds, graduation years or joining
cohorts. A composite application club/cycle foreign key enforces club isolation.
Audience include/exclude rules support cycleIds for APPLICANTS and REJECTED;
archived cycle history remains targetable while new assignments require active cycles.

## Migrations and deployment order

Apply with the existing operator Prisma deployment path before running new code:

1. `20261013014837_decision_letter_controls`: default-on Club toggle.
2. `20261013014950_recruitment_cycles`: cycle table and nullable composite application FK.
3. `20261013015200_scheduled_decisions`: decision intent kind/completion invariant and
   application state revision trigger.

Do not rewrite committed history. This branch also retains earlier pending Admin,
audience and announcement-scheduler migrations and their migration-before-code
instructions; eventual deployment must inspect the complete pending set.

Only the new RecruitmentCycle table receives conditional ownership by the existing
outclass_production_app role. Its restrictive server-only RLS policy and revoked
PUBLIC/anon/authenticated grants follow the existing bounded-owner model (no FORCE
RLS). Temporary schema CREATE is restored to its previous state. Existing table
ownership, runtime grants and credentials are not broadened. The revision trigger
is an invoker function that only updates NEW and grants no browser access.

## Verification

See final results and evidence below. Local helpers pin loopback Database/Auth/
Storage/app endpoints and explicitly disable outbound delivery. No secret, cookies,
URLs containing credentials, PDF artifacts or temporary fixtures belong in this commit.

## Final local verification — 2026-10-13

Branch baseline: `d3425d3d617ae49435e28105cdd2df75cec167aa` on
`repair/workspace-reliability`. Prior reliability `e31d325`, Admin `7dea0d1`,
audience `8e17b8b` and scheduler `d3425d3` remain ancestors.
Fetched main is `e8f33ecfd114fa5c0971623c7c139edeb0d2f6a5`:
three interview-availability/panel commits after the common baseline. No merge
was performed. Isolated SQL compatibility included their three migrations, but
future code integration must preserve main's panel notification cases and this
branch's validated optional-letter destination. This is not a claim that the
unmerged combined application has been validated.

### Checks and throughput

- Full suite before the final presentation fixes: 1,013 passed, 21 gated skips,
  zero failures (1,034 total). Unavailable integrations are not counted as passed.
- Real PostgreSQL feature/audience/scheduler checks: 49 passed. Decision lifecycle
  includes atomic rollback after all writes, concurrent claims, cancellation,
  revoked authority, cross-club denial, disabled recipients, state/ABA conflicts,
  retry idempotency, crash recovery, immutable history and explicit reconsideration.
- Earlier native transaction repair checks rerun: 31 plus 26 passed.
- Local production-server Auth/Storage decision lifecycle: 7 passed; local Admin
  session integration: 12 passed. An older broad Admin/club-assets fixture-specific
  runner expects different ports/data and stopped at its fixture precondition;
  that runner is gated, not passing. New authenticated private-asset tests passed.
- Fresh complete history: 45 migrations; populated 42→45 upgrade preserves
  communications, preferences, groups, queued sends, letters, reviews and members.
  Browser CRUD denied on all 70 protected tables. Actual bounded runtime role
  reads/writes and invoker revision trigger passed. Incoming main SQL compatibility
  was also checked in isolation; it is not a combined Prisma deployment ledger.
- 50 mixed voting outcomes with 10ms simulated latency per ORM operation:
  **9,472ms, 729 ORM operations**, versus the 20,000ms publication transaction bound.
  Scheduled voting caps 50 selected applicants and 500 ballots per candidate;
  only reviewed/latest-pass records are captured. Worker admission closes at 15s,
  maximum two intents, bounded claim/publication/failure bookkeeping under the
  existing 60s route budget. Hosted throughput remains unmeasured.
- Final affected UI checks: 21 passed; TypeScript and production build passed.
  Lint: zero errors, 28 existing warnings. Prisma validation and diff checks passed.
  Full suite was not needlessly rerun for final labels/layout/loading controls.

### Rendered UI and print evidence

Local Chrome desktop and 390×844 responsive viewport were used; keyboard Enter,
Space, native select and date/time controls were exercised. Evidence remains
outside Git in `/tmp/outclass-decision-qa/`.

- Decision Letters editor, fictional preview/private logo and toggle explanation
  inspected desktop/mobile. Keyboard toggle off/on saved successfully and retained
  historical letters. Template variables remain escaped.
- Direct and voting schedule composers expose reviewed/frozen content, explicit
  timezone and DST occurrence. Keyboard-selected New York 2026-11-01 01:00 LATER
  resolved to 06:00Z. Actual direct/voting intents were scheduled and cancelled;
  editing is explicitly cancel-and-reschedule. Application status remained
  unchanged and authenticated student access to manager intents was denied.
- A real local conflicting due intent returned `{published:0,failed:1,skipped:0}`;
  the manager rendered FAILED with benign review guidance and retained cancellation
  history. No decision was overwritten. Publication and email counts remain separate.
- Rejected search returned a clear zero-match state, applicant drawer retained
  review/history, and keyboard reconsideration returned the synthetic applicant to
  IN_REVIEW without changing membership/account. Cycle assignment persisted.
- Cycle creation, archive, restore, inline rename and cycle-filtered audience
  preview were exercised. Preview returned one unique recorded applicant and a
  reusable rule group was saved. Unknown legacy cycles are not inferred.
- Findings fixed during QA: misplaced drawer controls, scrollable direct dialog,
  status return destination, rejected header/empty copy, inline keyboard rename and
  reconsideration reasons, clear manager loading/error states that clear protected
  stale rows on failed refresh, mobile voting min-content overflow, and obsolete
  cycle-help copy. Final layout was checked after rebuilding.
- **Actual print verification:** approved headless Chromium navigated authenticated
  local student routes, enabled print media, loaded fonts/private logo and generated
  A4 PDFs. Acceptance one page, Waitlist one page, long custom Rejection three pages
  with multiline student variables. All five PDF pages were rasterized and visually
  inspected: readable content, safe margins/page breaks, consistent typography,
  private logo, no clipping or navigation/action controls. `accepted.pdf`,
  `waitlisted.pdf`, `rejected.pdf`, page PNGs, `print-results.json` and
  `pdf-inspection.json` are reproducible evidence; this is not CSS-only inspection.
  Credentials stayed in process memory and only loopback services were contacted.

### Remaining limitations / findings

No known unresolved P0/P1/P2 implementation defect. Hosted email remains unverified
and needs the provider owner; global email was never enabled. Physical devices,
physical printers and hosted bulk throughput are not claimed. Upcoming integration
with the three newer main commits requires conflict resolution and checks before
release. Support impersonation intentionally cannot schedule future authority.
Anonymous-round cycle assignment is intentionally unavailable. Larger than 50
atomic scheduled voting batches are rejected. Migration-before-code is required.
No production/staging data, queues, preferences, credentials or settings were touched.

## Exact feature commit manifest (46 files)

```text
actions/communication-schedules.ts
actions/communications.ts
actions/crm.ts
actions/decision-schedules.ts
actions/recipient-groups.ts
actions/recruitment-management.ts
actions/voting.ts
app/api/decision-letter-assets/route.ts
components/club-workspace.tsx
components/communication-schedules.tsx
components/communications/decision-letter.tsx
components/communications/template-editor.tsx
components/decision-schedules.tsx
components/live-voting/board-decision-mode.tsx
components/recipient-audiences.tsx
components/recruitment-cycles.tsx
components/views/leader-dashboard/live-leader-workspace.tsx
docs/communication-scheduling.md
docs/decision-recruitment-controls.md
docs/recipient-audiences.md
lib/anonymous-review.ts
lib/communication-schedule.ts
lib/decision-publication-guard.ts
lib/decision-schedule.ts
lib/demo/communications.ts
lib/notification-email.ts
lib/product-navigation.ts
lib/recipient-audience.ts
lib/workspace-api.ts
prisma/migrations/20261013014837_decision_letter_controls/migration.sql
prisma/migrations/20261013014950_recruitment_cycles/migration.sql
prisma/migrations/20261013015200_scheduled_decisions/migration.sql
prisma/schema.prisma
scripts/run-admin-local.cjs
scripts/test-decision-publication-local.cjs
tests/club-workspace.test.cjs
tests/communications-native.test.cjs
tests/decision-publication-e2e.test.cjs
tests/decision-publication-native.test.cjs
tests/live-applicant-views.test.cjs
utils/decision-communications.ts
utils/decision-scheduling.ts
utils/recipient-audience.ts
utils/recruitment-offers.ts
utils/scheduled-communications.ts
utils/voting-publication.ts
```
