# Phase 2 — selected-tab startup

October 23, 2026. The implementation is on `codex/performance-phase2-20261023`, based on published main `145fed90e046fe11577c86654c5f29ff6964f177`. The original audit reference remains `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. All intervening Phase 1/dashboard/navigation changes are preserved. Phase 1's post-merge checks passed before this work. This Phase 2 branch is local and unmerged; no new deployment or production configuration/database change was performed.

The selected Members, Applicants, Tasks and Announcements tabs now start their component import and original authorized GET together. The resolved component mounts with that request's fresh data and skips exactly its initial duplicate load. Subsequent filters, retries and mutations retain their existing read paths. This removes the code → mount → effect barrier without modifying React, delaying the interface or eagerly fetching other tabs.

The previous 30-second parent retention of Members/Pipeline is removed. Each return visit waits for fresh live validation before showing its list. A component-local owner includes the complete identity snapshot, opaque browser session epoch, support mode, club, selected resource and privacy scope. Late results are ignored after owner/navigation changes. Demo keeps its existing adapters and unresolved Demo initialization cannot start a live read. No successful authorization is cached between requests. The existing three-request/24-queued-read bound remains in force.

All server readers, allowlist/argument validation, `private, no-store`, Cookie-sensitive handling, remote identity and live-session/account checks, memberships/capabilities, suspension/privacy rules, support restrictions, anonymous protections and voting snapshot authority remain unchanged. [The implementation diff](IMPLEMENTATION.diff) includes application, regression and measurement changes. It uses zero context (apply with `git apply --unidiff-zero`) so patch-marker whitespace does not fail repository whitespace checks; reverse applicability was verified against this branch.

## Measured navigation

The complete local production-build study contains **480 observations**: 320 primary, 80 separate unchanged-AA control and 80 fixed warm-ups. Four BA/AB pairs contribute 20 observations per build/path/condition. The middle AA pair is excluded from optimization estimates. The predeclared [plan](PLAN.json) and [protocol](comparison/PROTOCOL.json) preserve order, build IDs, failures and source scope. No failed samples, slow rows or outliers were removed; all planned rows completed with zero browser/HTTP failures. No request gates, extra tests or builds ran during collection.

One unchanged disposable fixture supplies two clubs, 61 members and 100 submitted applicants per club, plus one meeting/task/announcement per club. One desktop Chromium browser runs each navigation. The local Prisma limit is eight per client, with the existing client dispatch cap of three. Cold means a fresh browser visiting the destination for the first time, with a running/warmed local server/database; warm means a revisit. Both source pages and destination content use real Auth and PostgreSQL. These are **loopback measurements, not production latency or capacity measurements**.

All benchmark activations use the same real keyboard path. Separate browser acceptance covers pointer and mobile touch. Useful content is the existing loaded-data DOM predicate followed by two animation frames; interaction checks an enabled visible control. It is a paint proxy, not screenshot timing. Production React render durations remain unavailable. The shared host's measured-phase CPU median is 33.3%, with a 92.15% peak.

Times are p50 / p95 milliseconds. Intervals are candidate minus baseline median differences from 10,000 fixed-seed resamples of the four whole matched blocks. They are descriptive, with only four pairs and one synthetic owner.

| Navigation | Before B | After A | Median-difference interval |
|---|---:|---:|---:|
| overview → members · cold | 291.8 / 346.6 | 56.2 / 69.6 | -249.6 to -230.8 |
| overview → members · warm | 25.3 / 28.6 | 60.2 / 61.6 | 33.7 to 35.3 |
| recruiting → applicants · cold | 403.2 / 419.9 | 66.3 / 79.8 | -338.5 to -328.4 |
| recruiting → applicants · warm | 29.1 / 30.7 | 58.9 / 69.1 | 29.2 to 31.2 |
| meetings → tasks · cold | 292.5 / 310.1 | 59.9 / 62.0 | -233.9 to -231.7 |
| meetings → tasks · warm | 63.3 / 64.3 | 64.0 / 64.9 | 0.6 to 1.1 |
| tasks → announcements · cold | 288.0 / 293.7 | 57.6 / 69.2 | -233.4 to -221.4 |
| tasks → announcements · warm | 63.0 / 63.9 | 47.6 / 63.7 | -15.7 to 0.2 |

Cold medians improve by approximately **79.5–83.6%** in this cohort. The selected GET begins at 217.7–319.9 ms before versus 3.5–6.2 ms after, by cold median. A separate request-ordering regression holds the real component chunks: all four cases intentionally fail against the unchanged build and pass against the candidate, with exactly one initial GET per visit. Test-only gates never enter the benchmark.

Warm Members grows by 34.9 ms and Applicants by 29.8 ms at the median. Their baseline displayed retained content while a live request was still running; Phase 2 requires that request to finish before revealing the list. This is an explicit security/latency tradeoff, not a warm-navigation speedup or identical reveal contract. Warm Tasks is 0.7 ms slower and has no claimed improvement. Announcements' warm median improves by 15.4 ms, but its interval includes zero and p95 is effectively unchanged; no dependable warm improvement is claimed.

The unchanged-AA cold Applicants median moves 64.9 → 77.4 ms and p95 65.6 → 83.1 ms. This demonstrates ordinary variation and limits interpretation of small differences. [COMPARISON.json](comparison/COMPARISON.json) retains per-pair, maximum, tail-interval and control results; [SYSTEM.json](comparison/SYSTEM.json) retains aggregate host telemetry.

## Network, server and bytes

| Navigation | Network completion before → after | Selected GET server total before → after |
|---|---:|---:|
| overview → members · cold | 269.9 / 315.8 → 34.0 / 41.6 | 49.0 / 91.1 → 28.5 / 36.1 |
| overview → members · warm | 34.6 / 47.8 → 30.4 / 36.8 | 26.3 / 37.2 → 26.3 / 33.2 |
| recruiting → applicants · cold | 371.9 / 386.5 → 42.3 / 49.2 | 50.0 / 58.9 → 34.5 / 41.0 |
| recruiting → applicants · warm | 53.4 / 60.7 → 37.8 / 44.1 | 32.6 / 40.0 → 32.9 / 38.5 |
| meetings → tasks · cold | 272.4 / 276.5 → 34.0 / 43.1 | 47.4 / 53.0 → 28.9 / 37.7 |
| meetings → tasks · warm | 33.4 / 39.1 → 35.5 / 41.0 | 29.1 / 34.9 → 30.6 / 36.2 |
| tasks → announcements · cold | 262.6 / 271.4 → 30.8 / 43.3 | 42.8 / 48.2 → 25.7 / 36.5 |
| tasks → announcements · warm | 30.5 / 33.9 → 28.7 / 31.1 | 25.5 / 28.5 → 24.4 / 26.7 |

The server implementation did not change. The lower cold server point estimates do not prove a SQL, pool or remote-identity improvement: request scheduling, local contention and runtime state can affect wall durations. Full identity/database/acquisition/serialization distributions are in the comparison JSON; unavailable phases remain null. Transaction acquisition includes BEGIN/transport and is not a pure pool-queue measurement.

Counts and bytes below are medians. Encoded bodies exclude headers. Every navigation makes exactly one selected-resource GET in both builds.

| Navigation | Browser requests before → after | Total encoded bytes before → after | Selected GET body before → after |
|---|---:|---:|---:|
| overview → members · cold | 2 → 2 | 24,551 → 24,620 | 5,392 → 5,392 |
| overview → members · warm | 1 → 1 | 5,392 → 5,392 | 5,392 → 5,392 |
| recruiting → applicants · cold | 5 → 5 | 53,477 → 53,503 | 22,710 → 22,710 |
| recruiting → applicants · warm | 1 → 1 | 22,710 → 22,710 | 22,710 → 22,710 |
| meetings → tasks · cold | 3 → 3 | 26,145 → 26,181 | 4,363 → 4,363 |
| meetings → tasks · warm | 1 → 1 | 4,363 → 4,363 | 4,363 → 4,363 |
| tasks → announcements · cold | 2 → 2 | 5,016 → 5,059 | 255 → 255 |
| tasks → announcements · warm | 1 → 1 | 255 → 255 | 255 → 255 |

**No request-count or protected-payload reduction is claimed.** Cold byte counts rise by 26–69 bytes for changed component code. Initial source-page script bodies also rise by 151–187 bytes at the cold median, so work shifted before the click is accounted for. Next reports workspace first-load JS as 522 kB in both builds, with route code 34.2 → 34.3 kB at displayed precision. There is no new cache, library, global prefetch, hover fan-out or data projection expansion.

## Verification and limitations

- Ordinary suite: **1,351 pass, zero fail, 41 gated skips** (1,392 total).
- Candidate real Auth/browser coverage: 45 passes for the 38 Auth/account/session checks plus seven Phase 2 cases; the existing Phase 1 GET/concurrency suite adds six, and Settings/navigation adds eleven. Those 62 distinct checks pass.
- Native security/concurrency: all three suites pass. Fresh/legacy migration checks pass for 57 migrations, with browser-role denial/RLS on 78 application tables.
- Production builds and type checking pass. Full lint has zero errors and 22 existing warnings; new component/tools/tests lint cleanly. Six final focused owner/analyzer checks pass, including additional support/club/privacy fencing after the broad run.
- The new browser checks prove code/data overlap, one initial request, rapid-switch fencing, a revoked revisit without an old-directory flash, usable pointer/touch content and mobile overflow handling. Existing scheduler draft-continuity and rapid-tab tests also pass in the full suite.

The first two pilots found stale dashboard/switcher/pointer adapters. They are retained separately; the third pilot passes all eight cases. The first candidate browser run exposed a Playwright gate-release ordering error and the old rapid-interview test's flyout pointer selector. Releasing held routes before removing the handler and using the current keyboard flyout path repairs those tests without changing application code. The intentional baseline ordering failures are in [CONTROL_ORDERING.log](CONTROL_ORDERING.log). See [TEST_RESULTS.json](TEST_RESULTS.json) and [VERIFICATION.log](VERIFICATION.log).

The seven measured application files did not change after the candidate build. After collection, only evidence-output/baseline-manifest CLI arguments and one extra owner regression were added for reproducibility. No raw credentials, cookies, JWTs, SQL/parameters or protected response bodies are exported. Request trace IDs are random and non-sensitive. [CLEANUP.json](CLEANUP.json) confirms the task's app, containers, credentials and private build snapshots were removed, the prior inactive directory restored and unrelated containers preserved.

This cohort does not include large answer/evaluation histories, thousands of applicants, concurrent campus traffic, slow-network/mobile performance distributions or a hosted authenticated slow-navigation trace. Mobile coverage is functional. The broader legacy publication script's selector limitation from Phase 1 is not repaired here; interview publication/authority code is unchanged. A local improvement does not establish a hosted p95 guarantee or connection-pool capacity.

## Recommendation and reproduction

Retain this bounded startup change for review, with the fresh-validation warm tradeoff explicit. Next, narrow and page the pipeline/member/task list contracts and load authorized detail on demand. This study leaves their response bodies and SQL shapes unchanged; the 100-applicant pipeline still transfers 22,710 compressed body bytes. Evaluate 100/1,000/5,000 applicants and realistic histories before choosing limits. Correlate an actual hosted slow transition with the existing trace IDs before attributing remaining waiting to Auth, pool, locks or regions. The region experiment and all production infrastructure/schema changes remain outside this work.

For a new study, use a fresh reserved `outclass-onboarding-e2e` fixture on 3107/553xx; preserve inactive prior files rather than reusing seed JSON from another database. Build baseline main `145fed9` with the existing onboarding runner, seed via the navigation harness, snapshot `.next-publish` to the validated fixture's `phase2-build-baseline`, and capture a **new** baseline source/build-ID manifest. Apply the implementation, rebuild using the guarded local-build helper, and finish verification before collecting. Keep the fixture unchanged between builds.

Run `node scripts/navigation-selected-study.cjs --out=docs/performance/phase2/<new-directory> --baseline-source=<new-manifest.json>`, then `node scripts/summarize-selected-navigation.cjs --out=docs/performance/phase2/<new-directory>`. The reusable runner rejects existing evidence and non-Phase-2 output paths, validates the loopback fixture/registered listener, retains every fixed warm-up/measurement, and stops on a missing observation, body counter or browser/HTTP error. It leaves the private fixture for explicit scoped cleanup. Preserve the frozen evidence in this report when reproducing.
