# Scheduler capacity follow-up for PR #29

## Bounds and hosting evidence

Read-only Vercel project settings (2026-10-13) show **Pro, Fluid Compute enabled,
Standard 1 vCPU / 2 GB, iad1**. Screenshot:
`/tmp/outclass-scheduler-capacity/vercel-functions.png`. Supabase project metadata
shows production database **htlgjluegmdwfjkzzwic, us-west-2, PostgreSQL 17**. The route
keeps its explicit **maxDuration=60** override; no hosting setting was changed.
[Vercel cron documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
describes overlapping/duplicate invocations and minute scheduling. Neither cron
success nor a minute expression guarantees exact-time publication.

The old two-sequential-intent limit is removed. The new budget is:

- **3 global live PROCESSING jobs**, **at most 1 DECISION**, **1 per club**.
  Small sends may use all three slots if no decision runs. A bulk decision leaves
  two slots available to unrelated clubs; it retains its club lock for atomicity.
- **3 async lanes per invocation**, **128 claim cap**, **25-second admission window**.
  The transaction-scoped advisory lock serializes only short claim selection/counting.
  Durable two-minute leases enforce slots across duplicate/overlapping invocations.
- Least-recently-serviced eligible clubs first; one due head per club; locked clubs
  skipped. An active club is excluded before selection, preventing another lane
  waiting behind its bulk job. Failed/cancelled/publication states retain history.
- Unchanged claim/marker transactions: maxWait 1s, transaction 4s, statement 3s,
  lock 1s. Publication: maxWait 2s, transaction **20s decisions / 12s other kinds**,
  statement 8s, lock 2s. Latest admission plus worst claim/acquisition, publication
  and marker budgets fit below 60s (25+5+22+5=57s; no long post-processing).
- Revision fencing, club→intent lock order, transaction-time authority/state checks,
  atomic status/letter/notification/outbox/audit writes and idempotent completion
  remain. Lease expiration recovers crashes; stale revisions cannot publish twice.
  No new migration, role grant or network delivery inside the publication transaction.

Three asynchronous database slots keep concurrency small on the actual one-vCPU
host, reserve progress for smaller jobs and fit a three-connection Prisma test pool.
The deployed runtime URL's pool options remain unreadable and were not reconstructed
or changed. A smaller available pool, database contention or cross-region latency
can reduce throughput; the bounded acquisition/lease path remains fail-safe.

## Representative PostgreSQL backlog results

`node scripts/test-decision-publication-local.cjs` uses actual PostgreSQL 17, the
NOSUPERUSER/NOBYPASSRLS bounded runtime owner, a **3-connection runtime pool** for the
mixed test, and real canonical publication handlers. Each wave contains a 50-applicant
mixed-outcome voting decision and 64 announcements distributed across four clubs:
one announcement is cancelled; one club's 16 jobs are externally locked. An additional
sender is revoked after scheduling; its job fails with no publication. One small job
starts as an expired crash claim. Global email remains disabled throughout.

Waves use one, two and three overlapping invocations, then a 50ms latency stress
wave. A separate operator samples committed PROCESSING counts every 20ms: observed
maxima **3 global / 1 decision / 1 per club**. Each wave publishes all **47 unlocked
small jobs**, then all 16 locked jobs after release, exactly once. The first three
waves publish the entire decision atomically. At 50ms ORM latency, its 20-second
transaction expires and **all 50 decision writes roll back**; small jobs still finish.
Cancellation, revoked authority, rollback, retries, live claims and terminated
transactions are covered in the accompanying native tests.

Measurements below include real handler/SQL execution plus the stated injected delay
**per ORM operation**, not raw SQL or hosted network latency. Publication lateness is
commit timestamp minus a common due timestamp set one second before invocation.
The cron phase can add up to roughly another minute in healthy operation. Locked
work is intentionally excluded from unlocked latency percentiles.

| ORM delay | Invocations | Published before unlock | Small p50 / p95 / max lateness | Invocation time | Decision result |
|---|---:|---:|---|---:|---|
| 10 ms | 1 | 48 | 3.24s / 5.28s / 5.47s | 8.60s | 50 published atomically |
| 10 ms | 2 | 48 | 3.28s / 5.31s / 5.50s | 8.63s | 50 published atomically |
| 20 ms | 3 | 48 | 5.16s / 8.87s / 9.21s | 15.86s | 50 published atomically |
| 50 ms | 3 | 47 | 10.69s / 19.49s / 20.29s | 20.51s | Atomic rollback at 20s |


Conservative demonstrated healthy-cron service budget for this representative mix:
**48 successfully published intents/minute** at 10–20ms ORM delay (47 small + one
50-applicant decision), across repeated independently populated waves. At 50ms, the
small-send budget remains **47/minute**, but no successful 50-applicant decision
capacity is claimed. These figures allow the rest of each minute to be idle and do
not extrapolate an unlimited jobs/second rate. They are a local load envelope, not a
production benchmark or an arrival-rate guarantee. Existing **20 announcements per
club/hour** and recipient/queue caps still apply; distributing a backlog is not a
quota bypass. More eligible arrivals than sustained capacity still grow the queue.

## Remaining timing guarantee

Publication is **no earlier than the chosen instant**, not guaranteed at that instant.
The shared composer now says processing runs every minute and busy queues, club edits
and recovery can delay it; email delivery is separate. At the measured moderate mix,
unlocked sends finish within the next healthy tick plus the reported latency. There
is **no finite worst-case lateness guarantee** under recurring missed invocations,
persistent locks, excess load or database outages. A crash can occupy a slot for up
to two minutes plus the next invocation. FAILED jobs require reviewed rescheduling.

A 50-applicant decision at higher latency approaches the existing 20s bound. The actual iad1→
us-west-2 path has not been benchmarked by executing production decisions. Larger or
slower valid jobs can fail atomically with PUBLICATION_UNAVAILABLE; operators should
use smaller reviewed batches when necessary. No transaction timeout was increased.
Hosted throughput and hosted email remain unverified; provider-owner verification is
still needed for outbound delivery. No production queue/preference/control was changed.

## Validation and exact follow-up files

Rerun: 64 native PostgreSQL checks; complete 51-migration fresh deployment and populated
43→51 Prisma upgrade; full suite 1,062 passed / 24 gated skips / zero failures;
TypeScript, Prisma validation, production build, migration-path and diff checks pass.
Lint remains zero errors / 28 existing warnings. The connector package separately
passes all eight atomic SQL/history/rollback/drift/retry checks and final Prisma
status/deploy no-op plus actual runtime/browser isolation (11 top-level checks).
Previous local Auth/Storage HTTP and rendered UI/PDF results are retained, not claimed
rerun in this capacity-only pass. UI change is explanatory text in the shared schedule
fieldset; no form controls or selection semantics change.

Evidence: `/tmp/outclass-capacity-native-debug-final.log` (fresh 64-check run),
`/tmp/outclass-capacity-crash.log` (actual backend-termination regression),
`/tmp/outclass-scheduler-capacity/results.json`, `/tmp/outclass-capacity-suite.log`,
`/tmp/outclass-capacity-{types,lint,build,prisma,migration-path}.log`, and the final
`/tmp/outclass-workspace-release-package/` manifest, payloads and validation results.
See [eight-migration package](workspace-migration-package.md) for execution review.

## New main baseline (2026-10-14)

Main advanced to `537119b360b14430c2ed10c551a3687190143972` after this branch's
reviewed base `b4a9efa10f1f0ea2bc269907fd28bc5ea6871dbc`. Five new commits (including
merge ancestry) change interview interactions/countdowns and timezone presentation/
availability validation. No schema or migration file changed; the exact 43→51
migration package remains applicable only while its ledger guards match.
A no-working-tree merge simulation found one textual conflict in
`components/views/leader-dashboard/live-leader-workspace.tsx`; actions/availability.ts
and availability/admin-overview.tsx merge textually cleanly. Inspected availability
save validation, canonical notification formatting and collaboration access retain
live authorization and introduce no scheduler/worker changes. The branch has **not**
integrated or run combined validation against this newer main. PR #29 needs that
conflict resolved and integrated checks before release; passing source-branch CI does
not establish merge readiness. No merge or deployment was performed in this pass.

Follow-up commit manifest (14 files):

```text
app/api/internal/scheduled-communications/route.ts
components/communication-schedules.tsx
docs/scheduler-capacity.md
docs/workspace-integrated-release.md
docs/workspace-migration-package.md
docs/workspace-release-manifest.txt
scripts/build-workspace-migration-package.py
scripts/test-workspace-migration-package.py
scripts/test-workspace-migration-package.sh
tests/communication-schedule.test.cjs
tests/communication-schedules-native.test.cjs
tests/decision-publication-native.test.cjs
tests/invitation-schedules-native.test.cjs
utils/scheduled-communications.ts
```

## Current-main integration follow-up

The later integration into main `2ceb87487b18c2e7daa17585721f2a3b0d4ba0b4` resolves
the above conflict and corrects the host-local deadline test fixture. See
[workspace-current-main-integration.md](workspace-current-main-integration.md).
The scheduler budget is unchanged; mixed-backlog/native checks were rerun.
