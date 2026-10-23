# Active Interview Rooms and bounded concurrency follow-up

October 22, 2026. Audit reference: `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Measured application: `cffb63cff78c9694b89ed7e26a82d21edb5421e5`, including the user's intervening test/evidence commit. This follow-up changes benchmark tooling, tests and documentation only. It changes no application code, authorization, production infrastructure or database schema. Nothing was merged or deployed. Unrelated application edits appeared later in the shared workspace and were preserved; they are not included in the recorded production build or verified by these results.

[Comparison JSON](COMPARISON.json) · [build/test evidence](EVIDENCE.json) · [tooling/test patch](ACTIVE_WORKLOAD.diff).

## Fixture and method

The same reserved local Supabase project supplies real verified identities, live Auth sessions and PostgreSQL for both production Next builds. There are 100 submitted applicants in the active club, 64 memberships, three owner-attested rooms, 24 booked candidates, 24 sequential non-overlapping slots and 96 booking-managed grants. One owner and three separately verified reviewers each receive all 24 bookings. Reviewers have `applications.review`, `applicants.identify` and `interviews.manage`, making this a scheduling-capable coordinator workload. The existing database guards remain enabled during fixture creation. Published slot-panel versions are not represented.

The original base fixture has 61 members per club; the active club gains three reviewer accounts. Raw `fixture.membersPerClub=61` records that base count. The verified active count is 64. Credentials and cookies stay in memory or restricted disposable files outside the repository. Artifacts contain no payloads, identity values, SQL text or authentication headers.

There are **400 primary navigation observations**: 20 cold and 20 warm for one user per build; 20 cold and 20 warm waves of four users per build, yielding 80 observations per four-user condition. Concurrent observations share a wave and browser/CPU, so 80 observations are not 80 independent load trials. Cold means a fresh browser context and unvisited destination; server/database are warm. Reference cohorts precede current cohorts, without randomized alternation. Other local stacks remain running and untouched.

The existing benchmark's DOM predicate plus two animation frames measures click-to-useful-content. Each navigation additionally checks 24 room rows and 24 usable interview links. Preparation runs sequentially; a barrier releases the measured destination clicks together before their timestamps. No application delays, timers, animations or loading states were changed to affect the score.

Both builds use `connection_limit=8` in their **local process environment**. This is a [Prisma-client pool limit](https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/databases-connections/connection-pool), not a global server connection cap. A separate one-connection observer samples same-role PostgreSQL client backends every 50 ms, excluding itself. It records aggregate connection/state/lock counts only. Sampling may miss short waits and does not expose Prisma's queue length or pure pool/SQL/lock-wait durations.

## Before and after

All latency observations, including those with a browser error, remain in these nearest-rank distributions.

| Users / condition | Click→content p50 / p95, before → after | Requests per user, median | Network completion p50 / p95, before → after |
|---|---|---|---|
| 1 / cold | 497.7 / 563.0 → 448.2 / 496.8 ms | 15 → 8 | 672.3 / 805.3 → 427.3 / 476.2 ms |
| 1 / warm | 164.1 / 197.0 → 115.1 / 144.6 ms | 10 → 3 | 338.6 / 410.3 → 96.3 / 121.3 ms |
| 4 / cold | 628.5 / 752.4 → 551.8 / 627.8 ms | 15 → 8 | 1,103.7 / 1,411.0 → 526.6 / 594.2 ms |
| 4 / warm | 280.6 / 426.2 → 217.0 / 299.7 ms | 10 → 3 | 749.0 / 979.6 → 189.3 / 276.4 ms |

The three visible reads' dispatch-to-completion barrier falls from 133 / 168 to 91 / 115 ms p50/p95 for a warm single user, and from 248 / 380 to 183 / 270 ms for four warm users. This supports the earlier conclusion that reduced background work and concurrent visible reads shorten navigation waiting with active data too.

The additional reference requests include hidden room workspace, duplicate assigned rooms, availability overview, panel workspace, staffing coverage, booking publication and a workspace RSC request. Current warm navigation dispatches just the three visible GETs. This follow-up introduces no additional application optimization; it measures the existing Phase 1 change under a larger fixture.

## Payload and errors

| Users / condition | Before observed body bytes, median lower bound | After complete body bytes, median |
|---|---:|---:|
| 1 / cold | ≥153,622 | 44,041 |
| 1 / warm | ≥114,297 | 3,958 |
| 4 / cold | ≥150,940 | 44,040 |
| 4 / warm | ≥111,440 | 3,957 |

All 200 reference observations have at least one missing body-size counter after a browser cancellation, so **no complete reference payload median is available**. The before values sum only measured completed bodies and are lower bounds. All 200 current observations have complete body counters. Bytes exclude headers. Do not treat the before lower bounds as exact payload sizes.

There are zero HTTP errors in either build. Reference transport events are 54/58 for single-user cold/warm and 358/350 for four-user cold/warm. Every one is `net::ERR_ABORTED` after HTTP 200; all 24 room links still appear. These are browser cancellation observations, not failed content loads. Current observations contain zero transport failures or cancellations. The report does not infer that cancellation removal fixed an application error.

**Browser acceptance was not fully passing in these historical cohorts.** Reference has one `react_418` error in 200 primary observations; current has three in 200 (one single-user warm and two four-user cold). React identifies [error 418 as a hydration mismatch](https://react.dev/errors/418). Every affected observation still renders all 24 rows and links, and its latency remains included. Error counts cover the whole page lifetime, including initial Applicants loading and warm-up. The [hydration follow-up](hydration/HYDRATION_REPORT.md) now localizes and corrects an initial root-layout replay defect, with 400 clean follow-up observations; it does not alter these historical results. The category reproduces on the audit reference, but these small sequential cohorts cannot establish whether its frequency regressed. The benchmark commands correctly return nonzero for those browser errors.

An earlier four-user reference attempt stopped after an assertion with insufficient diagnostics. Its 55 saved observations and failure remain in `reference-4-incomplete/`, outside the primary cohort; the missing failed observation was not reconstructable. Enhanced diagnostics then collected the complete, predetermined 20-wave cohort without suppressing failures. The two eight-observation smoke runs remain in `smoke/` and `reference-smoke/`, also outside the primary distributions.

## Server and database observations

For the 240 visible GET requests in the current four-user warm cohort:

| Server phase | p50 / p95 ms |
|---|---:|
| Remote identity verification | 73.73 / 133.76 |
| Live session validity query | 1.44 / 4.10 |
| Awaited database operations | 17.18 / 112.94 |
| Transaction acquisition + BEGIN/transport | 0.98 / 3.03 |
| Whole transaction | 16.28 / 113.00 |
| Serialization, including compression where used | 0.30 / 0.81 |
| Buffered route response total | 102.84 / 213.74 |

Spans overlap and must not be summed. In this warm cohort acquisition maximum is 6.09 ms. Cold four-user acquisition p95/max is 9.05/35.34 ms. Server logs contain no Prisma error records, P2024 pool timeouts or P2028 transaction errors in either build.

The assigned-room read is the current visible critical path. Its four-user warm database phase is 85.18 / 132.93 ms, identity 74.96 / 130.51 ms and total 171.25 / 260.56 ms. Code inspection shows per-booking assignment, owner approval, interview-record and colleague lookups. This is evidence for investigating scoped batched projections next; it is not a measured SQL-count or causal production diagnosis.

Sampled reference connections peak at 16 despite the per-client limit of eight, consistent with multiple pools being used across server boundaries. Current connections peak at four for one user and eight for four users. Four-user reference lock-waiting backends peak at six; current has zero sampled lock-waiting backends. These are local sampled counts, not exact wait durations. Several concurrent transactions are observed between statements; no claim of a leaked transaction is made. No diagnostic SQL or pool changes were added to the application.

The tested four-user burst shows no timeout or sustained saturation signal at this local bound. It does **not** establish capacity for many browsers, published schedules, larger candidate sets, production cross-region latency or sustained traffic. Remote identity time and database time both grow under the four-user burst. Keep the browser bound of three; do not raise it from these results.

## Verification and recommendation

- Reserved fixture's existing real Auth/onboarding acceptance: **38 passed, 0 failed, 0 skipped**.
- New real HTTP active-room tests: **3 passed, 0 failed, 0 skipped**. Four distinct accounts receive valid private/no-store responses and unique traces. Revoking one booking grant removes the candidate from both subsequent resources, leaves other reviewers authorized and restores correctly afterward.
- Benchmark percentile/privacy/output-preservation tests: **3 passed**. Changed tooling/test files pass lint and whitespace checks. The fixture rejects a mismatched database connection before constructing a database client or signing up users. Active measurements require a new output subdirectory and refuse to overwrite existing samples or the original audit.
- Primary benchmark: all **400** observations reach the content predicate and retain 24 interview links; browser errors above prevent a blanket acceptance pass. No production source changed, so the earlier full unit/native results remain historical; a full broad run was not repeated for this tooling-only follow-up.

Recommendation: retain Phase 1's request reduction and bounded GET dispatch. The [subsequent hydration correction](hydration/HYDRATION_REPORT.md) has clean local acceptance but demonstrates no additional navigation speedup; obtain an isolated crossover for its higher measured latency before release. Then investigate batched assigned-room projections within the existing authorization transaction and the remaining cold component/data waterfall. Continue to verify remotely confirmed identity, live session revocation, enabled accounts, membership, capability, support, suspension and anonymity checks on every request. A larger published-schedule/mobile/sustained-load cohort is still needed before making a production capacity claim. No merge or deployment is authorized by this report.

Reproduction, after starting the existing reserved fixture and seeding navigation data:

```sh
node scripts/run-onboarding-e2e.cjs --keep
node scripts/navigation-audit.cjs --active-rooms --seed
node scripts/phase1-workload-build.cjs reference
node scripts/navigation-audit.cjs --active-rooms --clients=1 --samples=20 --out=docs/performance/phase1/active-workload/reference-1
node scripts/navigation-audit.cjs --active-rooms --clients=4 --samples=20 --out=docs/performance/phase1/active-workload/reference-4
node scripts/phase1-workload-build.cjs current
node scripts/navigation-audit.cjs --active-rooms --clients=1 --samples=20 --out=docs/performance/phase1/active-workload/current-1
node scripts/navigation-audit.cjs --active-rooms --clients=4 --samples=20 --out=docs/performance/phase1/active-workload/current-4
node scripts/summarize-active-navigation.cjs
```

Preserve nonzero benchmark exits and raw failure records. Choose new output subdirectories when reproducing; existing samples are protected. Run the setup build again after changing application sources: the current profile starts that existing production build. Reserved services, credential fixtures and the temporary audit build were removed after collection; unrelated local stacks were left intact. See cleanup evidence in `EVIDENCE.json`.
