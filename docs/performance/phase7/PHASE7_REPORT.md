# OutClass performance — Phase 7

Implemented and verified locally. Paging and search now reuse already released summaries, removing one GET per interaction. At 5,000 applicants, next-page p50/p95 is **229.4/230.1 → 29.8/31.7 ms** and distant search **227.1/227.9 → 26.4/27.8 ms**. This costs **207.3/220.0 → 227.7/240.2 ms** on warm entry and increases its encoded summary body **7,284 → 353,547 bytes**. Hold universal publication: validate snapshot freshness expectations and hosted/mobile/concurrent-client costs before choosing this transport as the default.

Audit reference: `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Baseline: Phase 6 `fa115be61a67aa10d3324d89e98c37b30118ea58`. Local branch: `codex/performance-phase7-20261024`, preserving the earlier phases and the separate primary checkout. No production configuration, schema/index, library, merge, push or deployment change.

## Implemented comparison

The selected applicant workspace now uses the existing narrow `pipelineList` GET. It waits for that complete authorized summary response and the selected component before showing content, then runs the existing privacy-safe page/filter/sort logic locally. At most 100 rows render. Search, academic/review/status filters, sorting and page changes operate on already released summaries without another request. Round/gender/count scopes still request fresh server data, preserving the explicit gender visibility guard.

A dedicated mounted hook binds summaries to club, complete client authority context, server-filter scope, enabled state and refresh revision. It hides earlier results during a fresh read and rejects late reads or mutation setters from another owner. It drains a pending read before requesting only the latest queued server scope, skips disabled scopes and creates/disposes its reader in effect setup/cleanup. Validated selected-tab data avoids a duplicate initial GET; unvalidated initial data stays hidden. A changed membership identity resets the local page cursor.

Every actual request still performs the existing remote identity, live session/revocation, account, membership, capability and suspension checks. Private `no-store`, cookie-sensitive response handling, support restrictions and Demo isolation are unchanged. Detail openings remain fresh single-applicant reads. Quick review and voting still request the complete current selection explicitly, and all mutations/snapshot authority remain on their existing server paths. Draft flushing across the 100/101 boundary remains covered.

This is a mounted data snapshot, not an authorization cache. Local interactions re-present fields already released by the initial authorized GET; they do not observe database changes afresh on every click. A remote change without a client authority/privacy event is reflected by the next fresh read. Entry/re-entry, explicit refresh, known authority/privacy changes, server scope changes and sensitive workflows retain live validation. No new polling, background prefetch, persistent summary storage or caching library was added. The existing bounded request queue remains.

## Verification

Final production build `Ih7Qnx4wmsAnHfp6IZ4Q9` passes type checking and lint (0 errors, 22 existing warnings). Ordinary tests: **1,438 total, 1,386 passed, 0 failed, 52 environment-gated skips**. All selected live suites were then run without skips: **56 passed**, including real Auth/session revocation, signup privacy, account data, Settings, navigation, summary privacy and the new resident cases. Focused component/hook tests: **34 passed**; final affected live navigation pass: **20 passed**, followed by the complete 56-test pass after measurement. Overlapping suites are not additive counts.

Disposable provisioning passed 38 checks. Native PostgreSQL concurrency passed 3; fresh/legacy migration validation passed 57 migrations, with browser roles denied across 78 RLS tables. Those checks ran before the final client cursor fix; no server, schema, Auth or concurrency implementation changed afterward. `TEST_RESULTS.json` and `tests/` identify each pass and the retained development failures. The final source manifest verifies all 909 application source files against the measured build.

The new coverage checks pending-owner changes, obsolete completions/setters, one active read, latest-scope coalescing, disabled scopes, validated initial data, denial, effect replay and local cursor reset. Real browser cases check bounded rows, request-free local controls, invalid numeric input, pending-refresh hiding, refreshed anonymous projection and denial after membership/account/session revocation. Existing selected-tab, privacy, complete quick-review/voting, rapid switching and draft-continuity acceptance cases remain.

Development logs are retained. The new hook fixture initially implemented `useCallback` incorrectly, and the account-disable fixture initially assigned a backup owner in only one of two clubs; both were corrected in tests while retaining the real database safeguard. Review also found the old local cursor could belong to a different membership identity. Its regression test and fix precede the final build and comparison.

## Measurement

Fresh local production builds share reserved disposable Auth/database credentials and independent enriched 100/1,000/5,000 cohorts. BA then AB blocks use one warmup and five measured samples per build/path/condition/block. Initial list/detail navigation uses cold/warm browser conditions. Warm next-page and distant-search interactions use 1,000/5,000 applicants. Every planned outcome, error and transport flag is retained without retries or product delays. The server/database work remains O(N).

Cold means first target visit in a fresh browser context, not deployment cold start. Browser content observations plus two animation frames determine usefulness; interaction clocks begin at the actual click/input event, with driver waiting retained separately. At n=10, nearest-rank p95 is the maximum. Timed traffic and source preparation are reported separately so the larger initial summary is not hidden by measuring only a later interaction. Loader probes use real Auth/PostgreSQL with the existing adapted Next cookie/support context and two warmups plus 20 retained samples per case; these are not HTTP timing measurements.

The preliminary collection in `comparison/` is excluded in full after the cursor review fix. `PRELIMINARY_SOURCE.json` identifies its build. Final claims use the complete frozen repeat in `comparison-final/`. No individual row is replaced. Temporary awake assertions and read-only power-log checks distinguish actual Sleep/Wake/DarkWake events from scheduled wake requests; an interrupted whole collection would be retained and excluded.

## Results

### Entry into Applicants

Before is Phase 6; after is Phase 7. Click-to-useful-content milliseconds are p50 / p95. Each timed entry dispatches exactly one fresh summary/page GET. Cold entry has 5 total timed requests in both builds (including chunks); warm entry has 1. Encoded body bytes below are for that summary GET, not the full route or decompressed object.

| Applicants | Browser | Before ms | After ms | Read bytes before → after |
|---:|---|---:|---:|---:|
| 100 | cold | 70.3 / 80.0 | 66.4 / 77.9 | 7,214 → 6,945 |
| 100 | warm | 56.9 / 63.5 | 58.9 / 63.6 | 7,214 → 6,945 |
| 1,000 | cold | 99.4 / 105.6 | 100.3 / 115.3 | 7,272 → 71,079 |
| 1,000 | warm | 91.2 / 105.7 | 92.2 / 105.7 | 7,272 → 71,079 |
| 5,000 | cold | 223.4 / 234.3 | 242.8 / 267.0 | 7,284 → 353,547 |
| 5,000 | warm | 207.3 / 220.0 | 227.7 / 240.2 | 7,284 → 353,547 |

There is no reliable entry-speed improvement here. At 100 applicants, warm entry is 2.0 ms slower at p50; at 1,000, p50 is essentially unchanged and cold p95 rises 9.7 ms. At 5,000, cold entry p50/p95 rises 19.4/32.7 ms, and warm entry rises 20.4/20.2 ms. Initial GET count stays unchanged. The larger complete summary makes serialization, compression, body consumption and local projection more expensive; it does not reduce the existing database scan.

### Local interactions

| Applicants | Interaction | Before ms | After ms | GETs before → after | Encoded read bytes before → after |
|---:|---|---:|---:|---:|---:|
| 1,000 | next-page | 98.0 / 113.1 | 30.1 / 30.8 | 1 → 0 | 7,921 → 0 |
| 1,000 | distant-search | 95.0 / 110.7 | 27.2 / 28.1 | 1 → 0 | 760 → 0 |
| 5,000 | next-page | 229.4 / 230.1 | 29.8 / 31.7 | 1 → 0 | 7,967 → 0 |
| 5,000 | distant-search | 227.1 / 227.9 | 26.4 / 27.8 | 1 → 0 | 760 → 0 |

The candidate has no network/server sample for these local interactions: its TTFB and server phases are **not applicable**, rather than zero-duration server executions. Its observable local paint still takes 26–32 ms. At 5,000, next-page p50 drops 87.0% and search 88.4%. Each interaction avoids another full guarded O(N) read, while fresh entry, refresh and server-only scopes still incur it.

The initial 5,000-row transfer adds 346,263 encoded bytes. A simple body-byte comparison needs about 44 subsequent next-page reads (7,967 bytes each), or 456 of these single-result searches (760 bytes each), to offset that added body. This is only an illustrative byte calculation; no user navigation mix or real-world break-even was measured. Interaction latency and server work improve well before byte usage breaks even.

### Network and server phases

Warm initial list reads, milliseconds p50 / p95. Complete phase distributions are in `comparison-final/SERVER_PHASES.json`; all cold/warm browser metrics are in `COMPARISON.json`.

| Applicants | TTFB before → after | Server total before → after | DB before → after | Serialization before → after |
|---:|---:|---:|---:|---:|
| 100 | 30.12/34.22 → 30.48/32.41 | 28.60/32.89 → 29.11/30.19 | 6.20/6.71 → 6.28/6.41 | 0.45/1.35 → 0.46/1.37 |
| 1,000 | 59.10/69.21 → 59.43/70.22 | 57.55/65.97 → 58.03/68.74 | 28.90/34.50 → 28.98/29.78 | 1.21/1.68 → 3.60/14.39 |
| 5,000 | 177.05/188.59 → 193.00/203.19 | 175.52/186.36 → 191.35/201.62 | 130.95/139.78 → 133.69/136.57 | 0.50/1.59 → 15.77/23.18 |

At 5,000 warm applicants, identity p50 is 19.22 → 20.06 ms, live-session span 0.44 → 0.46 ms, interactive transaction acquisition 0.47 → 0.41 ms, and transaction span 150.18 → 152.28 ms. Compression grows 0.22 → 6.64 ms and body transfer 0.34 → 2.31 ms on the local link. Acquisition observes the interactive transaction boundary, not a pure database pool wait. Spans overlap, so their medians must not be summed. No pool saturation was established by this single-browser run.

At 5,000, timed warm browser task duration rises 46.08 → 57.43 ms, while script execution is 15.77 → 15.35 ms. Cold task duration rises 70.51 → 77.40 ms. Source/timed requests, total bytes, script bytes, CPU work, readiness and pair medians remain available in the JSON; this is not just a selected-payload comparison. Browser React commit counts are retained, but actual React render-duration instrumentation is unavailable (`null`); no React render-time claim is made.

### Detail opening and source preparation

| Applicants | Browser | Detail before ms | Detail after ms | Source useful-content before → after ms | Source encoded bytes before → after |
|---:|---|---:|---:|---:|---:|
| 100 | cold | 79.3 / 80.4 | 79.6 / 81.2 | 219 → 213 | 1,076,088 → 1,075,959 |
| 100 | warm | 96.9 / 98.4 | 97.4 / 112.8 | 230 → 213 | 1,076,088 → 1,075,959 |
| 1,000 | cold | 79.9 / 84.3 | 79.7 / 81.3 | 246 → 251 | 1,076,144 → 1,140,090 |
| 1,000 | warm | 97.5 / 212.1 | 97.1 / 97.8 | 266 → 259 | 1,076,021 → 1,140,090 |
| 5,000 | cold | 83.3 / 98.0 | 96.5 / 97.2 | 375 → 389 | 1,076,171 → 1,422,573 |
| 5,000 | warm | 96.2 / 99.1 | 85.4 / 98.5 | 386 → 398 | 1,076,171 → 1,422,573 |

The detail transport/query is unchanged: one fresh detail GET, 4 total timed requests, and an encoded detail body of 1,865 bytes at 100 or 1,869 at 1,000/5,000. There is no designed detail optimization. The 5,000 cold detail p50 regresses 13.2 ms while warm p50 falls 10.8 ms; these inconsistent changes are not evidence of a reliable gain. The retained 100 warm candidate p95 rises 98.4 → 112.8 ms with a 51.60 ms server/43.87 ms identity maximum. The 1,000 baseline warm maximum is 212.1 ms (133.16 ms server, 88.99 ms database); it was not removed. Do not attribute that outlier reduction to this client-only change.

The detail clock starts after the source applicant page is ready. Source cost is therefore reported separately: at 5,000 its median complete traffic rises about 346 KB, and warm source p95 rises 410 → 432 ms. At 1,000 warm, one candidate source preparation dispatches two summary GETs (71,079 bytes each), 63 total requests and 429 ms useful-content latency. The exact authority/lifecycle trigger is unconfirmed because the sanitized trace does not record client authority events. This observation is retained, increases source p95, and remains a pre-publication investigation item. It is not counted as a timed detail request or hidden by a retry.

### Loader probes and failures

The server loaders are unchanged in this phase. At 5,000, baseline/candidate narrow-list loader p50 is 155.85/150.64 ms and paged loader p50 is 151.83/157.56 ms. Both use 13 Prisma statements and one remote identity verification per sample. These variations are local execution noise, not query optimizations. The candidate page probe maximum 378.39 ms is retained. The full detail-heavy legacy loader uses about 42.37 MB of JSON; it remains absent from list navigation. Complete narrow list JSON is 3,003,626 bytes, page JSON 59,257 bytes, selection 690,018 bytes and single detail 8,957 bytes. Those raw JSON sizes differ from HTTP encoded bodies. SQL inspections confirm list reads do not select omitted essays/profile/experience/review-text detail columns.

The accepted collection has **384 browser outcomes: 320 measured and 64 warmups**, plus **600 measured loader samples**, with **0 navigation failures, 0 page errors and 0 HTTP errors**. Every planned row is retained. There are 37 request-failure flags after HTTP 200 for the existing recruitment-cycle Server Action: 16 measured per build, plus 2 baseline/3 candidate warmups, all with positive captured body bytes. They do not establish full body consumption and are reported separately from HTTP/navigation errors. The 288 source SSE requests remain pending as expected; there are no pending non-SSE source observations. Interaction requests have no failure flags. See `TRANSPORT_FLAGS.json`.

Both the accepted and excluded collections have power audits with no actual sleep interruptions. Only the final build’s complete repeat supplies the claims above; the excluded preliminary 384 outcomes and 600 loader samples are not pooled into them.

## Recommendation and limits

Keep this branch as a measured alternative; do not merge or deploy it automatically. The strong local interaction gain comes with a roughly 48.5× larger initial 5,000-applicant encoded body, slower entry, O(N) client/server work and snapshot freshness semantics. Slower links and memory-constrained devices may make that tradeoff worse; this study cannot choose a universal default.

For Phase 8, compare a database-bounded implementation of the existing paged transport against this resident alternative, keeping canonical anonymous projection, review-score visibility barriers, global counts/facets, stable ordering, complete explicit selections and all live guards. Prototype query changes without production schema/index changes. Validate with realistic network/CPU limits and representative concurrent clients; measure pool waits, browser heap and whole-entry bytes as well as click latency. Investigate the extra source summary read with sanitized client authority-event tracing before publication. Preserve required fresh reads rather than treating fewer requests alone as success.

A release decision also needs an explicit product freshness policy for already released summaries. This implementation does not fetch new protected fields on local search/page changes and is not evidence that every click observes a remotely revoked membership or newly enabled anonymity. Required fresh reads still deny access in the real revocation tests; known authority/privacy changes hide and replace the local set.

The complete response, browser metadata and canonical filtering still grow with N. Only rendered rows are bounded. Local interactions use the already released snapshot; current protected details, explicit candidate selections and server writes revalidate independently. Hosted/mobile latency, deployment cold starts and representative concurrent-client pool/heap behavior are not established by this local study. The existing 2,000-candidate voting-session write limit remains unchanged.

`IMPLEMENTATION.diff`, test/benchmark summaries, both raw collections, source/build manifests and the evidence hash inventory contain the review trail. Owned services, credentials and temporary snapshots are cleaned up after collection; the final ignored candidate build is retained. No production or persistent power setting changes.
