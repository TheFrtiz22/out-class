# OutClass performance — Phase 8

**Hold publication.** This is a validated local candidate with a useful large-list entry and constrained-network benefit, not a blanket navigation optimization. At 5,000, initial body bytes fall 98% and local median entry falls about 32%, but local entry tails and every measured warm page/search comparison regress. Keep the resident baseline and this candidate reviewable until a product decision weighs repeated interactions against entry transfer and fresh-query requirements.

Audit reference `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`; baseline Phase 7 `d89d15a91106fd465ca8358abaaaba4f4a5c7226`. Isolated branch `codex/performance-phase8-20261025` in the existing managed worktree. The primary checkout and earlier commits remain intact. No production infrastructure, schema/index, security-policy, dependency, merge, push or deployment change.

## Implemented path

The selected workspace now requests the existing guarded `pipelinePage` GET. For queries whose selection/order do not depend on review metadata, the server uses an application/profile/round field allowlist without review or assignment collections to rank the complete eligible selection using the original JavaScript privacy, filtering, locale ordering and facet functions. It then reads submitted review and active assignment collections only for the selected set of at most 100 application IDs, retaining the original application predicate on both relation queries. Scalar metadata is reused from the same snapshot, and canonical summaries are constructed only for that page. Both stages and gender counts share the existing Repeatable Read transaction.

No duplicate SQL implementation of anonymous identity, self-review exclusion, score visibility or JavaScript collation was introduced. Visible reviewer references and score summation now use stable member ordering so different SQL plans do not change reference arrays or floating-point rounding; contributors and visibility/authority rules remain unchanged. Review filters, rating thresholds (including zero) and score sorting retain the complete canonical summary path. Complete quick-review/voting selections and protected detail/mutation/snapshot paths remain unchanged.

This bounds applications receiving full summary/review/assignment hydration for the fast path; it **does not** bound the ranking scan or all SQL rows. The scan, global facets and JavaScript ranking still grow with N. Related review/assignment rows per selected applicant can also grow, and review-dependent selectors retain full hydration. This deliberately narrower implementation avoids changing established privacy or ordering behavior while testing the initial-load tradeoff.

A mounted page owner includes current identity/session authority, membership, club, support, Demo, refresh revision and complete normalized query/cursor scope. Retained metadata keeps controls editable, while rows for previous queries stay hidden. Pending reads drain before only the latest queued query dispatches. Adjacent-page handoff adopts the just-validated response once without a duplicate GET. Known authority or refresh changes hide earlier content and require a new guarded read. Invalid inputs do not dispatch while current-context metadata exists; if authority changes while input is invalid, a guarded default read reacquires controls and keeps rows hidden until valid input.

Every real GET still verifies remote identity, live session/revocation, enabled account, membership, capabilities and the existing suspension/support restrictions. Private `no-store`, cookie handling, anonymous protections, explicit gender visibility and Demo isolation are preserved. No successful authorization is cached between requests.

Fixed-label local diagnostic events identify authority/read lifecycle causes without identifiers, tokens, cookies, query text or authorization outcomes. They have no product-side event buffer, network transmission or authorization effect, including when an observer fails. The harness retains a bounded sanitized event list and browser heap observations. No diagnostic event is used to decide access.

## Verification

All final checks use candidate build `2ErH_X2IQiaRUYcsy3aBo` / the same 912 application-source hashes:

| Check | Result |
|---|---|
| Ordinary unit/component/contract suites | 1,401 passed; 54 environment-gated skips; 0 failures (1,455 total) |
| Real Auth, account privacy/revocation, navigation Phases 1/2/3/5/6/7/8 and settings acceptance | 58 passed, 0 skipped |
| Focused projection, page owner, transport and deterministic review regressions | 73 passed |
| Native security/concurrency runner | 3 passed |
| Disposable provisioning / verified signup / TOTP | 38 passed |
| Fresh and legacy migrations / browser-role denial | 57 migrations; 78 RLS tables |
| Production build / typecheck | Passed |
| Lint | 0 errors; 22 existing warnings |
| Real 5,000-applicant canonical/page parity | Exact result equality for the selected 100 |

