# Interview self-booking contention (2026-11-05)

`node scripts/run-contention-benchmark.cjs` (`tests/interview-booking-contention-native.test.cjs`).
Each club's round is made bookable through the real leader workflow (generate → review →
publish panel schedule, publish booking for the cycle); the test confirms every slot is
offered to students, then all invited students call `reserveInterview` at once for distinct
slots. Disposable native PostgreSQL as `outclass_production_app`; each statement pays the
simulated round trip (2 ms ≈ production). Measurements only; no product code changed.

## Results (main `5a8ba829`; every booking stored once, no slot over capacity)

| RTT | Students | Clubs | p50 | p95 | max |
|---|---|---|---|---|---|
| 0 ms | 20 | 1 | 571 ms | 1046 ms | 1046 ms |
| 0 ms | 20 | 3 | 491 ms | 895 ms | 895 ms |
| 0 ms | 60 | 1 | 1800 ms | 3197 ms | 3301 ms |
| 0 ms | 60 | 3 | 1130 ms | 2091 ms | 2170 ms |
| 2 ms | 20 | 1 | 1652 ms | 3085 ms | 3085 ms |
| 2 ms | 20 | 3 | 1606 ms | 2920 ms | 2920 ms |
| 2 ms | 60 | 1 | 4885 ms | 9650 ms | 9988 ms |
| 2 ms | 60 | 3 | 4728 ms | 8891 ms | 9219 ms |

Independently reproduced (two separate runs agree within ~5%).

## What limits it

1. **One booking at a time, platform-wide.** `reserveInterview` first takes
   `panelPublicationLock` (`pg_advisory_xact_lock(197918, 3)`), shared by every booking and
   panel publication in every club. Spreading 60 students over 3 clubs barely helps
   (9.2 s vs 10.0 s). With that lock removed in a throwaway copy, 60 students over 3 clubs
   finished in 3.4 s instead of 9.2 s; a single club was unchanged because the club row
   (`lockOperationalClub`, FOR UPDATE) already serializes it.
2. **Each booking is expensive while holding the locks:** ~41 statements, including
   `interviewBookingCoverage` rebuilding the club's planning scene, ~155 ms per booking at
   2 ms RTT.
3. **No lock or statement timeout** (`atomic`: 60 s transaction, 15 s connection wait).
   Larger bursts queue rather than fail fast, holding pooled connections while waiting.
   No failures were observed at these sizes.

Within one club, serialization is required for correctness: whether a slot is still fully
staffed depends on other bookings that share interviewers. Cross-club, the global lock
protects people who appear in more than one club (e.g. a student who is also a panelist
elsewhere). Changing either is a scheduling design decision; see the options recorded in
the owner report.

## Change (branch `backend/booking-throughput`)

The platform-wide advisory lock is replaced by per-person locks
(`lockSchedulingPeople` in `utils/panel-publication.ts`):

- **Reservations** (`reserveInterview`, legacy `bookInterviewSlot`): club row `FOR SHARE`,
  then in one sorted-id order the student's User row `FOR UPDATE` and the target session's
  official panelists `FOR SHARE`, then the session row `FOR UPDATE`; capacity is read only
  after that lock. Reservations in the same club no longer wait for each other unless they
  are for the same session or the same student.
- **Club-wide changes** (panel publication, room panel approval, reopening a room, manual
  panel grants) keep their exclusive club lock and lock, exclusively and in the same order,
  the people whose official commitments they add. Panel publication already did this.
- Draft-only operations (availability overrides) and booking publication keep only their
  exclusive club lock: publication re-validates with people locked, and booking publication
  checks panels that were conflict-checked across clubs when published.
- Removing commitments (cancel, close a room, replace a panel member) only frees time, so it
  needs no person lock.
- `atomic()` (interview rooms) now sets an 8 s lock timeout, 20 s transaction timeout and 10 s
  connection wait (was 60 s / 15 s, no lock timeout); contention is reported as "Many people
  are scheduling right now… Please try again."

## Results after the change (same benchmark)

