# Live voting ballot contention (2026-11-05)

`node scripts/run-contention-benchmark.cjs` (`tests/voting-ballot-contention-native.test.cjs`):
one open live-voting room, N eligible voters all casting for the current applicant at
once through the real `clubWriteTransaction` (3 s lock timeout). Disposable native
PostgreSQL as `outclass_production_app`; each statement pays the simulated round trip.
2 ms ≈ production (`pdx1` functions, `us-west-2` database). Compare against another ref
with `OUTCLASS_CONTENTION_BASELINE_REF=origin/main`.

## Change

`castLiveVotingBallot` took the club row `FOR UPDATE` before anything else, so every
voter's authorization queries also ran one at a time. Ballots now take the club row
`FOR SHARE` (`authorizeClubTransaction(..., { sharedClubLock: true })`). Unchanged:
- ballots in one session still serialize on the `VotingSession` row and still bump its
  revision (leader commands keep their compare-and-set on the revision the leader saw);
- membership, permission and suspension changes and leader commands take the club row
  exclusively, so they still exclude in-flight ballots;
- lock order (club, then session) is the same, so no new deadlock path.

## Results (all ballots recorded exactly once in every run)

| RTT | Voters | p50 main → branch | p95 main → branch | max main → branch |
|---|---|---|---|---|
| 0 ms | 15 | 120 → 50 ms | 216 → 89 ms | 216 → 89 ms |
| 0 ms | 40 | 202 → 157 ms | 426 → 250 ms | 433 → 255 ms |
| 0 ms | 80 | 342 → 255 ms | 636 → 453 ms | 657 → 468 ms |
| 2 ms | 15 | 430 → 261 ms | 827 → 513 ms | 827 → 513 ms |
| 2 ms | 40 | 1197 → 756 ms | 2239 → 1752 ms | 2294 → 1782 ms |
| 2 ms | 80 | 2397 → 1442 ms | 4522 → 2735 ms | 4697 → 2848 ms |

## Not changed (needs the voting owner's decision)

Within a session, each ballot still holds the session row for ~35 ms at 2 ms RTT,
mostly because it re-loads the whole room (all passes, candidates and ballots) and bumps
the session revision. Running ballots in parallel would mean ballots stop bumping the
session revision (clients already poll full snapshots every 5 s and do not use the
revision to skip updates), taking the session row `FOR SHARE` plus a per-voter lock.
That changes the rule that a leader command applies only to the exact tally they saw,
so it is left for the voting design owners.