Suite counts overlap and are not additive. The 54 gated skips are reported explicitly; not every optional gated suite was exercised. Full logs and runner descriptions are under `tests/`; `TEST_RESULTS.json` records the final totals.

The real database regression compares canonical results across a concurrent profile update: planning and bounded hydration retain one snapshot; a subsequent guarded HTTP page observes the changed profile. Exact privacy/order/facet parity, current review visibility, full selection, cursor scope, draft continuity, invalid inputs and rapid switching remain covered.

Review found a queued invalid input could overwrite editable metadata, and an authority change with invalid input could remain behind a loader. Those regressions and a handoff owner re-entry case were reproduced before their fixes. A prepared adjacent-page owner is consumed on commit and cannot act as a lookup cache. The complete preliminary measurement is excluded, not mixed with the corrected repeat. Development mock/fixture corrections, the native suite's refusal of the wrong disposable database URL, and the reproduced relation-order differences are retained in the logs; no safeguard was bypassed. The first prototype reread selected profiles/rounds and used 17 statements versus the original list's 13; this duplication was removed before the accepted collection. Its navigation timings remain excluded.

## Measurement protocol

Fresh frozen local production builds share independent enriched 100/1,000/5,000 cohorts. Primary BA/AB blocks retain one warmup plus five measured outcomes per build/path/browser condition/block. Warm page/search interactions use the 1,000/5,000 cohorts. All planned rows, errors and transport flags remain; the excluded preliminary set is not pooled into the final set.

Cold means a first target visit in a fresh browser context with a warmed server, not a deployment cold start. Content clocks use browser DOM predicates plus two animation frames, with driver timing retained separately. Nearest-rank primary p95 at n=10 is the maximum. Server spans overlap and must not be summed; transaction acquisition is not an isolated pool wait.

A separate local CDP profile applies 80ms request latency, 1.6Mbps download, 0.75Mbps upload and 4× browser CPU slowdown. Two BA/AB blocks retain one warmup plus three measured outcomes per path/condition/build, so p95 at n=6 is also the maximum. This models constrained conditions on a desktop browser, not a real mobile device or hosted deployment.

Bounded initial-read HTTP bursts use 1/2/4 concurrent readers, one warmup and five retained waves per level/build/block. Responses include gzip body bytes and existing sanitized phases; a 25ms aggregate database sampler excludes its own connection and never records SQL text or identities. Requests in one wave share conditions. One actor/club and a local pool limit of eight do not establish production multi-user saturation limits. A separate 42-outcome collector preflight is excluded from final comparisons.

No forced garbage collection or heap reduction is used. Heap samples include allocation/collection noise and cannot alone establish retained application memory. Source preparation, complete timed traffic and script/CPU work are reported separately. Temporary awake assertions and read-only power audits apply to each complete collection.

## Results

The accepted primary contains **384 browser outcomes (320 measured, 64 warmups)** and **600 separate loader observations**. The separate supplement contains **224 browser outcomes (176 measured, 48 warmups)** and **336 HTTP outcomes (280 measured, 56 warmups)**. Both complete intervals passed the sleep audit. All planned browser outcomes succeeded, with no page errors or HTTP 4xx/5xx. The excluded preliminary 384 browser / 600 loader outcomes and 42 HTTP preflight outcomes remain separate. No test suite or build ran during either accepted collection.

### Unthrottled local entry

