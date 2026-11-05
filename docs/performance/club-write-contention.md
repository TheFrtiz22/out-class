# Club-wide write contention (2026-11-04)

## Finding

`authorizeClubTransaction` (non-read-only) and `lockOperationalClub` take
`SELECT … FROM "Club" WHERE id=… FOR UPDATE`. Every write that uses them is
serialized club-wide for the whole transaction. Each statement in that
transaction crosses iad1 → us-west-2 (~70 ms), so a 9–15 statement write holds
the club row for roughly 0.6–1 s. `clubWriteTransaction` sets
`lock_timeout = 3s`, so contended writes fail instead of queueing.

## Measurement

`node scripts/run-contention-benchmark.cjs` (disposable Docker PostgreSQL;
real locks, constraints and transactions; a Prisma extension adds the round
trip to every statement while locks are held). N students save a draft for the
same club at once through the real `saveApplicationDraft`. Set
`OUTCLASS_CONTENTION_BASELINE_REF=<ref>` to also measure an earlier version
(it must compile against the current schema; the table below compared
`origin/main` before the re-application migration).

| Students | Round trip | `main` (club `FOR UPDATE`) | This change (club `FOR SHARE` + student row lock) |
|---|---|---|---|
| 20 | 0 ms | 20/20, p95 191 ms | 20/20, p95 29 ms |
| 20 | 70 ms | **7/20 saved, 13 failed `55P03`**, p95 4.0 s | 20/20, p95 683 ms |
| 50 | 2 ms (co-located) | 50/50, p95 2.4 s | 50/50, p95 120 ms |
| 50 | 70 ms | **12/50 saved, 38 failed `55P03`**, p95 6.8 s | 50/50, p95 1.37 s |

Co-locating functions with the database (pdx1) helps but leaves `main` close
to the 3 s lock timeout under a larger burst; the lock change is needed either
way.

## Change (applications only)

`persistApplication` now takes the club row `FOR SHARE` (through
`assertClubOperational`) and the student's own `User` row `FOR UPDATE`:

- Leader configuration changes, decisions and suspension take the club row
  exclusively, so they still serialize with student saves (verified in the
  benchmark's leader-lock subtest and the native suspension test).
- Different students no longer block each other.
- One student's concurrent tabs stay ordered; no unique-constraint error on
  simultaneous first saves (benchmark subtest).

## Not changed yet

Bookings and RSVPs rely on the club lock for capacity counts. Live-voting
ballots also take the club row exclusively and serialize on the session row,
whose `revision` guards leader decisions. Each needs its own analysis and
benchmark before changing.
