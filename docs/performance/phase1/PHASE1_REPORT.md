# OutClass navigation performance — Phase 1

October 22, 2026. Audit reference and initial implementation HEAD: `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. The continuation began at `31096ad70c5255372ed6a6c7dedd805743f3d779`, which already contained Phase 1; that commit and all subsequent application changes were preserved. The original audit, roadmap and benchmark JSON remain intact. No merge, deployment, production configuration, database region, schema or index changes occurred.

## Implementation

[Measured implementation patch](IMPLEMENTATION.diff) · [test-only continuation patch](NATIVE_SECURITY_FOLLOWUP.diff) · [machine-readable comparison](COMPARISON.json) · [native security result](NATIVE_SECURITY_RESULT.json).

- `/api/workspace` now emits a server-generated random trace ID and bounded `Server-Timing` aggregates. Optional `OUTCLASS_PHASE_TRACE=1` emits one sanitized structured record containing only the trace ID, HTTP status, fixed phase labels, counts and numeric durations. It never records SQL, query parameters, cookies, tokens, identities, request URLs, response bodies or exception details.
- Scheduling mounts on first selection. Its owner survives interview-tab and scheduling round/week URL changes; kit/access editors retain their round-specific keys. A retained scheduler performs a fresh live read before reappearing, keeping its existing editor mounted but concealed while validation is pending or denied. The leave guard exempts the retained scheduler while continuing to protect other editors.
- Assigned-room consumers share only pending promises within the mounted identity/session/club/grant/privacy/support/Demo scope. Auth token changes rotate an opaque browser epoch. Successful responses and authorization results are never cached by this owner. Mutation/round events fence earlier responses; serialized refreshes drain older reads before reloading. Unmounts and authority changes discard late results.
- Explicit, validated GET entries replace navigation read actions for assigned rooms, interview workspace/rounds, scheduling workspace, booking publication, tasks, meetings, announcements and durable notifications. They call the original guarded loaders. Mutations remain Server Actions. Voting loaders and their two snapshot-boundary authorization checks were not consolidated.
- Browser workspace GET dispatch is capped at three, with a bounded queue of 24 and a 30-second deadline that includes queue time. Cancelled queued work never dispatches. There is no response cache, new library, Redis or new application service.
- Large successful JSON responses negotiate gzip using Node's built-in compressor; small responses remain uncompressed. `Vary` retains `Cookie` and adds `Accept-Encoding`. All private responses retain `private, no-store`; cookie refresh and Demo rejection remain at the existing boundaries.

## Measurements

These are local production-build measurements using the existing harness, the same disposable real Supabase Auth/PostgreSQL fixture, Chromium 156 and 1440×1000 desktop viewport. Each latency group has 20 samples and nearest-rank percentiles. “Cold” means a fresh browser context and unvisited destination; the server/database are warm. No CPU/network throttling or application loading delay was added. Cohorts ran sequentially rather than in randomized alternation; the initial Auth acceptance run was finishing during baseline collection, so machine/Docker load is a confound. The fixture has 61 memberships and 100 submitted applicants per club, with **empty room assignments**. It does not reproduce the reported five-second production transition.

Click-to-useful-content is a DOM predicate plus two animation frames. Response-body bytes exclude headers. The final-source quiet cohort is `verified-bookmarks`; `verified` is the preceding quiet performance cohort. Both are retained. The earlier `final` confirmation overlapped verification during its last warm samples and is retained separately. Intermediate source stages were not committed; [build/patch evidence](BUILD_EVIDENCE.json) identifies the final build and patch.

### Interview Rooms: before → final quiet cohort

| Metric | Cold before → after | Warm before → after |
|---|---:|---:|
| Click→useful content p50 | 447.9 → 413.6 ms | 114.5 → 81.6 ms |
| Click→useful content p95 | 464.4 → 447.1 ms | 131.1 → 125 ms |
| Requests, median | 13 → 8 | 8 → 3 |
| Response-body bytes, complete samples, median | 94,051 → 40,321 | 54,761 → 238 |
| Non-SSE network completion p50 | 525.2 → 380.9 ms | 183.5 → 58.1 ms |
| Non-SSE network completion p95 | 557.6 → 418.6 ms | 226.9 → 105.6 ms |
| Three visible reads' dispatch→completion barrier p50 | 109 → 59 ms | 84 → 52 ms |
| Per-visible-read TTFB p50 | 31.49 → 56.58 ms | 27.32 → 50.13 ms |
| HTTP failures | 0 → 0 | 0 → 0 |

The gain comes from removing five unused/duplicate reads and overlapping the three visible reads. Individual requests did **not** become faster; parallel provider/database work increased their observed TTFB. The browser acceptance test observed exactly three overlapping Rooms GETs, no scheduler mount, and successful rapid navigation. The browser queue separately proves a maximum of three dispatches under a larger burst.

Payload comparisons use only samples with every body-size counter available: baseline cold n=13/warm n=11; final n=20 each. Baseline also recorded 11 cold and 12 warm `requestfailed` events after HTTP 200, with no failed useful-content predicates. Their failure reasons were not captured, so these are **unclassified transport events**, not proven application errors or a claimed error-rate improvement. Later harness runs record a sanitized Chromium failure reason. All final Rooms requests completed without such events.

**Tail risk retained:** warm maximum rose from 131.3 to 291.3 ms in one of the 20 samples in the earlier quiet cohort. The final-source cohort has warm maximum 130.9 ms and cold maximum 480.4 ms. The earlier 291 ms sample’s three correlated requests had 203–215 ms server totals, 156–169 ms identity verification and 31–55 ms aggregate database operation time; acquisition remained below 2 ms. The sample was not excluded. This identifies slower server phases but does not establish a production cause. The earlier cold maximum was 415.1 ms, versus 531.1 ms at baseline. This variation is a reason to avoid promising a tail-latency improvement from a small local cohort.

### Staged attribution

| Build stage | Cold p50 / p95 | Warm p50 / p95 | Cold / warm requests |
|---|---:|---:|---:|
| Reference baseline | 447.9 / 464.4 | 114.5 / 131.1 | 13 / 8 |
| Tracing only | 463.8 / 480.1 | 114.3 / 130.4 | 13 / 8 |
| Lazy Scheduling | 448.0 / 497.0 | 114.3 / 131.8 | 8 / 3 |
| Scoped pending reads | 447.9 / 464.2 | 114.6 / 181.1 | 8 / 3 |
| GET transport, before gzip | 397.6 / 414.6 | 80.7 / 97.3 | 8 / 3 |
| Quiet performance cohort | 397.5 / 414.5 | 81.1 / 82.2 | 8 / 3 |
| Final source, retained round bookmarks | 413.6 / 447.1 | 81.6 / 125 | 8 / 3 |

Tracing is observability, not a demonstrated speedup; its cold median was about 16 ms higher in this small cohort. Lazy mounting primarily removes background work: visible-content timing stayed effectively unchanged while warm network completion fell about 92 ms. Pending sharing adds no further ordinary Rooms request reduction after lazy mounting already removed the second consumer. Its isolated warm tail worsened; these samples do not establish a causal latency benefit from deduplication. Deduplication is verified under overlapping calls and invalidation, not claimed as an additional speedup on the empty single-consumer path.

GET transport produced the demonstrated waiting-time reduction. Revalidation before scheduler reveal is required for security and draft continuity; it is not a cosmetic optimization or an authorization cache.

### Other converted navigation reads

| Path / condition | Before p50 / p95 ms | Final p50 / p95 ms | Requests before / after | Complete body bytes before / after, median |
|---|---:|---:|---:|---:|
| members → meetings / cold | 64.3 / 80.7 | 63.9 / 64.8 | 1 / 1 | 337 / 397 |
| members → meetings / warm | 64.2 / 65.7 | 64.6 / 81.1 | 1 / 1 | 337 / 397 |
| meetings → tasks / cold | 397.4 / 399 | 396.8 / 413.5 | 3 / 3 | 25,581 / 25,812 |
| meetings → tasks / warm | 65.9 / 81.7 | 80.1 / 94.2 | 1 / 1 | 4,094 / 4,328 |
| tasks → announcements / cold | 381.1 / 397.4 | 381.7 / 447 | 2 / 2 | 5,068 / 5,032 |
| tasks → announcements / warm | 64.5 / 65.8 | 64.2 / 80 | 1 / 1 | 252 / 255 |

There is no consistent material useful-content gain on these single-read tabs. Their cold dynamic-import/mount cost remains, with percentile variation between cohorts. Gzip reduces Tasks from its intermediate 18,981-byte uncompressed median to 4,328 bytes, leaving a 234-byte (5.7%) increase over the original action. Meetings adds 60 bytes and Announcements adds three; these small responses intentionally remain uncompressed. All final groups have zero HTTP failures, transport failures and failed navigation predicates.

### Serialization regression and correction

The initial Tasks GET conversion increased observed response-body bytes from about 4 KB to 19 KB without a useful-content gain. A same-build transport probe confirmed the cause: the Server Action returned `text/x-component` with gzip (18,914 decoded bytes), whereas GET returned uncompressed JSON (18,968 decoded bytes). See [the probe](task-transport-probe.json). Negotiated gzip corrects the substantial transport-size regression; the final comparison records its remaining byte/CPU tradeoff rather than hiding it. On warm Tasks requests compression p50/p95 was 0.23/0.42 ms and total serialization 0.49/0.91 ms. Default GET readers still decode the same wire dates and JSON.

### What the server spans actually measure

Final warm Rooms requests (60 requests across 20 samples) have these p50/p95 values:

| Span | p50 / p95 ms | Meaning |
|---|---:|---|
| Identity | 36.74 / 61.69 | Original remote `getUser` verification |
| Live session | 0.66 / 1.42 | Original `auth.sessions` validity/revocation query |
| Database | 6.09 / 13.43 | Awaited Prisma operation time, including transport/implicit pool waits |
| Transaction acquisition | 0.39 / 0.67 | Interactive transaction invocation → callback entry; includes BEGIN/transport |
| Lock-bearing query | 1.3 / 2.92 | Awaited `FOR SHARE`/`FOR UPDATE`/advisory statement time, including execution/transport |
| Transaction | 6.21 / 15.67 | Whole interactive transaction, including acquisition/commit |
| Serialization | 0.06 / 0.12 | Wire encoding + JSON response construction, including negotiated compression when used |
| Total | 46.33 / 76.89 | Route invocation → complete buffered response construction |

These spans overlap and must not be summed. This instrumentation cannot separate pool-only acquisition for ordinary queries, pure PostgreSQL execution time or exact lock-wait time through its current Prisma 6 query boundary. No engine-global event was assigned speculatively to a request. There are no extra diagnostic SQL statements or lock/config changes. The query hook uses the documented [Prisma 6 query-extension boundary](https://www.prisma.io/docs/orm/v6/prisma-client/client-extensions/query); identity continues to use [remote Supabase getUser verification](https://supabase.com/docs/reference/javascript/auth-getuser). Total excludes Next/platform overhead and network transfer; browser TTFB/transfer are recorded separately. This boundary instruments workspace GET reads, not every RSC response, mutation or SSE lifetime.

## Verification

| Check | Result |
|---|---|
| Full existing test run, serialized files | 1,339 tests: **1,304 passed, 0 failed, 35 environment-gated skips** |
| Final affected Phase 1 regression run, after gzip | **23 passed, 0 failed, 0 skipped** |
| Final real Next/Auth/PostgreSQL/browser run | **55 passed, 0 failed, 0 skipped**: onboarding, account data, captured-cookie revocation, signup privacy, student claims, settings and new Phase 1 GET/navigation checks |
| Native PostgreSQL security suites, corrected test fixture | **3 passed, 0 failed, 0 skipped** on current HEAD plus the test-only continuation, and **3 passed, 0 failed, 0 skipped** on the audit reference with the same test overlay |
| Onboarding and invitation unit follow-up | **27 passed, 0 failed, 0 skipped**; changed test file also passes lint |
| Authoritative migration regression check | Passed: all 57 migrations, fresh/legacy data, 78 tables with RLS/browser-role denial |
| Local Next production build | Passed against reserved local service URLs |
| TypeScript / lint / whitespace diff | Passed; lint has 0 errors and 26 warnings |
| Accepted staged browser measurements | **840 samples**; 20 per accepted path/condition; no navigation-predicate failures |

The final focused run covers negotiated compression, trace isolation/redaction, malformed GET arguments/unknown dispatch, no authorization-result caching, pending-read coalescing/invalidation, bounded dispatch/cancellation, scheduler dirty-state continuity, fresh reveal validation/denial, rapid switching and session-epoch rotation. A further six-test HTTP follow-up also exercises the unchanged voting snapshot loader through tracing. The real HTTP run additionally checks anonymous round projection, cross-club denial, capability removal, suspension, disablement and revoked captured-cookie replay. Full-suite skips were not silently treated as passes; selected real Auth and native suites were run separately as shown above.

The final scheduler/bookmark browser follow-up passed five tests, including restoring a round selected while the scheduler was concealed.

The full broad run preceded the final gzip response helper and round-bookmark follow-up; the affected unit/transport/browser/HTTP runs and final production build were then repeated on the final application source. The continuation changes only the native onboarding test and evidence. Its targeted unit/native checks were rerun; application benchmarks and the production build were not repeated because application sources did not change.

Commands (all data-bearing tests use guarded disposable local configurations):

```sh
node scripts/run-onboarding-e2e.cjs --keep
node scripts/navigation-audit.cjs --seed
node --test --test-concurrency=1 tests/*.test.cjs
node --test tests/server-phase-trace.test.cjs tests/workspace-response.test.cjs tests/workspace-read-transport.test.cjs tests/in-flight-workspace-reads.test.cjs tests/performance-regressions.test.cjs tests/interview-tab-retention-browser.test.cjs
# With OUTCLASS_ONBOARDING_E2E_CONFIG pointing to the reserved local config:
node --test --test-concurrency=1 tests/navigation-phase1-e2e.test.cjs tests/onboarding-e2e.test.cjs tests/account-data-e2e.test.cjs tests/session-revocation-e2e.test.cjs tests/signup-privacy-e2e.test.cjs tests/student-claim-e2e.test.cjs tests/settings-navigation-e2e.test.cjs
node scripts/run-disposable-postgres.cjs security
npm run test:migrations
npm run typecheck
npm run lint
node scripts/phase1-local-build.cjs
node scripts/navigation-audit.cjs --phase1 --cold-warm --samples=20 --out=docs/performance/phase1/reproduction
node scripts/summarize-phase1-navigation.cjs
```

The macOS-only native test relay preserves the existing server-loopback assertions, uses pinned test images, publishes only localhost, and cleans up its labeled disposable containers. Linux retains its existing host-network fixture. It does not alter a production service.


**Correction to the initial report:** the original failure at `tests/onboarding-concurrency.test.cjs:28` was two retries of the **same invitation**, not competing claims from different recipients. The application already intentionally accepts an authorized retry, and its existing unit test expects two successful responses with one membership write and one acceptance audit. The native test now checks that contract against PostgreSQL: two matching responses, one accepted invitation, one active owner membership and one acceptance audit. No authorization or locking behavior was changed.

The now-reachable separate competing-invitation case verifies exactly one successful claim, a losing claim rejected because the organization already has an owner, one owner, one accepted invitation and one acceptance audit. A second stale fixture assumption surfaced afterward: the disposable runner explicitly disables email, while the test expected its mocked sender to run. The test now verifies that delivery pauses with all 50 entries untouched, then enables only its existing in-memory sender inside a restored environment scope and verifies unique delivery claims. No SMTP module or external sender is used.

All three native suites now pass, including later duplicate-import, mail-delivery, simultaneous owner-disablement, ownership-transfer and interview concurrency checks that the original failure prevented from running. All three also pass with the same corrected test and macOS runner overlaid onto an otherwise unchanged archive of the audit reference. Historical failure details and the final current/reference results are retained in [native security evidence](NATIVE_SECURITY_RESULT.json) and the [sanitized test log](NATIVE_SECURITY_FOLLOWUP.log). Both disposable database runs and the temporary audit archive were cleaned up.

The final broad run passed after updating isolated browser/React fixture mocks to the new read transports and observer, and removing a duplicate hidden error message exposed by the scheduler concealment guard. These were verified and corrected; failed development attempts are not presented as accepted benchmark data.

## Active-room continuation

The [active workload report](active-workload/ACTIVE_WORKLOAD_REPORT.md) adds 400 primary observations against the audit reference and measured application commit `cffb63cff78c9694b89ed7e26a82d21edb5421e5`, preserving the intervening user commit. It uses 24 booked candidates, three rooms, four independently verified accounts and a local per-Prisma-client pool limit of eight. This continuation changes only tooling, tests and evidence. Subsequent unrelated application edits in the shared workspace were preserved and are not covered by these build-specific measurements.

Four-user warm navigation improves from **280.6 / 426.2 to 217.0 / 299.7 ms p50/p95**, with **10 → 3 requests per user**. Four-user cold improves from 628.5 / 752.4 to 551.8 / 627.8 ms. Current warm body bytes are complete at 3,957 median; reference payload counts are incomplete and reported as lower bounds. No current HTTP/transport failures or Prisma timeout records occur. Sampled connections peak at eight current versus 16 reference; the limit is per client, not a global cap. These bounded local results do not establish production capacity.

**These historical cohorts had a browser acceptance issue:** React hydration error 418 occurs once in the reference's 200 primary observations and three times in the current application's 200. All 24 interview links still render, and these samples remain in the timing distributions. At that stage the component and timing were unresolved; frequency cannot be attributed to Phase 1 from those cohorts. Benchmark commands correctly return nonzero for those errors. The initial incomplete reference run is preserved separately. The active-resource HTTP/revocation suite passes three tests; the reserved Auth fixture passes 38 existing tests.

## Hydration correction and current HEAD verification

The [hydration follow-up](active-workload/hydration/HYDRATION_REPORT.md) localizes the mismatch to initial root-layout hydration and reproduces the installed React runtime's host-fiber replay bug. A two-file layout change gives pending streamed children their own component fiber, preserving the same DOM, SSR, loading boundary and server authorization. Its deterministic browser regression proves the control fails and the fix retains the original server node in both installed React and Next's bundled runtime.

All **400 follow-up navigations** pass with zero browser/HTTP/transport failures and all 24 authorized interview links. Request counts remain eight cold and three warm. This correction does **not** demonstrate another navigation speedup: the comparable follow-up's cold p50/p95 is 531.0/636.2 ms and warm is 214.9/345.4 ms, higher than its diagnostic baseline. The report retains the increase, fixture reseeding and overlapping test activity as limitations rather than attributing an improvement to the fix. Original performance cohorts remain unchanged.

Current HEAD `43bb46429c817a2a0110a85475268cdf917b5e65` and the later application-writing/logo changes are preserved. They receive a separate production build and acceptance run with the hydration fix; performance numbers remain explicitly scoped to the frozen earlier application. The full workspace suite passes 1,321 tests with 37 gated skips. Exact build, Auth/browser, focused regression and cleanup results are linked from the follow-up.

## Current-HEAD crossover — October 23

The [counterbalanced wrapper study](active-workload/crossover-2026-10-23-repeat/CROSSOVER_REPORT.md) freezes current HEAD `97db164e133809ab2852d7ebcc946b2e92ef1d4f` and changes only the route wrapper in a private control. It uses one unchanged live fixture, four AB/BA pairs, a separate same-build pair, predeclared warm-ups and clustered uncertainty estimates. No production application code changed in this continuation.

The complete repeat has **320 primary, 80 same-build-control and 80 warm-up observations**, all with 24 links and zero browser/HTTP/transport errors. Current-fixed versus unfixed-control p50/p95 is 517.1/536.4 versus 516.1/547.3 ms cold and 182.0/216.7 versus 182.5/196.9 ms warm. The earlier large increase is not reproduced at that magnitude, but warm p95 remains 19.8 ms higher with a descriptive paired interval of −13.3 to +46.9 ms. A same-build warm p95 change of 16 ms demonstrates ordinary variation without proving the A/B difference is noise. There is no additional speedup or equivalence claim.

The incomplete first attempt is retained separately: two initial recoveries occur in its unfixed control, followed by an unclassified control warm-up timeout. It is not pooled into the complete repeat. The full suite passes 1,325 tests with 37 gated skips; ten focused checks and both setups' 38 real Auth tests pass. All private resources are cleaned up. Request counts remain eight cold and three warm; next work should target the assigned-room projection barrier and production-like coverage.

## Risks and next phase

1. Extend the current-HEAD crossover with a larger production-like cohort before ruling out a smaller warm-tail regression. The earlier large increase did not repeat, but four pairs on a shared host do not establish equivalence. The initial-hydration correction is verified; published schedules, mobile, sustained workloads and the unclassified first-control warm-up timeout remain coverage limits.
2. Obtain correlated production slow-navigation traces and test published schedules/larger sustained workloads. The local active four-user cohort now supplies bounded evidence, but many browsers still share the server pool. Local acquisition measurements do not establish production capacity or remove cross-region latency.
3. Investigate batched assigned-room lookups within their current authorization transaction, authorized intent-based component/data loading and narrower pipeline/task/directory projections. Single-read tabs retain their cold dynamic-import/mount delay and showed little latency improvement from GET transport alone. Avoid adding a cache to mask live authorization or broad payloads.
4. Retained scheduling state now has fresh reveal validation, but very long-lived sessions, multiple windows, support-session expiry, large published schedules and mobile CPU/network need further acceptance coverage. Existing live checks remain the authority; no successful authorization is shared between HTTP requests.
5. If a region experiment is later authorized, run an isolated, controlled preview comparison with the same database and security contract. No production infrastructure change is part of this deliverable.

Recommendation: keep Phase 1 reviewable and undeployed. Its strongest measured benefit is fewer requests and a shorter three-read barrier in Interview Rooms, including the active four-user cohort. The native test-contract mismatch and reproduced hydration defect are resolved. Extend the workload evidence and resolve the follow-up latency uncertainty before release; then address the remaining cold-load and projection costs. Passing local suites does not establish production capacity.

The reserved local app and Supabase project were stopped after verification. Disposable credential fixtures and the temporary audit-reference checkout were removed; unrelated local stacks were left intact. See [cleanup evidence](CLEANUP.json).
