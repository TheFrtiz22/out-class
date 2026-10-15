# Scheduler polling starvation repair

## Baseline and demonstrated cause

Branch `repair/scheduler-polling-starvation` starts from origin/main
`b4dcd81b387737ecc18909cb2a7529e985571546` (refetched unchanged before commit).
The serving Vercel deployment inspected during this repair was
`DLHbGddurAGjXaTztuvGqMzpLFes`, source
`1df2665284f9887613845f45dcc4c533ceeccd35`. The voting action blob is identical
at that source, current main, and PR #29's merge `0d9a21c`.

`getVotingWorkspace` previously held Club FOR SHARE and ClubMember FOR SHARE
through every query of its repeatable-read transaction. These gates serialize
suspension and membership revocation with mutations. They were unnecessarily
retained during the entire polling read. Scheduler admission deliberately
requests Club FOR UPDATE SKIP LOCKED: any overlapping shared read makes the
club's due head invisible to that invocation. It does not wait or throw.
Repeated phase-aligned invocations can keep deferring the same club.

Real PostgreSQL 17 reproduction uses two overlapping actual voting actions,
70 ms injected round-trip delay per snapshot query, separate bounded polling
and worker pools, two due sends in the polled club and one in another club.
This is an intentional sustained-overlap stress case, not a claim that hosted
queries uniformly take 70 ms. pg_stat_activity/pg_locks samples contain only
counts, ages and lock categories; no query text, addresses or identities.

| Measurement | Original polling | Repaired polling |
|---|---:|---:|
| Completed voting reads | 7 | 8 |
| Worker invocations while polling | 17 | 16 |
| Club RowShareLock occupancy during sampled snapshots | 100% | 0% |
| Max sampled read transaction age | 728 ms | 588 ms |
| Pool acquisition p95 | 1 ms | 1 ms |
| SQL/pool exceptions and claim errors | 0 | 0 |
| Polled-club sends published while polling | 0/2 | 2/2 |
| Other-club sends published while polling | 1/1 | 1/1 |
| Publications after stopping polling | 2 in 95 ms | 0 |
| Polled-club publication lateness | deferred until polls stopped | 1,436–1,448 ms |

Lateness includes an initial 1,000 ms overdue fixture offset. No blocking waits
were sampled: SKIP LOCKED bypasses the row rather than waiting. Separate pools,
low acquisition times, and absence of exceptions rule out pool exhaustion for
this reproduction. Direct worker invocations rule out cron gaps here. Another
club progressing rules out a global capacity/fairness stall. Hosted delays may
have additional causes: no repaired artifact has been deployed or timed in
production, and the earlier cron 200s cannot retrospectively prove there were
no silently swallowed pre-claim errors.

## Repair and security

Voting uses an explicitly READ ONLY repeatable-read snapshot without long-lived
row locks. It checks current club state and membership within that snapshot,
then re-runs the normal authenticated permission guard after the transaction.
The membership (including updatedAt, capability/role and identity fields) must
match both the initial guard and the completed snapshot. Non-leadership
participants are checked again before returning a session. Account disablement,
suspension, support-session expiry, revocation and cross-club access deny the
payload. Snapshot data and privacy projections remain consistent. Concurrent
permission changes fail closed and ask for refresh. This adds a final guard;
it does not promise revocation after a response has already been released.

Mutation paths retain their existing Club/member/session locks, transaction-time
authorization, support attribution and atomic writes. Polling authentication
uses the request-scoped provider proof; healthy reads do not upsert an unchanged
user or invoke mutation audit extensions. Expired support-session cleanup is a
separate intentional lifecycle write outside the read snapshot. Applicant
display snapshots do not acquire the long Club lock; QR discovery is not this
polling transaction. Neither path was broadened by this repair.

Scheduler admission, least-recently-serviced club ordering, three global slots,
one decision slot, one live job per club, revision fencing, two-minute leases,
publication atomicity and all transaction limits remain unchanged. No timeout
was raised. Pre-claim errors now count as `claimErrors`, not ordinary skips;
authenticated cron returns 503 when any claim fails. A partial invocation may
have already published other jobs; callers must rely on existing idempotency.

Best-effort diagnostics expose only fixed stage names and allowlisted Prisma
codes, never messages, stacks, SQL/meta, personal identifiers or content.
Invocation summaries include counts, duration, ordinary deferral categories,
due count and oldest due age. `noCandidate` means no claimable candidate, not
proof of a lock: empty queues, active leases and eligibility can also cause it.
The queue-health aggregate has a 2 s statement / 3 s transaction bound and
returns null health on failure. Broken log sinks cannot replace worker results.

## Sustained polling with mixed backlogs

Actual PostgreSQL workload per wave: a 50-applicant atomic voting publication,
63 small sends across four clubs (16 held behind a deliberate exclusive lock),
a cancelled send, revoked authority, and an expired crashed claim. Two voting
pollers remain active through the initial invocation(s), using a separate pool.

| Injected ORM delay | Invocations | Voting reads | Small sends before unlock | Small p95 / max lateness | Bulk result |
|---|---:|---:|---:|---:|---|
| 10 ms | 1 | 32 | 47 | 5,728 / 5,931 ms | 50 atomic outcomes |
| 10 ms | 2 | 30 | 47 | 5,420 / 5,605 ms | 50 atomic outcomes |
| 20 ms | 3 | 56 | 47 | 8,979 / 9,313 ms | 50 atomic outcomes |
| 50 ms | 3 | 68 | 47 | 21,780 / 22,669 ms | bounded failure, all 50 rolled back |

