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
