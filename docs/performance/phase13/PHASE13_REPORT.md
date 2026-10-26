# OutClass performance — Phase 13

Phase 13 confirms the existing Phase 12 request-ordering change and adds separate local diagnosis of retained server waits. **No application files change in this phase.** In the complete constrained comparison, multiple-read source preparations change **42 → 0**, and captured source pipeline requests change **90 → 48**. The 5,000-applicant warm-list click p50 / p95 is **216.0 / 947.6 → 213.7 / 220.5ms**; its fresh source useful-content time is **4,307.0 / 4,606.0 → 4,279.0 / 4,339.0ms**. These are newly collected matched observations; previous Phase 12 adverse/confounded rows remain immutable and are not pooled here.

Latency did not improve consistently. The constrained 1,000-applicant warm-list click p50 / p95 changes **214.9 / 263.5 → 214.2 / 900.8ms**. A candidate local cold source takes **1,984ms**, with an identity phase as long as **1,510.58ms** despite passing the sampled host controls. Fewer requests is a repeatable finding here; broad tail-latency improvement and the cause of these stalls remain unproven.

Comparison: Phase 11 `327f7de5d8dad3381f0db258956d0b8b6424a6af` versus Phase 12 `983e7c3955f935fa62174e3bfbb008ee93bebade`. Audit reference `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Frozen builds: baseline `FJlbO_nyh2c0U6fcP8a90`, candidate `HbO5MM7Mc45LPU0Atg1Z-`. Branch `codex/performance-phase13-20261026`. No push, PR, merge or deployment.

## What changed and what remains protected

The new code is outside the production application: an async comparison runner, read-only host monitor, opt-in disposable-server preload, bounded diagnostic probes and three regression checks. The host sampler includes descendants of foreign development/test/build processes, records the original checkout baseline at the start of each profile and checks frozen sources/package manifests. The diagnostic preload correlates non-sensitive incoming request IDs with the UUID from the existing sanitized workspace phase log, and observes loopback Auth HTTP lifecycle stages. It refuses hosted/unreserved endpoints and does not modify response handling.

All 913 candidate application files match Phase 12. Only the same two application files differ between the comparison builds: `contexts/auth-context.tsx` and `components/selected-club-workspace.tsx`. The synchronous opaque epoch fence avoids an already-obsolete read before React commits and fences stale result settlement. Genuine later Auth changes still request fresh authorization; visits never borrow a previous successful authorization or protected result. Code/data still start together for a current scope. Phase 10 fonts and Phase 11 module boundaries, dirty-draft ownership and necessary live updates remain.

Remote identity verification, live session/revocation SQL, enabled accounts, membership/capabilities/suspension, support restrictions, anonymous interview protections, voting snapshot authority, private no-store/Cookie sensitivity and Demo isolation are unchanged. Mutations remain Server Actions. No production Supabase/Vercel configuration, database region/schema/index, security policy, dependency, cache library, Redis or Edge Function change.

## Verification

| Check | Result |
|---|---|
| Ordinary suite | 1,411 passed; 63 environment-gated skips; 0 failures; 1,474 total |
| Full serialized live suite | 67 passed; 0 failures; 0 skips |
| Dedicated native security/concurrency | 3 passed |
| Normal signup/Auth/TOTP provisioning | 38 passed |
| Fresh/legacy schema and browser-role denial | 57 migrations; 78 RLS tables |
| Final diagnostics guard/privacy/context checks | 3 passed; overlap ordinary coverage |
| Builds, types and lint | Both production builds and type checks passed; lint 0 errors,22 existing warnings |

Counts overlap and must not be added. Existing transport, duplicate elimination, independent Interview Rooms dispatch, scheduler/settings/review draft continuity, rapid switching, mobile/pointer navigation, live authority, revocation, anonymous/support scopes and native metadata parity checks remain.63 optional gates are explicitly skipped in the ordinary suite; selected live/native suites are exercised separately, not every optional suite.

The first native-security invocation used the general disposable fixture. All three safety guards refused its database name before connecting or executing test SQL. The correct dedicated disposable runner then passes all three cases; both logs remain. Preflight development issues also remain: a preparation-time checkout baseline was too early for a measurement-start control, and Next response wrappers did not expose this trace header through the initial observer. The final monitor anchors each whole profile at its own start, and the final observer uses the already-sanitized phase log within the same async context. Final focused tests and a live private GET verify correlation before any accepted sample. No application assertion, readiness predicate or timeout was weakened.

## Controls and sample membership

The user confirmed an open lid and idle host. An unrelated development service was preserved. Five-second samples monitor known foreign Next build/Node test work, development-worker CPU, original checkout state, power source/mode, total host CPU and free memory. All source and runtime package manifests are checked at block boundaries. Sampling can miss brief activity and does not prove exclusive host access, fixed CPU frequency or controlled thermal state. No experiment-launched tests/builds or primary collector edits compete with accepted collection.

One startup attempt was rejected before any application start or outcome because its AC-only guard no longer matched battery power. The complete zero-row attempt is retained in `excluded-power-startup-1/`. Before collecting any timing row, the condition was declared as one recorded initial power source and low-power mode0 throughout each profile, using the user's earlier authorization to continue on battery. This does not remove or replace a slow row. Actual Sleep/Wake/DarkWake audits independently cover both accepted intervals. Excluded preflight observations are not performance data.

Synthetic independent 1,000/5,000-applicant cohorts; identical within each build pair; BA then AB; local and CDP 80ms,200,000B/s down,93,750B/s up,CPU 4×. Main paths: one warmup plus five measured outcomes per build/block/path/condition. Each final main group has n=10; nearest-rank p95 is its maximum. Extra feature paths retain the constrained 1,000 cohort, one warmup plus three measured outcomes (n=6,p95=max). Native primary reads remain bounded1/2/4, with eight connections per app client and25ms aggregate sampling.

Accepted membership:384 main browser outcomes (320 measured/64 warmups),128 feature outcomes (96/32),192 page/search interactions (160/32) and336 native HTTP outcomes (280/56). Fresh source navigation precedes the timed click; cold/warm describes the destination visit. Readiness and the original bounded non-SSE drain are unchanged. Body bytes are observed encoded bodies, excluding unavailable late/pending bytes and transport headers. Preparatory groups, details and existing Link intent/prefetch are outside click clocks. Source+click is each row's sum of two useful-content waits, excluding drains, preparation and warm visits; it is not uninterrupted elapsed time or a sum of percentiles.

| Profile | Start / end UTC | Host samples | Recorded power | Host controls / actual sleep |
|---|---|---:|---|---|
| local | 2026-10-26T18:19:29.809Z / 2026-10-26T18:23:57.834Z | 55 | Battery Power, mode0, 100% → 100% | Passed / no actual sleep interruption |
| constrained | 2026-10-26T18:24:03.282Z / 2026-10-26T18:56:45.173Z | 394 | Battery Power, mode0, 100% → 88% | Passed / no actual sleep interruption |

## Main navigation

All timings are p50 / p95 ms; requests/bytes are also shown as p50 / p95. Full network, server, CPU, bytes, fonts/FCP/CLS, maxima and every worsening quantile remain in the JSON evidence.

| Profile | Applicants | Destination / visit | Source before → after ms | Click before → after ms | Source requests before → after | Click requests before → after | Click bytes before → after |
|---|---:|---|---:|---:|---:|---:|---:|
| local | 1,000 | List / cold | 293.0 / 325.0 → 300.0 / 358.0 | 78.9 / 99.1 → 81.4 / 94.4 | 48.0 / 48.0 → 48.0 / 48.0 | 9.0 / 9.0 → 9.0 / 9.0 | 56,905.0 / 56,905.0 → 56,905.0 / 56,905.0 |
| local | 1,000 | List / warm | 260.0 / 301.0 → 308.0 / 606.0 | 69.3 / 85.9 → 74.7 / 160.7 | 48.0 / 48.0 → 48.0 / 48.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,254.0 / 7,254.0 → 7,254.0 / 7,254.0 |
| local | 1,000 | Detail / cold | 223.0 / 251.0 → 249.0 / 1,984.0 | 80.7 / 163.5 → 95.3 / 308.0 | 56.0 / 56.0 → 56.0 / 56.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,772.0 / 2,772.0 → 2,772.0 / 2,772.0 |
| local | 1,000 | Detail / warm | 283.0 / 778.0 → 265.0 / 434.0 | 99.6 / 237.1 → 97.8 / 338.5 | 56.0 / 57.0 → 56.0 / 56.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,772.0 / 2,772.0 → 2,772.0 / 2,772.0 |
| local | 5,000 | List / cold | 282.0 / 351.0 → 269.0 / 308.0 | 110.1 / 143.6 → 98.0 / 121.1 | 48.0 / 48.0 → 48.0 / 48.0 | 9.0 / 9.0 → 9.0 / 9.0 | 56,902.0 / 56,902.0 → 56,902.0 / 56,902.0 |
| local | 5,000 | List / warm | 270.0 / 389.0 → 269.0 / 426.0 | 84.6 / 96.3 → 94.8 / 177.9 | 48.0 / 48.0 → 48.0 / 48.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,251.0 / 7,251.0 → 7,251.0 / 7,251.0 |
| local | 5,000 | Detail / cold | 253.0 / 334.0 → 255.0 / 321.0 | 79.8 / 198.7 → 80.4 / 95.1 | 56.0 / 56.0 → 56.0 / 56.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,765.0 / 2,765.0 → 2,765.0 / 2,765.0 |
| local | 5,000 | Detail / warm | 284.0 / 448.0 → 330.0 / 409.0 | 97.0 / 98.1 → 97.4 / 114.0 | 56.0 / 56.0 → 56.0 / 56.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,765.0 / 2,765.0 → 2,765.0 / 2,765.0 |
| constrained | 1,000 | List / cold | 4,278.0 / 4,374.0 → 4,301.0 / 4,323.0 | 583.6 / 596.2 → 581.6 / 588.7 | 50.0 / 50.0 → 50.0 / 50.0 | 9.0 / 9.0 → 9.0 / 9.0 | 56,905.0 / 56,905.0 → 56,905.0 / 56,905.0 |
| constrained | 1,000 | List / warm | 4,289.0 / 4,832.0 → 4,320.0 / 4,779.0 | 214.9 / 263.5 → 214.2 / 900.8 | 50.0 / 50.0 → 50.0 / 50.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,254.0 / 7,254.0 → 7,254.0 / 7,254.0 |
| constrained | 1,000 | Detail / cold | 4,751.0 / 4,761.0 → 4,696.0 / 4,725.0 | 256.2 / 265.9 → 254.7 / 279.3 | 59.0 / 59.0 → 58.0 / 58.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,772.0 / 2,772.0 → 2,772.0 / 2,772.0 |
| constrained | 1,000 | Detail / warm | 4,668.0 / 4,762.0 → 4,671.0 / 4,914.0 | 239.1 / 287.3 → 239.7 / 258.7 | 58.0 / 59.0 → 58.0 / 58.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,772.0 / 2,772.0 → 2,772.0 / 2,772.0 |
| constrained | 5,000 | List / cold | 4,304.0 / 4,338.0 → 4,306.0 / 4,321.0 | 585.4 / 593.6 → 583.8 / 595.2 | 50.0 / 50.0 → 50.0 / 50.0 | 9.0 / 9.0 → 9.0 / 9.0 | 56,902.0 / 56,902.0 → 56,902.0 / 56,902.0 |
| constrained | 5,000 | List / warm | 4,307.0 / 4,606.0 → 4,279.0 / 4,339.0 | 216.0 / 947.6 → 213.7 / 220.5 | 50.0 / 50.0 → 50.0 / 50.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,251.0 / 7,251.0 → 7,251.0 / 7,251.0 |
| constrained | 5,000 | Detail / cold | 4,756.0 / 5,112.0 → 4,698.0 / 4,771.0 | 265.8 / 283.1 → 255.6 / 267.9 | 59.0 / 59.0 → 58.0 / 58.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,765.0 / 2,765.0 → 2,765.0 / 2,765.0 |
| constrained | 5,000 | Detail / warm | 4,787.0 / 5,029.0 → 4,704.0 / 4,859.0 | 239.3 / 319.1 → 239.9 / 367.0 | 59.0 / 59.0 → 58.0 / 58.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,765.0 / 2,765.0 → 2,765.0 / 2,765.0 |

|5,000 constrained warm clicks | List before → after p50 / p95 | Detail before → after p50 / p95 |
|---|---:|---:|
| Protected-read TTFB ms | 84.8 / 743.3 → 86.7 / 91.6 | 87.4 / 101.4 → 87.2 / 175.8 |
| Read transfer ms | 38.1 / 40.1 → 37.7 / 39.2 | 8.5 / 9.9 → 7.8 / 8.6 |
| Server total ms | 74.3 / 704.1 → 66.0 / 75.8 | 37.7 / 89.6 → 36.9 / 170.2 |
| Identity verification ms | 25.5 / 500.4 → 23.0 / 27.2 | 30.9 / 41.4 → 30.1 / 49.5 |
| Live-session check ms | 0.5 / 1.5 → 0.5 / 0.6 | 0.6 / 1.6 → 0.5 / 2.4 |
| Observable transaction acquisition ms | 0.5 / 1.3 → 0.5 / 0.6 | 0.4 / 0.7 → 0.5 / 6.2 |
| Database span ms | 28.1 / 132.6 → 24.9 / 29.9 | 5.8 / 41.4 → 5.4 / 107.3 |
| Transaction span ms | 46.1 / 188.0 → 40.3 / 48.9 | 5.2 / 44.0 → 4.9 / 87.2 |
| Serialization ms | 0.7 / 1.4 → 0.7 / 1.6 | 0.3 / 1.3 → 0.3 / 1.0 |
| Browser script ms | 51.2 / 93.7 → 51.1 / 53.8 | 61.5 / 103.7 → 60.2 / 79.3 |
| Browser task ms | 181.9 / 430.3 → 176.8 / 195.0 | 284.8 / 418.4 → 282.0 / 335.1 |

| Constrained source pipelinePage accounting, including warmups | Baseline | Candidate |
|---|---:|---:|
| Requests | 90 | 48 |
| Observed encoded body bytes | 652,716 | 348,120 |
| Unknown-byte snapshots | 0 | 0 |

Source read multiplicities, Auth notifications/causes and their order against the first selected-effect dispatch marker remain in `TRANSPORT_DETAILS.json`. Auth-before-dispatch uses the last observed Auth notification, so a genuinely later change is not classified as already known. Each timed main entry/detail still sends one protected pipeline read. Database and transaction spans overlap; acquisition is not isolated pool-only waiting.

## Retained first-use feature costs

| Destination / visit | Source before → after ms | Click before → after ms | Source+click before → after ms | Click requests before → after | Click bytes before → after |
|---|---:|---:|---:|---:|---:|
| overview → settingsProfile / cold | 4,280.0 / 4,297.0 → 4,111.0 / 4,415.0 | 454.7 / 458.0 → 455.2 / 466.9 | 4,735.0 / 4,751.7 → 4,560.7 / 4,881.9 | 9.0 / 9.0 → 9.0 / 9.0 | 22,866.0 / 22,866.0 → 22,866.0 / 22,866.0 |
| overview → settingsProfile / warm | 3,939.0 / 4,328.0 → 4,286.0 / 4,343.0 | 140.5 / 154.4 → 143.5 / 158.3 | 4,079.5 / 4,482.3 → 4,441.2 / 4,501.3 | 1.0 / 1.0 → 1.0 / 1.0 | 88.0 / 88.0 → 88.0 / 88.0 |
| overview → meetings / cold | 3,939.0 / 4,285.0 → 4,299.0 / 4,987.0 | 441.6 / 456.6 → 444.8 / 539.3 | 4,380.6 / 4,722.4 → 4,743.3 / 5,431.8 | 7.0 / 7.0 → 7.0 / 7.0 | 36,049.0 / 36,049.0 → 36,049.0 / 36,049.0 |
| overview → meetings / warm | 3,940.0 / 4,316.0 → 3,982.0 / 4,369.0 | 122.1 / 126.6 → 127.0 / 136.6 | 4,062.1 / 4,436.8 → 4,102.4 / 4,505.6 | 1.0 / 1.0 → 1.0 / 1.0 | 397.0 / 397.0 → 397.0 / 397.0 |
| recruiting → scheduledDecisions / cold | 3,920.0 / 3,953.0 → 3,979.0 / 4,311.0 | 448.7 / 487.7 → 438.7 / 455.0 | 4,394.6 / 4,407.5 → 4,416.2 / 4,749.7 | 4.0 / 4.0 → 4.0 / 4.0 | 8,023.0 / 8,023.0 → 8,023.0 / 8,023.0 |
| recruiting → scheduledDecisions / warm | 3,950.0 / 4,318.0 → 3,951.0 / 4,277.0 | 134.3 / 145.2 → 137.0 / 145.5 | 4,084.3 / 4,446.7 → 4,083.1 / 4,414.0 | 1.0 / 1.0 → 1.0 / 1.0 | 86.0 / 86.0 → 86.0 / 86.0 |
| settingsApplication → rounds / cold | 4,354.0 / 4,384.0 → 4,356.0 / 4,451.0 | 596.1 / 604.9 → 595.2 / 611.6 | 4,947.7 / 4,980.1 → 4,954.4 / 5,045.7 | 8.0 / 8.0 → 8.0 / 8.0 | 10,175.0 / 12,460.0 → 10,176.0 / 12,461.0 |
| settingsApplication → rounds / warm | 932.0 / 4,459.0 → 927.0 / 4,356.0 | 264.7 / 278.5 → 264.5 / 266.1 | 1,194.8 / 4,737.5 → 1,192.8 / 4,619.5 | 4.0 / 4.0 → 4.0 / 4.0 | 1,342.0 / 1,342.0 → 1,342.0 / 3,626.0 |

These paths are unchanged. Their variations do not prove that Settings first-use or anonymous review has been fixed. The Phase 11 adverse evidence and Phase 12 streamed/JavaScript-disabled diagnostic limits remain. No font, module, rendering or draft implementation changed in Phase 13.

## Warm interactions and primary native reads

| Profile | Applicants | Interaction | Before p50 / p95 ms | After p50 / p95 ms | Requests before → after |
|---|---:|---|---:|---:|---:|
| local | 1,000 | next-page | 96.8 / 184.1 | 95.8 / 129.1 | 1.0 / 1.0 → 1.0 / 1.0 |
| local | 1,000 | distant-search | 61.3 / 383.1 | 61.5 / 78.2 | 1.0 / 1.0 → 1.0 / 1.0 |
| local | 5,000 | next-page | 195.8 / 245.9 | 179.9 / 197.4 | 1.0 / 1.0 → 1.0 / 1.0 |
| local | 5,000 | distant-search | 93.6 / 127.2 | 78.3 / 100.6 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained | 1,000 | next-page | 200.1 / 208.5 | 201.2 / 214.1 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained | 1,000 | distant-search | 125.8 / 129.9 | 118.5 / 128.0 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained | 5,000 | next-page | 271.8 / 338.3 | 264.6 / 278.3 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained | 5,000 | distant-search | 117.4 / 133.9 | 118.7 / 128.1 | 1.0 / 1.0 → 1.0 / 1.0 |

| Applicants | Readers | Burst before → after p50 / p95 ms | Per-request before → after p50 / p95 ms |
|---:|---:|---:|---:|
| 1,000 | 1 | 46.7 / 60.0 → 46.9 / 48.8 | 46.7 / 60.0 → 46.9 / 48.8 |
| 1,000 | 2 | 49.9 / 52.8 → 49.6 / 63.1 | 48.9 / 50.6 → 49.4 / 56.2 |
| 1,000 | 4 | 64.9 / 92.6 → 66.8 / 86.7 | 59.6 / 88.8 → 62.8 / 81.2 |
| 5,000 | 1 | 144.2 / 213.3 → 139.8 / 146.1 | 144.2 / 213.3 → 139.8 / 146.1 |
| 5,000 | 2 | 160.0 / 178.9 → 156.3 / 164.9 | 152.7 / 162.2 → 153.9 / 164.1 |
| 5,000 | 4 | 206.0 / 229.3 → 187.9 / 206.0 | 185.7 / 219.7 → 168.6 / 196.3 |

## Separate diagnosis of identity and transaction waits

These probes are outside primary quantiles:168 instrumented native GETs,56 direct SDK identity observations,16 instrumented browser outcomes and four read-only representative metadata plans. All native GETs correlate HTTP responses, existing workspace phase UUIDs, incoming diagnostic IDs and loopback Auth HTTP stages. None of these records authorizes another request or caches a successful authorization.

| Applicants / build | Native trace correlation | Metadata plan execution ms (one diagnostic) | Max observed event-loop delay ms | Max app-role active / connections / lock waiting |
|---|---:|---:|---:|---:|
| 1,000 / baseline | 42 /42 | 11.71 | 563.09 | 5 / 9 / 0 |
| 1,000 / candidate | 42 /42 | 14.28 | 532.41 | 4 / 9 / 0 |
| 5,000 / candidate | 42 /42 | 23.01 | 504.63 | 6 / 9 / 0 |
| 5,000 / baseline | 42 /42 | 28.63 | 559.42 | 4 / 9 / 0 |

|4-reader diagnostic, measured native requests | HTTP elapsed p50 / p95 ms | Identity phase p50 / p95 ms | Auth create→send p50 / p95 ms | Auth send→headers p50 / p95 ms | Auth headers→end p50 / p95 ms | Direct SDK getUser p50 / p95 ms |
|---|---:|---:|---:|---:|---:|---:|
| 1,000 / baseline | 57.9 / 74.2 | 26.1 / 28.9 | 0.1 / 1.8 | 25.0 / 27.2 | 0.0 / 0.1 | 37.1 / 40.7 |
| 1,000 / candidate | 66.7 / 73.8 | 28.5 / 35.2 | 0.1 / 1.9 | 27.4 / 34.1 | 0.0 / 0.1 | 32.6 / 37.2 |
| 5,000 / candidate | 168.9 / 218.6 | 27.1 / 37.6 | 0.1 / 1.9 | 26.0 / 36.2 | 0.0 / 0.1 | 26.2 / 27.1 |
| 5,000 / baseline | 168.1 / 203.7 | 27.4 / 30.2 | 0.9 / 2.0 | 26.3 / 28.6 | 0.0 / 0.1 | 26.5 / 28.2 |

Largest completed incoming Auth HTTP timeline observed in the separate probes: **392.6ms**. Raw incomplete timelines are retained and counted separately. The prior Phase 12 multi-second identity span is neither discarded nor explained away by a faster diagnostic.

The adverse constrained 1,000 warm click retains 742.98ms protected-read TTFB and 732.22ms server time: identity 475.56ms, database 215.45ms and observable transaction acquisition 5.11ms. Its 900.8ms useful-content wait therefore includes a recorded server stall. The local cold source has three overlapping protected requests with identity phases around1.5s; its pipeline read alone records1,473ms identity and1,575.90ms total. These primary observations have no Undici substage instrumentation, so the faster separate probes cannot assign their cause. `PHASE_TAILS.json` identifies the exact accepted rows and phase values.

|4-reader diagnostic database spans | Database p50 / p95 ms | Observable transaction acquisition p50 / p95 ms |
|---|---:|---:|
| 1,000 / baseline | 28.9 / 40.8 | 0.6 / 2.1 |
| 1,000 / candidate | 31.6 / 36.5 | 0.7 / 1.9 |
| 5,000 / candidate | 128.6 / 174.9 | 0.7 / 1.3 |
| 5,000 / baseline | 127.0 / 164.7 | 0.7 / 1.3 |

Database spans grow with cohort size while measured acquisition remains small in these bounded probes. This supports investigating the existing metadata/query/ranking work before increasing concurrency or pool size; it does not prove that pool saturation cannot occur in hosted or multi-user workloads. No pool or query behavior changes in this phase.

Created→send bounds Undici dispatch/connection/scheduling before transmission; send→headers includes transport, provider work and scheduling; headers→end covers observable HTTP body completion. Direct SDK wall time also includes body parsing. These stages do not isolate provider CPU. Process CPU/utilization spans overlap concurrent requests, and per-second event-loop histogram maxima are not a whole-run p95. Role-aggregate DB samples exclude the monitor but may miss brief peaks and cannot assign exact per-request pool waits. Eight is a per-client pool limit; aggregate connections can exceed it across clients. Representative EXPLAIN node/timing/buffer facts retain no parameter values, SQL text or rows and do not establish the duration of the complete protected endpoint.

The diagnostic lifecycle fields follow the [Undici diagnostics documentation](https://github.com/nodejs/undici/blob/main/docs/docs/api/DiagnosticsChannel.md). The application continues remotely verified [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser) plus its separate live-session SQL check. Neither behavior is replaced by these observations.

## Errors, regressions and remaining risks

local main: 192 outcomes, 0 failed useful-content outcomes, 0 page errors and 0 HTTP errors. Background snapshots: 19 failed transports, 192 pending SSE and 0 other pending snapshots.

constrained main: 192 outcomes, 0 failed useful-content outcomes, 0 page errors and 0 HTTP errors. Background snapshots: 0 failed transports, 192 pending SSE and 180 other pending snapshots.

constrained feature: 128 outcomes, 0 failed useful-content outcomes, 0 page errors and 0 HTTP errors. Background snapshots: 25 failed transports, 128 pending SSE and 12 other pending snapshots.

local interactions: 96 outcomes, 0 failed, 0 page errors including preparation, 0 timed HTTP errors, 0 timed failed transports. Other preparation network accounting was not captured.

constrained interactions: 96 outcomes, 0 failed, 0 page errors including preparation, 0 timed HTTP errors, 0 timed failed transports. Other preparation network accounting was not captured.

Primary native reads: 336 outcomes, 0 failures; every response retains private no-store and Cookie sensitivity. Pending snapshots and post-response abort flags are distinct from failed useful-content outcomes. Exact sanitized routes, failure reasons/statuses and unknown-byte counts remain in `TRANSPORT_DETAILS.json`.

All worsening useful-content, paired-wait, interaction/burst, font/FCP and CLS quantiles are listed below, including small changes. Full other metrics remain in `REGRESSIONS.json`; small groups and p95=max do not establish statistical significance. No slow row is replaced.

- primary / local / 1000 / recruiting → applicants / cold, clickMs p50: 78.900 → 81.400.
- primary / local / 1000 / recruiting → applicants / cold, sourcePlusClickMs p50: 367.800 → 393.900.
- primary / local / 1000 / recruiting → applicants / cold, sourcePlusClickMs p95: 424.100 → 439.700.
- primary / local / 1000 / recruiting → applicants / cold, sourceUsefulMs p50: 293.000 → 300.000.
- primary / local / 1000 / recruiting → applicants / cold, sourceUsefulMs p95: 325.000 → 358.000.
- primary / local / 1000 / recruiting → applicants / cold, fontReadyMs p95: 132.200 → 180.700.
- primary / local / 1000 / recruiting → applicants / cold, sourceCLS p95: 0.000 → 0.000.
- primary / local / 1000 / recruiting → applicants / cold, first-contentful-paintMs p95: 96.000 → 144.000.
- primary / local / 1000 / recruiting → applicants / warm, clickMs p50: 69.300 → 74.700.
- primary / local / 1000 / recruiting → applicants / warm, clickMs p95: 85.900 → 160.700.
- primary / local / 1000 / recruiting → applicants / warm, sourcePlusClickMs p50: 330.800 → 385.800.
- primary / local / 1000 / recruiting → applicants / warm, sourcePlusClickMs p95: 371.300 → 681.000.
- primary / local / 1000 / recruiting → applicants / warm, sourceUsefulMs p50: 260.000 → 308.000.
- primary / local / 1000 / recruiting → applicants / warm, sourceUsefulMs p95: 301.000 → 606.000.
- primary / local / 1000 / recruiting → applicants / warm, fontReadyMs p50: 112.800 → 119.400.
- primary / local / 1000 / recruiting → applicants / warm, fontReadyMs p95: 128.400 → 192.400.
- primary / local / 1000 / recruiting → applicants / warm, first-contentful-paintMs p50: 76.000 → 92.000.
- primary / local / 1000 / recruiting → applicants / warm, first-contentful-paintMs p95: 92.000 → 160.000.
- primary / local / 1000 / applicants → applicantDetail / cold, clickMs p50: 80.700 → 95.300.
- primary / local / 1000 / applicants → applicantDetail / cold, clickMs p95: 163.500 → 308.000.
- primary / local / 1000 / applicants → applicantDetail / cold, sourcePlusClickMs p50: 315.100 → 362.400.
- primary / local / 1000 / applicants → applicantDetail / cold, sourcePlusClickMs p95: 388.500 → 2,122.000.
- primary / local / 1000 / applicants → applicantDetail / cold, sourceUsefulMs p50: 223.000 → 249.000.
- primary / local / 1000 / applicants → applicantDetail / cold, sourceUsefulMs p95: 251.000 → 1,984.000.
- primary / local / 1000 / applicants → applicantDetail / cold, fontReadyMs p50: 108.200 → 122.800.
- primary / local / 1000 / applicants → applicantDetail / cold, fontReadyMs p95: 130.700 → 256.200.
- primary / local / 1000 / applicants → applicantDetail / cold, first-contentful-paintMs p50: 72.000 → 84.000.
- primary / local / 1000 / applicants → applicantDetail / cold, first-contentful-paintMs p95: 92.000 → 220.000.
- primary / local / 1000 / applicants → applicantDetail / warm, clickMs p95: 237.100 → 338.500.
- primary / local / 5000 / recruiting → applicants / cold, fontReadyMs p50: 107.700 → 117.600.
- primary / local / 5000 / recruiting → applicants / warm, clickMs p50: 84.600 → 94.800.
- primary / local / 5000 / recruiting → applicants / warm, clickMs p95: 96.300 → 177.900.
- primary / local / 5000 / recruiting → applicants / warm, sourcePlusClickMs p50: 354.100 → 384.500.
- primary / local / 5000 / recruiting → applicants / warm, sourcePlusClickMs p95: 481.500 → 522.200.
- primary / local / 5000 / recruiting → applicants / warm, sourceUsefulMs p95: 389.000 → 426.000.
- primary / local / 5000 / recruiting → applicants / warm, fontReadyMs p95: 174.300 → 213.600.
- primary / local / 5000 / recruiting → applicants / warm, first-contentful-paintMs p95: 132.000 → 180.000.
- primary / local / 5000 / applicants → applicantDetail / cold, clickMs p50: 79.800 → 80.400.
- primary / local / 5000 / applicants → applicantDetail / cold, sourcePlusClickMs p50: 332.800 → 335.800.
- primary / local / 5000 / applicants → applicantDetail / cold, sourceUsefulMs p50: 253.000 → 255.000.
- primary / local / 5000 / applicants → applicantDetail / cold, fontReadyMs p50: 108.700 → 109.200.
- primary / local / 5000 / applicants → applicantDetail / cold, fontReadyMs p95: 127.500 → 130.500.
- primary / local / 5000 / applicants → applicantDetail / cold, first-contentful-paintMs p95: 88.000 → 92.000.
- primary / local / 5000 / applicants → applicantDetail / warm, clickMs p50: 97.000 → 97.400.
- primary / local / 5000 / applicants → applicantDetail / warm, clickMs p95: 98.100 → 114.000.
- primary / local / 5000 / applicants → applicantDetail / warm, sourcePlusClickMs p50: 381.500 → 418.400.
- primary / local / 5000 / applicants → applicantDetail / warm, sourceUsefulMs p50: 284.000 → 330.000.
- primary / local / 5000 / applicants → applicantDetail / warm, fontReadyMs p50: 107.000 → 112.100.
- primary / local / 5000 / applicants → applicantDetail / warm, fontReadyMs p95: 120.500 → 124.500.
- primary / constrained / 1000 / recruiting → applicants / cold, sourcePlusClickMs p50: 4,873.500 → 4,882.600.
- primary / constrained / 1000 / recruiting → applicants / cold, sourceUsefulMs p50: 4,278.000 → 4,301.000.
- primary / constrained / 1000 / recruiting → applicants / cold, fontReadyMs p95: 4,265.700 → 4,271.800.
- primary / constrained / 1000 / recruiting → applicants / cold, first-contentful-paintMs p95: 764.000 → 788.000.
- primary / constrained / 1000 / recruiting → applicants / warm, clickMs p95: 263.500 → 900.800.
- primary / constrained / 1000 / recruiting → applicants / warm, sourcePlusClickMs p50: 4,503.900 → 4,533.000.
- primary / constrained / 1000 / recruiting → applicants / warm, sourcePlusClickMs p95: 5,095.500 → 5,464.800.
- primary / constrained / 1000 / recruiting → applicants / warm, sourceUsefulMs p50: 4,289.000 → 4,320.000.
- primary / constrained / 1000 / recruiting → applicants / warm, fontReadyMs p95: 4,348.100 → 4,498.900.
- primary / constrained / 1000 / recruiting → applicants / warm, first-contentful-paintMs p95: 748.000 → 984.000.
- primary / constrained / 1000 / applicants → applicantDetail / cold, clickMs p95: 265.900 → 279.300.
- primary / constrained / 1000 / applicants → applicantDetail / cold, fontReadyMs p95: 4,367.800 → 4,567.300.
- primary / constrained / 1000 / applicants → applicantDetail / cold, first-contentful-paintMs p95: 748.000 → 792.000.
- primary / constrained / 1000 / applicants → applicantDetail / warm, clickMs p50: 239.100 → 239.700.
- primary / constrained / 1000 / applicants → applicantDetail / warm, sourcePlusClickMs p50: 4,909.400 → 4,922.200.
- primary / constrained / 1000 / applicants → applicantDetail / warm, sourcePlusClickMs p95: 5,001.700 → 5,169.800.
- primary / constrained / 1000 / applicants → applicantDetail / warm, sourceUsefulMs p50: 4,668.000 → 4,671.000.
- primary / constrained / 1000 / applicants → applicantDetail / warm, sourceUsefulMs p95: 4,762.000 → 4,914.000.
- primary / constrained / 1000 / applicants → applicantDetail / warm, first-contentful-paintMs p50: 728.000 → 732.000.
- primary / constrained / 5000 / recruiting → applicants / cold, clickMs p95: 593.600 → 595.200.
- primary / constrained / 5000 / recruiting → applicants / cold, sourcePlusClickMs p50: 4,884.200 → 4,890.500.
- primary / constrained / 5000 / recruiting → applicants / cold, sourceUsefulMs p50: 4,304.000 → 4,306.000.
- primary / constrained / 5000 / recruiting → applicants / cold, fontReadyMs p95: 4,255.800 → 4,258.800.
- primary / constrained / 5000 / recruiting → applicants / warm, fontReadyMs p50: 4,237.600 → 4,251.000.
- primary / constrained / 5000 / recruiting → applicants / warm, first-contentful-paintMs p50: 728.000 → 732.000.
- primary / constrained / 5000 / recruiting → applicants / warm, first-contentful-paintMs p95: 744.000 → 768.000.
- primary / constrained / 5000 / applicants → applicantDetail / cold, fontReadyMs p50: 4,265.600 → 4,284.700.
- primary / constrained / 5000 / applicants → applicantDetail / cold, sourceCLS p50: 0.000 → 0.002.
- primary / constrained / 5000 / applicants → applicantDetail / cold, sourceCLS p95: 0.000 → 0.002.
- primary / constrained / 5000 / applicants → applicantDetail / warm, clickMs p50: 239.300 → 239.900.
- primary / constrained / 5000 / applicants → applicantDetail / warm, clickMs p95: 319.100 → 367.000.
- primary / constrained / 5000 / applicants → applicantDetail / warm, fontReadyMs p50: 4,278.100 → 4,290.100.
- primary / constrained / 5000 / applicants → applicantDetail / warm, sourceCLS p50: 0.000 → 0.002.
- feature / constrained / 1000 / overview → settingsProfile / cold, clickMs p50: 454.700 → 455.200.
- feature / constrained / 1000 / overview → settingsProfile / cold, clickMs p95: 458.000 → 466.900.
- feature / constrained / 1000 / overview → settingsProfile / cold, sourcePlusClickMs p95: 4,751.700 → 4,881.900.
- feature / constrained / 1000 / overview → settingsProfile / cold, sourceUsefulMs p95: 4,297.000 → 4,415.000.
- feature / constrained / 1000 / overview → settingsProfile / cold, fontReadyMs p50: 4,254.600 → 4,254.800.
- feature / constrained / 1000 / overview → settingsProfile / cold, fontReadyMs p95: 4,275.000 → 4,275.800.
- feature / constrained / 1000 / overview → settingsProfile / warm, clickMs p50: 140.500 → 143.500.
- feature / constrained / 1000 / overview → settingsProfile / warm, clickMs p95: 154.400 → 158.300.
- feature / constrained / 1000 / overview → settingsProfile / warm, sourcePlusClickMs p50: 4,079.500 → 4,441.200.
- feature / constrained / 1000 / overview → settingsProfile / warm, sourcePlusClickMs p95: 4,482.300 → 4,501.300.
- feature / constrained / 1000 / overview → settingsProfile / warm, sourceUsefulMs p50: 3,939.000 → 4,286.000.
- feature / constrained / 1000 / overview → settingsProfile / warm, sourceUsefulMs p95: 4,328.000 → 4,343.000.
- feature / constrained / 1000 / overview → meetings / cold, clickMs p50: 441.600 → 444.800.
- feature / constrained / 1000 / overview → meetings / cold, clickMs p95: 456.600 → 539.300.
- feature / constrained / 1000 / overview → meetings / cold, sourcePlusClickMs p50: 4,380.600 → 4,743.300.
- feature / constrained / 1000 / overview → meetings / cold, sourcePlusClickMs p95: 4,722.400 → 5,431.800.
- feature / constrained / 1000 / overview → meetings / cold, sourceUsefulMs p50: 3,939.000 → 4,299.000.
- feature / constrained / 1000 / overview → meetings / cold, sourceUsefulMs p95: 4,285.000 → 4,987.000.
- feature / constrained / 1000 / overview → meetings / cold, fontReadyMs p95: 4,270.500 → 4,331.600.
- feature / constrained / 1000 / overview → meetings / cold, first-contentful-paintMs p95: 768.000 → 876.000.
- feature / constrained / 1000 / overview → meetings / warm, clickMs p50: 122.100 → 127.000.
- feature / constrained / 1000 / overview → meetings / warm, clickMs p95: 126.600 → 136.600.
- feature / constrained / 1000 / overview → meetings / warm, sourcePlusClickMs p50: 4,062.100 → 4,102.400.
- feature / constrained / 1000 / overview → meetings / warm, sourcePlusClickMs p95: 4,436.800 → 4,505.600.
- feature / constrained / 1000 / overview → meetings / warm, sourceUsefulMs p50: 3,940.000 → 3,982.000.
- feature / constrained / 1000 / overview → meetings / warm, sourceUsefulMs p95: 4,316.000 → 4,369.000.
- feature / constrained / 1000 / overview → meetings / warm, fontReadyMs p50: 4,263.300 → 4,264.400.
- feature / constrained / 1000 / overview → meetings / warm, fontReadyMs p95: 4,270.600 → 4,386.600.
- feature / constrained / 1000 / overview → meetings / warm, first-contentful-paintMs p50: 732.000 → 748.000.
- feature / constrained / 1000 / overview → meetings / warm, first-contentful-paintMs p95: 744.000 → 792.000.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, sourcePlusClickMs p50: 4,394.600 → 4,416.200.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, sourcePlusClickMs p95: 4,407.500 → 4,749.700.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, sourceUsefulMs p50: 3,920.000 → 3,979.000.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, sourceUsefulMs p95: 3,953.000 → 4,311.000.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, fontReadyMs p95: 4,260.400 → 4,341.600.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, first-contentful-paintMs p95: 760.000 → 852.000.
- feature / constrained / 1000 / recruiting → scheduledDecisions / warm, clickMs p50: 134.300 → 137.000.
- feature / constrained / 1000 / recruiting → scheduledDecisions / warm, clickMs p95: 145.200 → 145.500.
- feature / constrained / 1000 / recruiting → scheduledDecisions / warm, sourceUsefulMs p50: 3,950.000 → 3,951.000.
- feature / constrained / 1000 / settingsApplication → rounds / cold, clickMs p95: 604.900 → 611.600.
- feature / constrained / 1000 / settingsApplication → rounds / cold, sourcePlusClickMs p50: 4,947.700 → 4,954.400.
- feature / constrained / 1000 / settingsApplication → rounds / cold, sourcePlusClickMs p95: 4,980.100 → 5,045.700.
- feature / constrained / 1000 / settingsApplication → rounds / cold, sourceUsefulMs p50: 4,354.000 → 4,356.000.
- feature / constrained / 1000 / settingsApplication → rounds / cold, sourceUsefulMs p95: 4,384.000 → 4,451.000.
- feature / constrained / 1000 / settingsApplication → rounds / cold, fontReadyMs p95: 4,420.800 → 4,530.200.
- feature / constrained / 1000 / settingsApplication → rounds / cold, first-contentful-paintMs p95: 740.000 → 764.000.
- feature / constrained / 1000 / settingsApplication → rounds / warm, fontReadyMs p95: 4,427.600 → 4,445.700.
- interaction / local / 1000 / distant-search, meaningfulMs p50: 61.300 → 61.500.
- interaction / constrained / 1000 / next-page, meaningfulMs p50: 200.100 → 201.200.
- interaction / constrained / 1000 / next-page, meaningfulMs p95: 208.500 → 214.100.
- interaction / constrained / 5000 / distant-search, meaningfulMs p50: 117.400 → 118.700.
- http / 1000 / 1, burstMs p50: 46.699 → 46.878.
- http / 1000 / 2, burstMs p95: 52.832 → 63.076.
- http / 1000 / 4, burstMs p50: 64.943 → 66.775.

## Recommendation

Retain the request-ordering fix with its deterministic regression coverage. Evaluate the latency tables by path; removing a duplicate request does not guarantee that source hydration, first-use code download, identity or database tails improve. This phase introduces no further application optimization, and claims no isolated provider-execution or pool-wait measurement.

Hold publication of the complete series pending the inherited Settings/anonymous-review first-use tradeoffs and the retained adverse tails. Next, isolate Settings streamed-render/code-loading and the review handoff while retaining the Recruiting bundle saving. For backend work, use the opt-in request-correlated probes to capture the intermittent long identity phase under the same browser workload before choosing a remedy. The controlled primary repeat still contains identity phases around1.5s; the separate probes peak below400ms and do not explain that event or the earlier Phase 12 multi-second tail. Successful live authorization must remain request-specific.

The diagnostic database growth with small observed acquisition favors inspecting the O(N) pipeline metadata/ranking work over increasing concurrency or pool size. A bounded query improvement should be tested for metadata/ranking parity before adoption. No new application change was justified during this confirmation phase: removing obsolete reads saved requests/bytes, but warm medians and adverse tails did not improve consistently. Direct/public entry coverage beyond these cases, hosted regions/latency and multi-user pool behavior remain limits of this loopback study.

Implementation tools/tests, the confirmed Phase 12 application diff, source/build/package manifests, plans, all raw observations, diagnostic bounds, test history, controls/power audits, exclusions, privacy scan, cleanup and checksums accompany this report. Original checkout changes made outside this task are recorded and preserved. No production changes or publication occurred.
