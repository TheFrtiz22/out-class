# OutClass performance — Phase 9

The recognized metadata read uses **10 statements instead of 13** in the measured default page path, with the same payload and required live validation. At 5,000 applicants, local warm entry is **158.1 / 261.0 → 79.7 / 95.7ms p50 / p95**; warm next-page is **264.2 / 394.1 → 180.2 / 285.3ms**. The supplemental 5,000-applicant single-reader burst also worsens **211.1 / 343.8 → 348.5 / 1,046.8ms p50 / p95**. Keep this candidate local: primary improvements against Phase 8 do not resolve the complete series' resident-list/freshness tradeoff or establish production performance.

Baseline Phase 8 `febb9cfd40b29d8e175a8d7c0c10fc6245f57dbe`; audit reference `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Local branch `codex/performance-phase9-20261025` reuses the attached managed worktree. No production infrastructure, schema/index, dependency, security policy or publication change.

## Implemented experiment

A parameterized metadata JOIN replaces the recognized scalar application/round/user/profile relation fan-out. It selects the same explicit scalar allowlist, preserves missing profiles with a left join, and maps native PostgreSQL types back to the original metadata shape. The complete guarded predicate must match a strict schema: club, non-draft status, optional application/round, anonymous-round restriction and authorized gender selection. Any unknown/nested/additional predicate uses the exact original Prisma reader; SQL failures propagate rather than retry with a different scope.

The new query runs inside the existing freshly guarded Repeatable Read transaction. Page planning, canonical privacy projection, JavaScript locale filtering/order, facets, cursor binding and bounded selected-applicant review/assignment hydration are unchanged. Review/score-dependent queries retain the complete canonical fallback. Ranking remains O(N); a join is not SQL keyset paging. Per-applicant child collections and global facets can grow.

Every actual GET retains remote identity verification, live session/revocation, account enablement, current membership/capabilities, suspension/support restrictions, anonymous review and voting snapshot protections. Private no-store/Cookie handling and Demo isolation remain. Query values are parameters, never SQL fragments. There is no successful authorization cache, new client cache, additional speculative GET or change in source authority rotation.

The query shape follows the installed Prisma 6 API, rather than adopting the current default v7 examples. [Prisma 6 raw-query guidance](https://www.prisma.io/docs/orm/v6/prisma-client/using-raw-sql/raw-queries) documents bound template values and PostgreSQL type mapping. The current Supabase changelog was checked; the November TLS cipher removal does not affect this loopback HTTP experiment. No provider settings changed.

## Verification

| Check | Result |
|---|---|
| Ordinary unit/component/contract suites | 1,405 passed; 55 environment-gated skips; 0 failures (1,460 total) |
| Live Auth/account/privacy/revocation/navigation/settings | 59 unique cases exercised across two runs; 0 failures |
| Initial live run | 54 passed; 5 skipped because the fixture contained only 100 applicants |
| Targeted 1,000-applicant followup | All 5 previously skipped page/search/draft/refresh cases passed; 0 skips |
| Native metadata scope differential | 86 complete/foreign/nested scopes, optional profiles, archived rounds; synthetic cases rolled back |
| Native security/concurrency | 3 passed |
| Normal disposable provisioning/signup/TOTP | 38 passed |
| Migrations / browser-role denial | All 57 fresh/legacy migrations; 78 RLS tables |
| Production build / typecheck | Passed |
| Lint | 0 errors; 22 existing warnings |

Counts overlap; do not add them. The 55 ordinary gated skips are explicit, and not every optional gated suite was exercised. `TEST_RESULTS.json` and `tests/` retain the final runs and development fixture failures. Final candidate build/source hashes are unchanged from the passing checks through both accepted collections.

New regressions verify complete predicate recognition, bound injection-shaped values, unknown-scope fallback, optional-profile/null mapping and error propagation without a second read. The native comparison runs against both clubs, anonymous/non-anonymous and archived/non-archived round metadata, draft/submitted applications, profiles/missing profiles, gender predicates, foreign IDs and nested fallback scopes. Synthetic native cases roll back; test failure diagnostics do not dump returned application bodies. The existing concurrent-update test now intercepts the metadata JOIN and still proves one Repeatable Read snapshot plus freshness on the subsequent HTTP request.

The initial test loader compared duplicate selector objects by identity; it now compares their structure. The CRM fixture also lacked PostgreSQL's explicit nullable score fields; it now models actual null values. The native fixture initially used a gender value rejected by the existing database constraint; the fixture was corrected without changing the constraint. Sanitized failure logs are retained separately from final verification. No application or authorization behavior was changed to satisfy them.

## Measurement protocol

The direct baseline is Phase 8, not the Phase 7 resident-list design. Cold means first target visit in a fresh browser context with a warmed server. Initial/detail primary groups retain BA/AB blocks, one warmup and five measured outcomes per path/condition/build/block (n=10, nearest-rank p95=max). Separate constrained initial groups use one warmup and three measured outcomes per block (n=6, p95=max). Warm page/search groups retain one warmup and five measured outcomes per block (n=10).

Constrained CDP conditions are 80ms request latency, 200,000B/s download, 93,750B/s upload and 4× browser CPU slowdown. The HTTP supplement retains 1/2/4-reader bursts, one warmup and five measured waves per build/block/level, with a nominal 25ms aggregate same-role PostgreSQL sampler. The per-client pool limit stays eight. These local desktop/loopback conditions do not establish hosted or mobile performance, multi-user saturation safety or isolated pool-only wait.

Source preparation and all timed traffic, failed/pending transports, script/task/heap observations and every planned warmup/outcome remain separate. No forced garbage collection or product loading delay is used. Complete accepted intervals require a passing read-only power audit with temporary awake assertions; interrupted sets are retained/excluded whole. Loader timings are separate from HTTP/browser latency. Pilot loader results are excluded from accepted comparisons.

## Results

Accepted primary: **384 browser outcomes (320 measured, 64 warmups)** and **600 separate loader observations**. Separate supplement: **224 browser outcomes (176 measured, 48 warmups)** plus **336 HTTP outcomes (280 measured, 56 warmups)**. All planned rows remain. Both full collection intervals passed the power audit. The 200 exploratory loader samples are retained separately and excluded; no test suite or build from this task competed with accepted measurements.

### Unthrottled entry and detail

| Applicants | Target / browser | Phase 8 p50 / p95 ms | Phase 9 p50 / p95 ms |
|---:|---|---:|---:|
| 100 | List / cold | 80.9 / 98.8 | 77.4 / 82.1 |
| 100 | List / warm | 64.1 / 77.2 | 64.8 / 111.3 |
| 100 | Detail / cold | 84.0 / 112.7 | 80.7 / 112.9 |
| 100 | Detail / warm | 98.6 / 188.0 | 97.5 / 104.6 |
| 1,000 | List / cold | 127.8 / 135.2 | 97.2 / 162.7 |
| 1,000 | List / warm | 114.1 / 186.4 | 80.2 / 112.5 |
| 1,000 | Detail / cold | 80.0 / 113.7 | 95.9 / 216.2 |
| 1,000 | Detail / warm | 101.8 / 134.9 | 98.8 / 479.6 |
| 5,000 | List / cold | 169.1 / 210.6 | 100.4 / 118.3 |
| 5,000 | List / warm | 158.1 / 261.0 | 79.7 / 95.7 |
| 5,000 | Detail / cold | 96.3 / 153.5 | 79.7 / 96.7 |
| 5,000 | Detail / warm | 98.6 / 114.3 | 98.0 / 99.9 |

Both builds use the bounded page GET. Each timed entry/detail has one protected read. Complete timed list request count remains five cold / one warm; detail remains four. Expected common-page JSON and encoded-body bytes are compared directly below; the query optimization does not intentionally change the wire contract, page size or source ownership. Detail code was unchanged: mixed detail timing is not a demonstrated detail optimization.

| Applicants | Initial list encoded body bytes, Phase 8 → 9 |
|---:|---:|
| 100 | 7,223 → 7,223 |
| 1,000 | 7,267 → 7,267 |
| 5,000 | 7,239 → 7,239 |

These are encoded HTTP body bytes, excluding TLS/headers. Global facets/rounds and per-applicant child collections may grow, even though selected applications are capped at 100.

| 5,000 warm list measurement | Phase 8 p50 / p95 ms | Phase 9 p50 / p95 ms |
|---|---:|---:|
| Read TTFB | 134.9 / 236.7 | 55.8 / 61.3 |
| Server total | 133.5 / 235.1 | 54.1 / 59.9 |
| Database span | 88.9 / 186.7 | 19.0 / 27.3 |
| Serialization | 0.5 / 0.8 | 0.5 / 1.3 |
| Transfer | 0.4 / 0.6 | 0.4 / 0.4 |
| Timed network complete | 139.0 / 240.7 | 59.6 / 65.8 |
| Browser script | 12.6 / 13.9 | 11.3 / 11.5 |
| Browser task | 41.0 / 49.8 | 34.5 / 37.4 |

All individual phase distributions and selected maximum rows remain in `comparison-final/SERVER_PHASES.json` and `REGRESSION_OBSERVATIONS.json`. Overlapping phases must not be summed. Transaction acquisition includes BEGIN/transport and is not an isolated pool-only wait. Retained high-latency rows are not replaced or dismissed as host noise.

This change did not improve every measured path. Local 100 warm-list p50/p95 is **64.1 / 77.2 → 64.8 / 111.3ms**, although its database-span median falls **11.19 → 8.92ms**. The change does not optimize the remaining identity, render/paint or source work. At 1,000 cold list, median improves but p95 worsens **135.2 → 162.7ms**; next-page p95 worsens **201.4 → 237.0ms** despite a lower median. The unchanged 1,000 detail endpoint has cold p50/p95 **80.0 / 113.7 → 95.9 / 216.2ms** and warm p95 **134.9 → 479.6ms**. The warm maximum records server total 406.77ms, identity verification 381.60ms and database span 19.68ms. This locates the observed wait, but does not establish why identity verification slowed or a causal host diagnosis. No identity/live-session validation was removed to reduce that result. The remaining tiny 100 cold-detail p95 increase and all other groups are retained in `REGRESSIONS.json` and the tables.

### Warm interactions

| Applicants | Interaction | Phase 8 p50 / p95 ms | Phase 9 p50 / p95 ms |
|---:|---|---:|---:|
| 1,000 | Next page | 130.2 / 201.4 | 96.0 / 237.0 |
| 1,000 | Distant search | 93.7 / 303.7 | 61.4 / 144.1 |
| 5,000 | Next page | 264.2 / 394.1 | 180.2 / 285.3 |
| 5,000 | Distant search | 144.4 / 260.4 | 77.4 / 94.3 |

Both variants issue one fresh guarded GET for each accepted page/search query. Request count is **1 → 1**, rather than the Phase 7 resident design's historical zero. This backend change cannot make a fresh request equivalent to a local resident interaction. Phase 7 was not rebuilt in this matched Phase 9 experiment; its older timings are context, not a pooled comparison.

### Constrained browser

| Applicants | Target / browser | Phase 8 p50 / p95 ms | Phase 9 p50 / p95 ms |
|---:|---|---:|---:|
| 1,000 | List / cold | 450.2 / 484.1 | 451.5 / 456.5 |
| 1,000 | List / warm | 225.1 / 257.9 | 221.8 / 697.4 |
| 1,000 | Detail / cold | 264.0 / 596.5 | 265.5 / 677.4 |
| 1,000 | Detail / warm | 251.6 / 254.6 | 249.8 / 265.0 |
| 5,000 | List / cold | 449.3 / 779.6 | 457.6 / 501.3 |
| 5,000 | List / warm | 298.0 / 845.6 | 221.1 / 287.2 |
| 5,000 | Detail / cold | 270.8 / 284.1 | 280.2 / 298.0 |
| 5,000 | Detail / warm | 245.6 / 285.9 | 241.1 / 269.8 |

| Applicants | Interaction | Phase 8 p50 / p95 ms | Phase 9 p50 / p95 ms |
|---:|---|---:|---:|
| 1,000 | Next page | 203.0 / 283.3 | 204.4 / 425.9 |
| 1,000 | Distant search | 126.3 / 135.6 | 125.7 / 608.5 |
| 5,000 | Next page | 339.9 / 417.2 | 304.5 / 738.7 |
| 5,000 | Distant search | 167.4 / 581.5 | 132.2 / 212.6 |

The payload remains bounded in both variants, so Phase 8's large transfer reduction is not a new Phase 9 gain. Constrained 1,000 warm entry has nearly unchanged median but p95 worsens **257.9 → 697.4ms**. Three of four constrained interaction p95s regress: 1,000 next-page **283.3 → 425.9ms**, 1,000 search **135.6 → 608.5ms**, and 5,000 next-page **417.2 → 738.7ms**. Constrained 5,000 next-page median improves **339.9 → 304.5ms**, while p95 worsens **417.2 → 738.7ms**. Other constrained regressions and their maximum-row references remain in `supplement/REGRESSIONS.json` and `PEAKS.json`. Source loading remains separate from the timed click. The unchanged browser code and small samples do not establish a general CPU, hydration or memory improvement.

### Bounded simultaneous initial reads

| Applicants | Readers per burst | Phase 8 burst p50 / p95 ms | Phase 9 burst p50 / p95 ms |
|---:|---:|---:|---:|
| 1,000 | 1 | 62.9 / 81.0 | 52.0 / 63.5 |
| 1,000 | 2 | 73.9 / 95.0 | 59.9 / 123.3 |
| 1,000 | 4 | 97.8 / 118.9 | 82.3 / 107.7 |
| 5,000 | 1 | 211.1 / 343.8 | 348.5 / 1,046.8 |
| 5,000 | 2 | 287.8 / 976.0 | 192.9 / 204.6 |
| 5,000 | 4 | 361.7 / 600.7 | 286.6 / 893.5 |

All 336 HTTP outcomes and their server/TTFB/body data are retained in `supplement/COMPARISON.json`. At 5,000/one reader, complete burst median/p95 worsens **211.14 / 343.84 → 348.52 / 1,046.84ms**. Its maximum has server total **1,040.90ms**, database span **951.06ms** and transaction acquisition **0.51ms**. Database-span median also worsens **167.87 → 201.46ms**. The span covers the instrumented Prisma operation and does not isolate PostgreSQL engine execution from transport/client scheduling. This is an unresolved regression, not a tail to remove. At four readers, median improves **361.70 → 286.56ms**, while p95 worsens **600.66 → 893.46ms**. One-actor bursts cap at four requests; they do not establish multi-user production saturation limits. The sampler observed up to **10 same-role connections, four active queries, four idle-in-transaction connections, and zero lock-waiting samples**. The nominal 25ms sampler can miss short peaks; same-role aggregate connections may include background clients and exceed the per-client pool setting without proving pool saturation.

### Loader, source and transport diagnostics

5,000 page loader (Phase 8): **266.0 / 746.6ms p50 / p95**; statement-count distribution **{'13': 20}**.

5,000 page loader (Phase 9): **148.7 / 163.1ms p50 / p95**; statement-count distribution **{'10': 20}**.

Loader calls each repeat remote identity verification. These non-HTTP timings are not browser latency. Default page paths use 10 statements versus 13, including transaction control; empty pages, populated member relations, unknown metadata scopes and full review-dependent fallbacks can have different counts. The unchanged full/list/selection/detail results are retained, including initial setup-statement variations. The sanitized 5,000-row plan (`METADATA_PLAN.json`) demonstrates the remaining full metadata scan; its single execution is not a comparative latency estimate.

comparison-final: **384 browser outcomes, 0 failed, 0 page errors, 0 HTTP errors**. Retained background flags: **23 failed transports**, **288 pending requests**, and **6 source preparations with additional summary reads**.

supplement: **224 browser outcomes, 0 failed, 0 page errors, 0 HTTP errors**. Retained background flags: **0 failed transports**, **128 pending requests**, and **64 source preparations with additional summary reads**.

Pending SSE and request failures after HTTP 200 remain distinct from navigation outcomes and HTTP errors. Additional source reads and their fixed-label authority events remain visible in `COMPLETE_DIAGNOSTICS.json`. This phase did not suppress authority rotation or coalesce a later live validation. Non-SSE pending snapshots do not establish eventual request completion.

| 5,000 warm list source/browser observation | Phase 8 p50 / p95 | Phase 9 p50 / p95 |
|---|---:|---:|
| Source useful content ms | 285.0 / 455.0 | 279.0 / 351.0 |
| Source requests | 58.0 / 58.0 | 58.0 / 58.0 |
| Source encoded body bytes | 1,038,106.0 / 1,038,106.0 | 1,038,108.0 / 1,038,108.0 |
| Source script bytes | 543,405.0 / 543,405.0 | 543,405.0 / 543,405.0 |

comparison-final after-heap p50: **15.40 → 15.26MB** (decimal). No forced GC; these point samples do not measure retained application memory.

supplement after-heap p50: **19.42 → 19.41MB** (decimal). No forced GC; these point samples do not measure retained application memory.

The preceding constrained 5,000 warm-list source preparation still takes **5,887.0 / 5,990.0 → 5,926.0 / 6,088.0ms p50 / p95**, with approximately 1.04MB of source body traffic in both builds. This wait is outside the timed click table and remains user-visible; the original multi-second first-load problem is not solved.


## Recommendation and remaining risks

Keep the implementation and evidence local. Assess Phase 9 as a database-shape improvement against Phase 8, with every measured regression called out alongside gains. The series still needs a product decision about fresh-query requirements versus resident interaction speed; this phase changes neither policy nor transport. No automatic push, merge or deployment was performed.

Before considering publication, reproduce and profile the 5,000 single-reader regression and the constrained page/search tails with phase/query-level evidence; preserve this complete collection rather than replacing its bad rows. The HTTP levels were collected after constrained browser blocks in fixed 1/2/4 order, so they are not isolated database microbenchmarks. For the next optimization experiment, also prioritize the initial source/bundle and hydration critical path, using retained source requests/bytes and authority events to choose a concrete dependency or waterfall. Preserve remotely verified identity and required live authority transitions. Also retain the Phase 9 query's scalar-scan cost as a known large-cohort limit; true SQL paging would require proof of canonical anonymous filtering, JS collation, facets and review/score equivalence. Do not assume it from a faster JOIN.

Remaining limits: local desktop and loopback Auth/database, synthetic enriched cohorts, one actor/club per burst, warmed servers, small descriptive percentiles, no real low-end mobile hardware, no production mixed-mutation load, and a hand-maintained SQL allowlist coupled to the selected Prisma shape. Strict scope recognition falls back on unfamiliar predicates, and native differential tests must remain when the query/schema evolves. No universal tail, isolated pool-wait, bundle, memory or hosted-production improvement is established.

Review `BENCHMARK_RESULTS.json`, `TEST_RESULTS.json`, both accepted `COMPARISON.json` files, `IMPLEMENTATION.diff`, source/build manifests, `PRIVACY_SCAN.json`, `CLEANUP.json`, `EVIDENCE.json` and `SHA256SUMS`. The original checkout and main refs remain unchanged; disposable credentials/services/build snapshots are removed after privacy checks, with the ignored final build retained.