| RTT | Students | Clubs | max before | max after |
|---|---|---|---|---|
| 0 ms | 20 | 1 | 1046 ms | 263 ms |
| 0 ms | 20 | 3 | 895 ms | 142 ms |
| 0 ms | 60 | 1 | 3301 ms | 1218 ms |
| 0 ms | 60 | 3 | 2170 ms | 719 ms |
| 2 ms | 20 | 1 | 3085 ms | 257 ms |
| 2 ms | 20 | 3 | 2920 ms | 446 ms |
| 2 ms | 60 | 1 | 9988 ms | 1364 ms |
| 2 ms | 60 | 3 | 9219 ms | 620 ms |

Every booking stored exactly once and no session over capacity. New race tests in the same
file: two students racing for the last seat (exactly one booked) and one student booking
overlapping interviews in two clubs at once (exactly one booked). Removing the session lock
makes the first fail (the database capacity trigger then rejects the second booking with a
raw error), so the test detects that regression.

Former residual, fixed (2026-11-05, completed 2026-11-11 on `backend/panel-assignment-retry-pr`):
manual panel grants and room panel approval hold the acting owner's User row before the sorted
person lock, so two owners in different clubs granting or approving each other at the same moment,
or a grant racing a reservation that locks the same two people in sorted order, form a lock cycle.
PostgreSQL detects it within ~1 s and aborts one side. Every path that takes these person locks now
re-runs a transaction PostgreSQL aborted as a deadlock (40P01) or serialization failure (40001)
through `retryTransactionConflict` (`utils/club-write-transaction.ts`): at most 3 attempts, whole
transaction each time, 25 ms then 50 ms backoff plus up to 25 ms jitter. Lock timeouts (55P03),
statement timeouts (57014) and Prisma transaction timeouts (P2028) are not retried.

| Path | Before | Now |
|---|---|---|
| `setInterviewPanelAssignment` (manual grant) | 40P01 retried (no backoff) | retried; returns a typed `{ ok: false }` result: exhausted → "Someone else just changed this. Try again.", lock/transaction timeout → "This is taking longer than usual. Try again in a moment." |
| `approveInterviewRoomPanel` (room panel approval) | not retried, raw error | retried; same typed results |
| `atomic()` in `actions/interview-rooms.ts` (`reserveInterview`, reopen room, room edits) | only Prisma P2034 retried; 40P01 from a raw `FOR UPDATE` was reported as contention without a retry | retried; existing "schedule changed" / "Many people are scheduling" wording kept |
| Panel publication `operation()` | only P2034 retried | retried; existing retained-draft wording, or the calm message |
| Legacy `bookInterviewSlot` | only P2034 retried, no backoff | shared wrapper; existing "That time changed" wording |

The two owner actions return contention as a typed result (`contentionResult`, `lib/write-contention.ts`)
because production masks thrown server-action messages; the access-setup UI unwraps it so owners
see the real wording. Every path logs a structured server warning when it gives up:
`{"event":"write.contention.exhausted","path":…,"kind":"conflict"|"timeout","code":…}`, with the
Prisma or SQLSTATE code only (no IDs, PII or messages).

Exactly-once: the rolled-back attempt leaves no rows, so the re-run creates one grant (upsert on
`applicationId_roundId_memberId`), one assignment notice (`createMany` with `skipDuplicates`) and
one audit row, all written inside the same transaction. Room approval re-checks
`panelApprovalRevision`, which a partial commit would have advanced. No email or other side effect
runs inside the retried function.

Tests: `tests/write-contention-errors.test.cjs` (classification, one re-run on 40P01/40001, no retry
on lock or statement timeout, stop after N, calm message without database detail, backoff and
jitter, typed results, the structured log). `tests/organization-members.test.cjs` checks the grant
action end to end: deadlock retried 3 times, timeouts once, distinct wording, one log line each.
`tests/interview-native-concurrency.test.cjs` reproduces both cross-club cycles on real
PostgreSQL, asserts a conflict was actually raised, and checks one grant, one notice and one audit
row per club; without the retry one side fails with 40P01. It runs only in CI (`security` suite of
`scripts/run-disposable-postgres.cjs`, `disposable-integrations.yml`, every PR); the fixture does
not support Windows. A grant-versus-`reserveInterview` cycle is covered by the same wrapper but has
no native reproduction yet.

Authorization review (2026-11-05, read-only `authz-reviewer`, base bd3e12d3): no high or
medium findings. Two low findings fixed before merge: an applicant without an interview
invitation is refused before any panelist lock, and the session row lock is scoped to the
applicant's club (`AND "clubId" = …`).