| Applicants | Target | Browser | Phase 7 p50 / p95 ms | Phase 8 p50 / p95 ms |
|---:|---|---|---:|---:|
| 100 | List | cold | 78.1 / 84.2 | 67.1 / 75.8 |
| 100 | List | warm | 56.8 / 64.4 | 58.5 / 106.1 |
| 100 | Detail | cold | 80.0 / 117.5 | 80.4 / 377.0 |
| 100 | Detail | warm | 97.2 / 100.7 | 97.6 / 227.0 |
| 1,000 | List | cold | 103.1 / 130.1 | 93.7 / 123.1 |
| 1,000 | List | warm | 91.1 / 94.9 | 72.6 / 98.0 |
| 1,000 | Detail | cold | 79.9 / 97.0 | 79.9 / 85.9 |
| 1,000 | Detail | warm | 97.8 / 172.8 | 98.1 / 113.5 |
| 5,000 | List | cold | 250.8 / 297.1 | 166.2 / 341.7 |
| 5,000 | List | warm | 245.0 / 391.4 | 167.2 / 438.0 |
| 5,000 | Detail | cold | 96.5 / 103.0 | 80.7 / 134.1 |
| 5,000 | Detail | warm | 97.1 / 172.3 | 97.1 / 113.2 |

List read requests remain **1 → 1** on every timed entry. Complete timed list traffic is **5 → 5 requests cold** and **1 → 1 warm**. Detail traffic remains **4 → 4**, including one protected detail read, with identical detail response bytes. Detail server logic was not optimized; its mixed latency changes and retained 100-applicant tails do not establish a detail improvement.

| Applicants | Initial compressed list body, B → A bytes | Change |
|---:|---:|---:|
| 100 | 6,964 → 7,234 | +3.9% |
| 1,000 | 70,701 → 7,240 | −89.8% |
| 5,000 | 353,488 → 7,246 | −98.0% |

These are encoded HTTP body bytes, not total TLS/header bytes. At 5,000, raw loader JSON for the list/page is 3,003,626 / 59,257 bytes. Page envelopes add overhead at 100. Global facets, rounds and related rows per selected applicant can grow; the page size does not imply a universally constant payload.

| 5,000 warm list measurement | Phase 7 p50 / p95 ms | Phase 8 p50 / p95 ms |
|---|---:|---:|
| Read TTFB | 209.5 / 351.0 | 135.8 / 398.3 |
| Server total | 208.0 / 347.4 | 134.0 / 395.4 |
| Database execution span | 146.3 / 245.8 | 88.1 / 281.5 |
| Serialization | 15.1 / 24.0 | 0.5 / 1.5 |
| Read transfer | 2.3 / 3.1 | 0.4 / 1.1 |
| Timed network complete | 219.8 / 363.7 | 139.6 / 403.9 |
| Timed browser script | 16.0 / 18.8 | 12.7 / 17.3 |
| Timed browser task | 61.5 / 81.0 | 43.1 / 72.5 |

The large-list median entry improves, but local p95 worsens: 5,000 cold **297.1 → 341.7ms**, warm **391.4 → 438.0ms**; 100 warm **64.4 → 106.1ms**. The retained 5,000 warm maximum includes a 395.44ms server total and 281.46ms database span. No sleep interruption explains it, and these observations do not identify a causal host diagnosis. No row was replaced. Server phase distributions and maximum-row references are in `comparison-final/SERVER_PHASES.json` and `REGRESSION_OBSERVATIONS.json`.

### Warm page and search cost

| Applicants | Interaction | Phase 7 p50 / p95 ms | Phase 8 p50 / p95 ms | Read requests B → A |
|---:|---|---:|---:|---:|
| 1,000 | Next page | 29.8 / 31.3 | 112.9 / 130.7 | 0 → 1 |
| 1,000 | Distant search | 26.4 / 28.4 | 90.0 / 94.2 | 0 → 1 |
| 5,000 | Next page | 30.4 / 30.8 | 262.3 / 267.5 | 0 → 1 |
| 5,000 | Distant search | 28.0 / 28.8 | 160.3 / 176.4 | 0 → 1 |

The resident baseline uses already released summaries locally. Phase 8 makes a fresh guarded GET for each accepted query, so it adds network, live validation and an O(N) scalar ranking scan. This changes freshness as well as latency. It does not make the preceding resident data an authorization result reusable by a later request. Added waits are real regressions; no synthetic delay was introduced to either product.

### Constrained browser