All 16 deliberately locked sends published after unlock. No wave exceeded
three live global claims, one decision claim or one claim per club. Small sends
progressed before the bulk finished. Cancellation stayed cancelled; revoked
publication created no announcement; expired claims recovered exactly once.
The existing backend-termination, retries, fencing and audit rollback checks
also passed. Conservative invocation capacity remains 47–48 unblocked sends
in these fixtures; these are measurements, not a universal throughput SLA.
Minute cron phase adds up to roughly 60 s before admission; backlog, real write
locks, hosting delays and explicit failures can add more. Scheduled time is
earliest eligibility, never an exact-time guarantee.

## Validation and evidence

Rerun in this repair:

- `node scripts/test-scheduler-polling-local.cjs`: 5 polling/security checks and
  49 native scheduler/decision/invitation/availability checks passed; fresh
  52-migration history and Prisma migrate status passed; inherited populated
  scheduler upgrade preservation checks passed.
- `OUTCLASS_POLL_ONLY=1 node scripts/test-scheduler-polling-local.cjs`: final
  polling/security checks passed after bounded health diagnostics were added.
- `node scripts/test-decision-transactions-local.cjs`: 31 repair checks plus
  26 existing native offer/security checks passed.
- Focused voting, scheduling and diagnostic checks: 32 passed.
- Full suite: 1,148 passed, 25 gated skips, zero failures. First attempt lacked
  Playwright; rerun used the existing external QA dependency via NODE_PATH.
- TypeScript passed after regenerating the local Prisma client for main's new
  EditorDraft model. The validate chain's earlier stale-client failure is not
  counted as a pass; typecheck was rerun separately.
- Lint: zero errors, 28 existing warnings. Production build, Prisma validation,
  authorization migration checks and git diff --check passed.
- Local authenticated Next HTTP: real Supabase Auth, voting read concurrent
  with cron publication, exactly one notification/outbox intent, private
  server-side Storage upload and authenticated browser write denial passed.
- Rendered Chrome QA: authenticated local voting draft/history and display
  controls loaded, continued refreshing, and keyboard opening/dismissal worked.
  Disabling the local synthetic account caused the next poll to clear protected
  content and show the account-unavailable state; the fixture was restored.
  No frontend layout changes were made.

Evidence outside Git: `/tmp/outclass-scheduler-final-polling.log`,
`/tmp/outclass-scheduler-fixed.log`, `/tmp/outclass-scheduler-transactions.log`,
`/tmp/outclass-scheduler-validation.log`, `/tmp/outclass-scheduler-typecheck.log`,
`/tmp/outclass-scheduler-build.log`, `/tmp/outclass-scheduler-focused.log`,
`/tmp/outclass-scheduler-http-qa.log`. Temporary synthetic fixtures and browser
QA scripts are excluded from the commit. Gated hosted/provider checks are not
passes. No production synthetic mutations were needed for this reproduction.

## Email-safe recovery and release prerequisites

Read-only inspection confirmed Production `COMMUNICATIONS_EMAIL_ENABLED=false`,
last updated before the currently serving artifact. Both canonical delivery and
optional invitation SMTP honor this explicit flag in the serving source. No
settings or delivery queues were changed. Do not instant-rollback to the earlier
email-enabled artifact: rollback retains that artifact's environment.

A recovery option is a NEW deployment of verified schema-compatible serving
source `1df2665284f9887613845f45dcc4c533ceeccd35`, explicitly built with the flag
false. Before any promotion, verify both channels return paused, runtime and
project identities, and no external test delivery. Alternatively, after approval,
release this repair with the same explicit disablement and controlled hosted
polling/cron verification. No recovery artifact was built/promoted in this pass;
these are gated options, not claimed verified deployments.

Production's read-only ledger has 51 completed migrations, latest
`20261013141510_scheduled_availability_requests`; current main has 52. This
repair adds no migration, but deployment from current main requires separately
reviewing/applying existing main prerequisite `20261015010000_editor_drafts`
before its code. Do not bypass the release guard. Vercel also showed a failed
newer branding deployment; its diagnosis is outside this scheduler repair.

Remaining limitations: repaired hosted cron/latency verification awaits an
approved deployment; provider-owner email verification remains unverified;
gated tests and existing lint warnings remain. No known local P0/P1/P2 defect
remains in this repair. Real write locks can still defer a club intentionally.

## Exact repair manifest (9 files; no migrations)

- actions/voting.ts
- app/api/internal/scheduled-communications/route.ts
- docs/scheduler-polling-starvation-repair.md
- scripts/test-scheduler-polling-local.cjs
- tests/decision-publication-native.test.cjs
- tests/helpers/voting-harness.cjs
- tests/scheduler-diagnostics.test.cjs
- tests/scheduler-polling-native.test.cjs
- utils/scheduled-communications.ts

The five untracked `scripts/credential-recovery/` files remain excluded and
unchanged. No production migrations, email enablement, deployment, credential
change, preference change, queue replay or real-applicant mutation occurred.
