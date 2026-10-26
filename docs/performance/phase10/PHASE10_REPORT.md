# OutClass performance — Phase 10

Phase 10 lets rendered text select the existing font faces, removing unused italic font preloads from the root layout. The measured constrained 5,000-applicant warm-destination source load is **5,888.0 / 5,915.0 → 4,646.0 / 4,726.0ms p50 / p95**. Initial font transfers fall **4 → 2**, and font bytes fall **428,672 → 227,784**, a reduction of **200,888 bytes**. The font files, weights, italic faces, fallbacks and display behavior remain available. This is an initial-document optimization; the later destination click has its own results below.

The direct baseline is Phase 9 `c80a370a482aa6b7398b1b4598c1c6bda0426736`; audit reference `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. The branch is `codex/performance-phase10-20261025` in the existing attached managed worktree. This candidate remains local. The unpublished series' earlier database-tail and resident-list/freshness decisions remain unresolved.

## Change and security boundary

Only `app/layout.tsx` changes in application code: `preload: false` on the two existing `next/font/local` groups. All other **912 application files** match the baseline. All four font file hashes match. The installed Next 15.5.27 loader applies the group's preload flag to each face; the browser previously transferred both italic files even without italic text. [Next's font reference](https://nextjs.org/docs/app/api-reference/components/font#preload) describes the shared group setting. No font subset, family replacement or external font service is introduced.

Every actual protected request still uses the existing remote identity, live session/revocation, enablement, membership, capabilities, suspension, support-session, anonymous interview and voting authority checks. No successful authorization is cached and no protected content is shown before those checks. Private no-store/Cookie handling, Demo isolation and all mutations are unchanged. No production infrastructure, database/schema/index, dependency or security policy changes. The current Supabase changelog was checked for the disposable local fixture; no Supabase API was changed.

The harness adds observation of font readiness, paint and layout shifts. It does not change readiness predicates, inject product delays, force fonts or garbage collection, intercept benchmark responses, or change request dispatch. The separate font regression tests insert italic text after initial assertions to verify on-demand loading; those probes are absent from accepted timings.

## Verification

| Check | Result |
|---|---|
| Candidate ordinary suites | 1,405 passed, 57 environment-gated skips, 0 failures; 1,462 total |
| Existing live Auth/account/privacy/revocation/navigation/settings | 59 passed, 0 failures/skips; serialized with 1,000 applicants |
| New built font acceptance | 2 passed, desktop 1440px and mobile 390px |
| Native security/concurrency | 3 passed |
| Disposable normal signup/TOTP provisioning | 38 passed |
| Fresh/legacy migrations and browser-role denial | 57 migrations; 78 RLS tables |
| Production build / typecheck | Passed |
| Lint | 0 errors; 22 existing warnings |

Counts overlap and must not be added. All **61 live cases** passed across the existing and new suites. The new checks verify two actual upright font transfers, no font preload hints, two still-unloaded italic faces initially, then successful real italic font loading from CSS at variable weights 400/600. They report no browser script errors. Existing tests retain request transport/strict arguments, duplicate elimination, scheduler/review draft continuity, rapid switching, late-response fences, live revocation, authorization scopes and native metadata parity. Optional gated suites not exercised remain explicitly skipped. `TEST_RESULTS.json` and `tests/` retain results; the initial pre-change ordinary run is separate from final candidate verification.

## Measurement

Matched frozen builds and independent 1,000/5,000-applicant synthetic cohorts; BA then AB blocks; one warmup and five measured outcomes per build/block/path/condition. Each group has n=10; nearest-rank p95 is the maximum. Profiles are local unthrottled and CDP 80ms latency, 200,000 B/s down, 93,750 B/s up, CPU 4×. A temporary awake assertion and read-only power-log audit cover each complete collection. All planned warmups, slower rows, errors, failed/pending transports and source traffic are retained. No test/build from this task competed with accepted collection.

**Source** begins with navigation to the preceding workspace in a fresh browser context; its useful-content clock uses the existing visible DOM predicate. The cold/warm label describes the *later destination*, so a warm-destination source is still a fresh initial document. **Click** uses the existing content predicate plus two animation frames. Source observation elapsed time (including the existing bounded non-SSE drain), font settlement and FCP are separate observations; late pending snapshots do not establish complete transport termination or full byte accounting; this change does not move the clock or subtract font downloads. Font readiness resolves after DOMContentLoaded through the browser's font set. Source CLS is the largest layout-shift session window, excluding recent input, from the observed source interval.

The complete first local collection is retained in `interrupted-local-1/` and excluded by the predeclared power rule: 192 initial/detail outcomes and 96 interactions, including two timed-out outcomes, overlap actual host Sleep/DarkWake events. `EXCLUSIONS.json` records this independently of whether individual rows were fast or slow. The subsequent user-requested pause also retains 100 recorded initial/detail outcomes and 48 interactions in `paused-local-2/`; an in-flight block was terminated. Neither partial set is pooled into accepted results. Both frozen builds, 913 candidate source hashes, restored cohort sizes and fresh authenticated page reads were verified at resumption; local connection/key values stayed identical. The source, builds and cohorts were unchanged for the replacement collection.

Accepted: **384 initial/detail browser outcomes (320 measured, 64 warmups)**, **192 warm page/search outcomes (160 measured, 32 warmups)** and **336 native HTTP outcomes (280 measured, 56 warmups)**. Browser interactions are separate from initial source timing. Native HTTP uses the same `pipelinePage` GET in both variants, at 1/2/4 readers, with pool limit eight and an aggregate nominal 25ms sampler. It follows constrained browser blocks in fixed level order and does not isolate database engine execution or multi-user saturation. These loopback results do not establish hosted performance.

## Initial source and destination click

All numbers below are p50 / p95 ms. Full request/server/CPU/byte distributions and every worsening metric remain in `BENCHMARK_RESULTS.json` and `REGRESSIONS.json`; selected slow source rows with request timelines remain in `SOURCE_PEAKS.json`, and maximum click/interaction/native-request rows remain in `PEAKS.json`.

| Profile | Applicants | Destination / visit | Source before | Source after | Click before | Click after |
|---|---:|---|---:|---:|---:|---:|
| local | 1,000 | List / cold | 292.0 / 338.0 | 287.0 / 323.0 | 79.7 / 125.1 | 81.0 / 180.7 |
| local | 1,000 | List / warm | 284.0 / 331.0 | 267.0 / 309.0 | 70.6 / 89.2 | 63.4 / 86.8 |
| local | 1,000 | Detail / cold | 254.0 / 468.0 | 252.0 / 987.0 | 95.4 / 154.5 | 80.6 / 168.2 |
| local | 1,000 | Detail / warm | 328.0 / 453.0 | 284.0 / 354.0 | 97.7 / 208.6 | 99.0 / 141.3 |
| local | 5,000 | List / cold | 286.0 / 449.0 | 279.0 / 486.0 | 107.9 / 164.1 | 97.8 / 311.3 |
| local | 5,000 | List / warm | 352.0 / 594.0 | 258.0 / 296.0 | 90.5 / 202.1 | 89.5 / 184.7 |
| local | 5,000 | Detail / cold | 250.0 / 534.0 | 246.0 / 454.0 | 84.3 / 171.9 | 79.7 / 100.7 |
| local | 5,000 | Detail / warm | 355.0 / 643.0 | 337.0 / 942.0 | 97.3 / 164.3 | 97.7 / 145.0 |
| constrained | 1,000 | List / cold | 5,890.0 / 6,759.0 | 4,644.0 / 4,662.0 | 454.4 / 543.9 | 431.1 / 441.7 |
| constrained | 1,000 | List / warm | 5,887.0 / 5,955.0 | 4,658.0 / 4,771.0 | 217.3 / 231.7 | 216.1 / 233.0 |
| constrained | 1,000 | Detail / cold | 6,119.0 / 6,229.0 | 4,883.0 / 5,149.0 | 265.5 / 296.8 | 265.6 / 454.4 |
| constrained | 1,000 | Detail / warm | 6,122.0 / 6,256.0 | 4,872.0 / 4,946.0 | 250.0 / 317.6 | 240.5 / 295.6 |
| constrained | 5,000 | List / cold | 5,881.0 / 5,990.0 | 4,652.0 / 5,170.0 | 455.9 / 476.0 | 445.0 / 467.1 |
| constrained | 5,000 | List / warm | 5,888.0 / 5,915.0 | 4,646.0 / 4,726.0 | 217.5 / 289.9 | 213.7 / 216.5 |
| constrained | 5,000 | Detail / cold | 6,130.0 / 6,373.0 | 4,876.0 / 4,892.0 | 263.2 / 280.0 | 261.0 / 283.9 |
| constrained | 5,000 | Detail / warm | 6,148.0 / 6,669.0 | 4,876.0 / 4,883.0 | 238.3 / 252.0 | 239.2 / 252.1 |

| 5,000 warm-destination source | Local before → after p50 / p95 | Constrained before → after p50 / p95 |
|---|---:|---:|
| Requests | 58.0 / 58.0 → 56.0 / 56.0 | 59.0 / 59.0 → 59.0 / 59.0 |
| Observed encoded body bytes | 1,038,129.0 / 1,038,129.0 → 837,157.0 / 837,157.0 | 1,038,172.0 / 1,038,173.0 → 837,244.0 / 837,245.0 |
| Script bytes | 543,405.0 / 543,405.0 → 543,419.0 / 543,419.0 | 543,405.0 / 543,405.0 → 543,419.0 / 543,419.0 |
| Font requests | 4.0 / 4.0 → 2.0 / 2.0 | 4.0 / 4.0 → 2.0 / 2.0 |
| Font bytes | 428,672.0 / 428,672.0 → 227,784.0 / 227,784.0 | 428,672.0 / 428,672.0 → 227,784.0 / 227,784.0 |
| Font-set readiness ms | 96.9 / 278.9 → 116.7 / 130.1 | 4,715.5 / 4,736.8 → 4,534.9 / 4,580.9 |
| First contentful paint ms | 108.0 / 264.0 → 80.0 / 92.0 | 996.0 / 1,008.0 → 576.0 / 612.0 |
| CLS | 0.000000 / 0.000000 → 0.000000 / 0.000000 | 0.000004 / 0.000004 → 0.000016 / 0.001919 |
| Source observation elapsed ms (bounded drain) | 436.0 / 677.0 → 341.0 / 380.0 | 6,005.0 / 6,032.0 → 4,772.0 / 4,876.0 |

| 5,000 warm list click | Local before → after p50 / p95 | Constrained before → after p50 / p95 |
|---|---:|---:|
| Requests | 1.0 / 1.0 → 1.0 / 1.0 | 1.0 / 1.0 → 1.0 / 1.0 |
| Encoded body bytes | 7,272.0 / 7,272.0 → 7,272.0 / 7,272.0 | 7,272.0 / 7,272.0 → 7,272.0 / 7,272.0 |
| Read TTFB ms | 62.1 / 169.6 → 54.1 / 154.2 | 88.7 / 163.3 → 86.8 / 89.7 |
| Server total ms | 60.7 / 166.2 → 52.7 / 152.5 | 61.0 / 157.3 → 64.0 / 72.9 |
| Identity verification ms | 21.7 / 32.3 → 21.0 / 29.0 | 24.4 / 40.8 → 26.2 / 30.8 |
| Database span ms | 21.8 / 123.1 → 18.5 / 118.7 | 23.7 / 118.6 → 20.4 / 29.9 |
| Serialization ms | 0.6 / 1.7 → 0.4 / 0.5 | 0.6 / 2.8 → 0.6 / 0.9 |
| Transfer ms | 0.4 / 0.6 → 0.4 / 0.5 | 38.4 / 39.9 → 38.1 / 38.8 |
| Network drain ms | 66.1 / 173.8 → 57.9 / 157.4 | 142.2 / 216.3 → 140.2 / 142.2 |
| Browser script ms | 11.6 / 16.0 → 11.6 / 12.7 | 51.0 / 66.3 → 49.9 / 56.7 |
| Browser task ms | 37.0 / 53.5 → 36.9 / 40.6 | 155.3 / 218.0 → 172.6 / 188.2 |

Each timed entry/detail retains one protected read. Complete captured list request counts remain five cold and one warm in both variants; detail remains four. Source and click are different waits and must not be pooled into one percentile. The font change removes bytes from the real initial navigation, while the same JavaScript and guarded data paths still run. Font hints are disabled globally, so used faces are discovered through CSS; routes that use italic text may still transfer all four faces. Public-page/font-paint behavior beyond these workspace samples has not been established as a performance gain.

The constrained 5,000 warm-destination source median request count stays 59 despite two fewer font requests: across ten measured sources, the candidate records ten additional `/api/platform/view-as` requests and nine additional favicon requests. Unthrottled median source requests fall 58 → 56. These are captured observations of the startup sequence, not evidence that mandatory validation can be removed. Script bytes increase by 14; this is not a demonstrated JavaScript bundle reduction. The measured constrained source CLS maximum increases from 0.000004 to 0.001919, and unthrottled 5,000 warm-source font readiness median increases 96.9 → 116.7ms. Preserve these tradeoffs when assessing the startup gain.

The unchanged data paths have slower rows as well. Local 5,000 cold-list click p95 increases 164.1 → 311.3ms; the candidate maximum records server total 257.61ms, identity verification 103.21ms and database span 92.27ms. Local 1,000 detail-source p95 increases 468 → 987ms; its final pipeline read starts at 763ms and ends at 960ms, with server total 194.43ms. These locate observed waits without establishing a cause. No validation was skipped to improve them.

## Warm interactions

| Profile | Applicants | Interaction | Before p50 / p95 ms | After p50 / p95 ms | Requests before → after |
|---|---:|---|---:|---:|---:|
| local | 1,000 | next-page | 95.3 / 112.3 | 96.5 / 148.6 | 1 → 1 |
| local | 1,000 | distant-search | 61.0 / 76.8 | 76.4 / 93.3 | 1 → 1 |
| local | 5,000 | next-page | 195.3 / 441.2 | 183.6 / 212.2 | 1 → 1 |
| local | 5,000 | distant-search | 93.9 / 142.3 | 78.7 / 94.0 | 1 → 1 |
| constrained | 1,000 | next-page | 200.4 / 211.8 | 201.1 / 207.7 | 1 → 1 |
| constrained | 1,000 | distant-search | 123.1 / 132.3 | 116.8 / 129.2 | 1 → 1 |
| constrained | 5,000 | next-page | 262.6 / 347.6 | 262.2 / 287.0 | 1 → 1 |
| constrained | 5,000 | distant-search | 125.3 / 133.8 | 118.4 / 143.0 | 1 → 1 |

## Native HTTP diagnostic

| Applicants | Simultaneous readers | Burst before p50 / p95 ms | Burst after p50 / p95 ms |
|---:|---:|---:|---:|
| 1,000 | 1 | 46.2 / 102.0 | 46.9 / 51.8 |
| 1,000 | 2 | 51.0 / 293.0 | 50.3 / 58.6 |
| 1,000 | 4 | 73.6 / 248.0 | 63.6 / 78.6 |
| 5,000 | 1 | 134.2 / 145.6 | 140.8 / 165.1 |
| 5,000 | 2 | 148.7 / 175.0 | 155.1 / 173.5 |
| 5,000 | 4 | 191.6 / 223.2 | 206.0 / 242.8 |

The aggregate same-role sampler observes at most nine connections, four active queries, four idle-in-transaction connections and zero lock-waiting samples. It excludes the monitor and may miss short peaks; aggregate connections do not demonstrate pool saturation.

Font loading changes no server query or security code. Native HTTP changes and later click/page/search changes in these tables therefore do not demonstrate a backend optimization. Overlapping server phases must not be summed. The database span includes Prisma/transport/client scheduling, and transaction acquisition is not an isolated pool wait. The earlier Phase 9 adverse collection remains intact and unresolved even if this run has a different distribution. No identity validation was removed or bad result replaced.

## Errors, regressions and recommendation

local: 192 initial/detail outcomes and 96 interactions; 0 failed initial/detail outcomes, 0 failed interactions, 0 page errors, 0 HTTP errors. Background transport flags: 19 failed transports, 192 pending SSE and 0 other pending snapshots. Additional source pipeline reads: 4; interaction script errors including preparation: 0.

constrained: 192 initial/detail outcomes and 96 interactions; 0 failed initial/detail outcomes, 0 failed interactions, 0 page errors, 0 HTTP errors. Background transport flags: 0 failed transports, 192 pending SSE and 17 other pending snapshots. Additional source pipeline reads: 39; interaction script errors including preparation: 0.

The 19 local failed transports are recruitment-cycle Server Action responses after HTTP 200. The 17 constrained non-SSE pending source snapshots are eight view-as and nine corkboard reads. Their eventual completion is not established by a pending snapshot.

Native HTTP: 336 outcomes, 0 failures; all planned responses retain private no-store and Cookie sensitivity. Pending SSE, post-response request failures and navigation failures remain distinct. Authority events and source reads are retained without suppressing required rotations.

All worsening source/click, FCP, font settlement, CLS, interaction and HTTP-burst quantiles are enumerated here (small samples, no causal attribution for unchanged paths):

- local / 1000 / recruiting → applicants / cold, clickMs p50: 79.7 → 81.0.
- local / 1000 / recruiting → applicants / cold, clickMs p95: 125.1 → 180.7.
- local / 1000 / recruiting → applicants / cold, fontReadyMs p50: 73.5 → 115.8.
- local / 1000 / recruiting → applicants / cold, fontReadyMs p95: 90.8 → 152.2.
- local / 1000 / recruiting → applicants / warm, fontReadyMs p50: 79.2 → 110.6.
- local / 1000 / recruiting → applicants / warm, fontReadyMs p95: 87.5 → 127.9.
- local / 1000 / applicants → applicantDetail / cold, clickMs p95: 154.5 → 168.2.
- local / 1000 / applicants → applicantDetail / cold, sourceUsefulMs p95: 468.0 → 987.0.
- local / 1000 / applicants → applicantDetail / cold, fontReadyMs p50: 77.2 → 116.6.
- local / 1000 / applicants → applicantDetail / cold, fontReadyMs p95: 83.8 → 248.8.
- local / 1000 / applicants → applicantDetail / cold, sourceCLS p95: 0.000000 → 0.000004.
- local / 1000 / applicants → applicantDetail / cold, first-contentful-paintMs p95: 116.0 → 220.0.
- local / 1000 / applicants → applicantDetail / warm, clickMs p50: 97.7 → 99.0.
- local / 1000 / applicants → applicantDetail / warm, fontReadyMs p50: 84.0 → 114.7.
- local / 1000 / applicants → applicantDetail / warm, fontReadyMs p95: 93.8 → 138.7.
- local / 5000 / recruiting → applicants / cold, clickMs p95: 164.1 → 311.3.
- local / 5000 / recruiting → applicants / cold, sourceUsefulMs p95: 449.0 → 486.0.
- local / 5000 / recruiting → applicants / cold, fontReadyMs p50: 82.1 → 116.4.
- local / 5000 / recruiting → applicants / cold, fontReadyMs p95: 95.3 → 221.8.
- local / 5000 / recruiting → applicants / cold, first-contentful-paintMs p95: 116.0 → 204.0.
- local / 5000 / recruiting → applicants / warm, fontReadyMs p50: 96.9 → 116.7.
- local / 5000 / applicants → applicantDetail / cold, fontReadyMs p50: 69.8 → 112.4.
- local / 5000 / applicants → applicantDetail / cold, fontReadyMs p95: 94.2 → 133.7.
- local / 5000 / applicants → applicantDetail / warm, clickMs p50: 97.3 → 97.7.
- local / 5000 / applicants → applicantDetail / warm, sourceUsefulMs p95: 643.0 → 942.0.
- local / 5000 / applicants → applicantDetail / warm, fontReadyMs p50: 70.3 → 119.8.
- local / 5000 / applicants → applicantDetail / warm, fontReadyMs p95: 110.4 → 134.5.
- local / 5000 / applicants → applicantDetail / warm, first-contentful-paintMs p50: 76.0 → 80.0.
- constrained / 1000 / recruiting → applicants / cold, sourceCLS p50: 0.000004 → 0.000016.
- constrained / 1000 / recruiting → applicants / cold, sourceCLS p95: 0.000004 → 0.001919.
- constrained / 1000 / recruiting → applicants / warm, clickMs p95: 231.7 → 233.0.
- constrained / 1000 / recruiting → applicants / warm, sourceCLS p50: 0.000004 → 0.000016.
- constrained / 1000 / recruiting → applicants / warm, sourceCLS p95: 0.000004 → 0.001919.
- constrained / 1000 / applicants → applicantDetail / cold, clickMs p50: 265.5 → 265.6.
- constrained / 1000 / applicants → applicantDetail / cold, clickMs p95: 296.8 → 454.4.
- constrained / 1000 / applicants → applicantDetail / cold, sourceCLS p95: 0.000004 → 0.000016.
- constrained / 1000 / applicants → applicantDetail / warm, fontReadyMs p95: 4,723.5 → 4,868.5.
- constrained / 1000 / applicants → applicantDetail / warm, sourceCLS p95: 0.000004 → 0.001919.
- constrained / 5000 / recruiting → applicants / cold, fontReadyMs p95: 4,732.0 → 4,866.0.
- constrained / 5000 / recruiting → applicants / cold, sourceCLS p50: 0.000004 → 0.000016.
- constrained / 5000 / recruiting → applicants / cold, sourceCLS p95: 0.000004 → 0.001919.
- constrained / 5000 / recruiting → applicants / warm, sourceCLS p50: 0.000004 → 0.000016.
- constrained / 5000 / recruiting → applicants / warm, sourceCLS p95: 0.000004 → 0.001919.
- constrained / 5000 / applicants → applicantDetail / cold, clickMs p95: 280.0 → 283.9.
- constrained / 5000 / applicants → applicantDetail / cold, sourceCLS p95: 0.000004 → 0.000016.
- constrained / 5000 / applicants → applicantDetail / warm, clickMs p50: 238.3 → 239.2.
- constrained / 5000 / applicants → applicantDetail / warm, clickMs p95: 252.0 → 252.1.
- constrained / 5000 / applicants → applicantDetail / warm, fontReadyMs p95: 4,730.6 → 4,801.8.
- constrained / 5000 / applicants → applicantDetail / warm, sourceCLS p95: 0.000004 → 0.001919.
- local / 1000 / next-page, meaningfulMs p50: 95.3 → 96.5.
- local / 1000 / next-page, meaningfulMs p95: 112.3 → 148.6.
- local / 1000 / distant-search, meaningfulMs p50: 61.0 → 76.4.
- local / 1000 / distant-search, meaningfulMs p95: 76.8 → 93.3.
- constrained / 1000 / next-page, meaningfulMs p50: 200.4 → 201.1.
- constrained / 5000 / distant-search, meaningfulMs p95: 133.8 → 143.0.
- 1000 / 1, burstMs p50: 46.2 → 46.9.
- 5000 / 1, burstMs p50: 134.2 → 140.8.
- 5000 / 1, burstMs p95: 145.6 → 165.1.
- 5000 / 2, burstMs p50: 148.7 → 155.1.
- 5000 / 4, burstMs p50: 191.6 → 206.0.
- 5000 / 4, burstMs p95: 223.2 → 242.8.

Keep this as a focused font-transfer improvement and hold publication of the complete series. A multi-second initial wait can remain after removing 201 KB, and the JavaScript startup/download path still needs attention. The next phase should use the retained source request waterfall to isolate eager feature imports and measure the full source interval, while profiling the unresolved 5,000-applicant server tails separately. Preserve the O(N) scalar scan, fresh-query interaction policy and hosted/multi-user limits as explicit risks; do not infer that this font change resolves them.

`IMPLEMENTATION.diff` contains application, harness and regression-test changes. Frozen source manifests, plans/protocols, power audits, raw observations, derived comparisons, test logs, privacy scan, cleanup record, evidence inventory and checksums accompany this report. No push, PR, merge or deployment was performed.