| Applicants | Target | Browser | Phase 7 p50 / p95 ms | Phase 8 p50 / p95 ms |
|---:|---|---|---:|---:|
| 1,000 | List | cold | 760.2 / 784.5 | 438.4 / 449.0 |
| 1,000 | List | warm | 529.4 / 534.6 | 213.0 / 228.5 |
| 1,000 | Detail | cold | 251.4 / 266.2 | 252.5 / 267.5 |
| 1,000 | Detail | warm | 239.0 / 259.6 | 237.0 / 269.2 |
| 5,000 | List | cold | 2,187.2 / 2,194.4 | 443.8 / 447.9 |
| 5,000 | List | warm | 2,100.6 / 2,106.4 | 260.9 / 335.3 |
| 5,000 | Detail | cold | 258.6 / 299.0 | 253.7 / 264.3 |
| 5,000 | Detail | warm | 239.3 / 269.6 | 238.5 / 241.0 |

At 5,000 warm entry, timed network completion falls **2,025.1 → 186.8ms p50**, while server total falls **212.20 → 127.15ms p50**. The much larger browser benefit is consistent with reduced transfer under this profile. It is not evidence of a faster hosted Auth or database connection. Initial source preparation for the same group still takes **5,863 → 5,873ms p50** and transfers about 1.04MB in both builds; this phase does not solve the general first-page bundle/source wait.

| Applicants | Interaction | Phase 7 p50 / p95 ms | Phase 8 p50 / p95 ms | Read requests B → A |
|---:|---|---:|---:|---:|
| 1,000 | Next page | 69.0 / 73.7 | 198.3 / 271.5 | 0 → 1 |
| 1,000 | Distant search | 19.8 / 27.7 | 125.2 / 127.9 | 0 → 1 |
| 5,000 | Next page | 78.2 / 93.3 | 318.5 / 370.3 | 0 → 1 |
| 5,000 | Distant search | 23.8 / 30.5 | 152.3 / 158.8 | 0 → 1 |

The constrained entry improvement survives BA/AB ordering, while later page/search regressions remain. Absolute interaction timing is specific to the retained browser predicate, typing path and emulation; do not infer cross-profile CPU speed from one comparison.

### Bounded simultaneous initial reads

| Applicants | Readers per burst | Phase 7 burst p50 / p95 ms | Phase 8 burst p50 / p95 ms |
|---:|---:|---:|---:|
| 1,000 | 1 | 55.9 / 60.7 | 58.8 / 62.1 |
| 1,000 | 2 | 69.1 / 72.8 | 67.2 / 73.3 |
| 1,000 | 4 | 112.6 / 130.8 | 98.1 / 110.7 |
| 5,000 | 1 | 191.5 / 454.4 | 197.6 / 232.9 |
| 5,000 | 2 | 280.9 / 516.1 | 239.3 / 247.2 |
| 5,000 | 4 | 419.7 / 492.1 | 307.7 / 319.4 |

All 336 HTTP outcomes succeeded; each was independently guarded. At 5,000/four readers, median server total is **398.35 → 258.33ms**, database **246.52 → 216.06ms**, serialization **26.41 → 0.38ms**. Median transaction acquisition is **0.58 → 0.58ms**; p95 **1.14 → 5.55ms**. At one reader the candidate's median complete request is slightly slower at both sizes. This is mixed evidence, not a universal throughput gain.

The aggregate sampler observed up to nine same-role connections, four active queries, four idle-in-transaction connections and zero lock-waiting samples. The configured eight is per Prisma client; aggregate role counts also include background clients. Sampling can miss short peaks. Four readers, one actor/club, local Auth/DB, and no mutations do not prove production saturation safety or authorize raising concurrency.

The 600 loader observations each perform one remote identity verification. List, page and complete-selection loaders use 13 statements per observation, including transaction control. Detail uses 18; the unchanged full loader normally uses 18, with one 19-statement setup observation in each 5,000 variant. The fast path did not reduce statement count. Separately from HTTP, 5,000 page-loader median elapsed time is **160.32 → 191.00ms**, despite reduced hydration. The additional canonical metadata planning/pass and relation predicates still cost work; exact attribution between them is not established. Full results are in `comparison-final/LOADERS.json`.

### Source ownership, browser work and errors

All timed entry/detail samples have exactly one selected read. Source preparation retains additional reads: primary has two candidate warm-detail preparations and one baseline warm-detail preparation with two summary reads. Both candidate cases record `selected: mount`, Auth `signed_in`, then `selected: readAuthority`. Under the constrained profile every detail source preparation (32 per build, including warmups) has two summary reads; candidate events again record authority rotation. This supports an authority-owner transition explanation for the observed candidate cases, without logging tokens or suppressing validation. The frozen baseline has no such diagnostic labels, so its cause is not established by those labels. These reads remain in complete source traffic and must not be described as eliminated duplicates.

At 5,000 warm unthrottled entry, source visible content is **280 / 540 → 332 / 968ms p50 / p95**, source requests **58 / 58 → 58 / 59**, and source script bytes **542,749 → 543,405**. Candidate bundle/source preparation did not improve. At 5,000 warm detail preparation, source bytes fall **1,422,529 → 1,077,108**, because the preceding list is smaller; that is separate from the unchanged detail click. Complete source observations are retained in each comparison.

Heap evidence is mixed: 5,000 warm entry after-heap p50 is **14.21 → 15.36MB** unthrottled and **34.34 → 19.29MB** constrained (decimal MB). No forced GC was used. These snapshots do not establish retained-memory savings. Browser script/task/layout/heap distributions for every group are in each collection's `BROWSER_WORK.json`.

Zero failed navigations does not mean every background transport completed. Primary retains **22 failed recruitment-cycle transports after HTTP 200** (13 baseline, 9 candidate, including warmups) and **288 pending source SSE streams**. The supplement retains **128 pending SSE streams**, plus two non-SSE source requests (`view-as` and `corkboard`) still pending at one candidate 1,000 cold-detail preparation snapshot; no failed transports. Their eventual completion is not proven by that snapshot. All flags and source cases remain in `COMPLETE_DIAGNOSTICS.json`; captured positive bytes/HTTP 200 alone do not prove full consumption.


## Recommendation and limits

Recommend a focused next experiment, rather than another broad replacement: set entry, repeated-page/search and freshness budgets for representative workflows; then reduce the remaining scalar scan/planning cost while retaining canonical anonymous filtering, collation, global facets and review-dependent fallbacks. Profile the candidate page-loader regression and local tail rows before adding concurrency. A local read-plan experiment or removal of provably unused scalar metadata can be compared without infrastructure changes; moving ranking into SQL would require explicit privacy/order parity evidence, not assumed equivalence.

Separately investigate source preparation/bundle work and the observed authority transition, with the new fixed-label evidence. Any attempt to coalesce source reads must preserve the required authority rotation and fresh live guard. Do not suppress `SIGNED_IN`, revocation/account/membership checks, serve old rows as authorized, or turn a prepared page into a cache to improve this benchmark.

Unresolved limits: synthetic enriched cohorts, one local host/actor, warmed server, small descriptive percentile samples, local DB/Auth RTT, no genuine low-end mobile device, no mixed production mutation workload, and the full canonical fallback for review/score selectors. No production improvement, isolated Prisma pool-wait reduction, universal memory saving, or elimination of all source duplicate reads is established. No production schema/index, Supabase/Vercel configuration, dependency, push, merge or deployment change was made.

Evidence entry points: `BENCHMARK_RESULTS.json`, `TEST_RESULTS.json`, both `COMPARISON.json` files, source/build manifests, `IMPLEMENTATION.diff`, `PRIVACY_SCAN.json`, `CLEANUP.json`, `EVIDENCE.json` and `SHA256SUMS`. Disposable credentials/build snapshots are removed after the privacy scan; the ignored final build is retained for review. The original checkout, main/origin-main and 21 pre-existing unrelated containers are checked against initial state.
