# OutClass performance — Phase 12

Phase 12 removes obsolete startup reads with a synchronous local Auth epoch fence, but does not establish a consistent navigation speedup. Concurrent external development confounds the constrained timing comparison; publication remains on hold. The 5,000-applicant constrained warm-list click p50 / p95 regresses **231.8 / 360.6 → 385.0 / 761.7ms** and source p95 also worsens. The change checks both dispatch and result settlement. In the accepted constrained main paths, source preparations with multiple pipeline reads change **44 → 0** across all measured and warmup outcomes. In the 5,000-applicant warm-detail group, fresh source useful-content p50 / p95 changes **4,743.0 / 4,824.0 → 4,716.0 / 5,850.0ms**, and source requests change **59.0 / 59.0 → 58.0 / 58.0**. This is a client scope-ordering experiment; no server validation or data reader changes.

The direct baseline is Phase 11 `327f7de5d8dad3381f0db258956d0b8b6424a6af`; audit reference `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Branch `codex/performance-phase12-20261026`; baseline build `9_IJRDuwFMnwclrWJ9soE`, candidate `FXBoz7ZsRfWXbsBo4gGDZ`. The earlier Phase11 adverse data remains intact and is not pooled into this matched comparison. The candidate remains local; no push, PR, merge or deployment.

## Mechanism and security boundary

The excluded baseline browser regression reproduces two pipeline reads even though the Auth notification preceded the first selected-effect dispatch marker on the same browser clock. Existing traces show a selected effect can still capture the previous rendered epoch while React has a context update pending. The installed pinned Auth SDK dispatches callbacks during its initialization notification sequence; the application already preserves token-change invalidation and remote identity separately.

Only `contexts/auth-context.tsx` and `components/selected-club-workspace.tsx` change in application code. The provider publishes its existing opaque epoch to a private ref synchronously before scheduling the React state update. A stable callback compares a captured epoch against that current local fence. Selected effects skip a scope that is already obsolete; the subsequent committed scope dispatches a fresh GET. Both successful and failed results check the same fence before settling. Code/data still dispatch together for a current scope, and leaving/revisiting still starts a new request.

This object comparison is a browser scope hint, never authorization. It does not inspect or trust JWT claims, cache authorization success, reuse protected results, suppress any Auth event, or remove a necessary live refresh. Requests already sent before a genuine later Auth change remain subject to the existing ownership fence and a fresh read. The other **911 application files** match baseline. Phase10 font deferral, all four font files and Phase11 feature-module boundaries are retained. Settings code/loading/draft ownership is unchanged; its first-use costs remain separately measured.

Every actual protected read retains remotely verified identity, live Auth sessions/revocation, account enablement, club membership, capabilities, suspension, support restrictions, anonymous interview protection and voting snapshot authority. No protected result bypasses required live validation. Private no-store, Cookie sensitivity, Demo isolation and mutations remain unchanged. No production Supabase/Vercel configuration, infrastructure, database region, schema/index, dependency, cache library, Redis or Edge Function change.

## Verification

| Check | Result |
|---|---|
| Ordinary suite | 1,408 passed; 63 explicit environment-gated skips; 0 failures; 1,471 total |
| Serialized live Auth/account/privacy/revocation/navigation/settings | 67 passed; 0 failures; 0 skips |
| New ordinary scope cases | 3 passed; pre-commit dispatch and success/error settlement, plus immediate Auth fence |
| New real-browser scope case | 3 constrained native entries, fresh revisits and denied revoked replay within one test |
| Native security/concurrency | 3 passed |
| Normal verified signup/TOTP provisioning | 38 passed |
| Fresh/legacy migrations and browser-role denial | 57 migrations; 78 RLS tables |
| Production build / typecheck | Passed |
| Lint | 0 errors; 22 existing warnings |

Counts overlap and must not be added. Existing tests retain strict GET allowlists/arguments, transport, duplicate elimination, scheduler/settings/review draft continuity, rapid switching, late-response fences, support and anonymous scopes, font behavior, feature chunks and native metadata parity. The new browser test permits a second read when an actual Auth notification arrives after dispatch; it rejects the obsolete-first-read case when that notification was already known. Other optional gated suites remain explicitly skipped.

Development and excluded probes remain in `tests/`. The first focused mock recreated its scope-check callback every render, unlike the production memoized callback, causing two existing assertions to fail; the mock was corrected without weakening assertions. The first full ordinary run overlapped compilation and reported six browser timeouts/assertion failures. The final run bounds ordinary test-file concurrency to two without a competing build; product code, timeouts and assertions were unchanged. The passing isolated run does not alone establish the earlier failures' cause. The baseline-only new browser check fails as expected on the reproduced two-read behavior; it is not a candidate failure or an accepted timing row. The first candidate live suite passed 66/67: the new case passed its initial scope assertion but waited for Club Overview while navigating within Recruiting. Correcting that test target yields a targeted pass across three native contexts on the same frozen build. Live coverage is 67 unique passing cases across the original 66 and the corrected followup, rather than a claim that the first full live run had zero failures. The final event-order assertion uses browser-local Auth and selected-effect markers, avoiding asynchronous Playwright request-delivery timing; the baseline fails and candidate passes that refined regression. Original timing-clock logs remain.

## Matched measurement

Independent synthetic 1,000/5,000-applicant cohorts; frozen baseline/candidate builds, BA then AB order; local unthrottled and CDP 80ms, 200,000B/s down, 93,750B/s up, CPU4×. Main paths have one warmup and five measured outcomes per build/block/path/condition (n10, nearest-rank p95=max). Extra feature paths use the constrained 1,000 cohort, one warmup and three measured rows (n6, p95=max). The entire eight-outcome pilot is excluded. The first constrained attempt is excluded whole because actual host sleep occurred; its 168 main, 128 feature, 72 interaction and 252 HTTP outcomes remain under `interrupted-constrained-1/`. Its next interaction preparation timed out before recording a row, so the exact failed preparation step is unknown. A subsequent short attempt began after a power guard failed to halt a later shell line; macOS still reported battery power. It was stopped and excluded whole under `preflight-constrained-2/`. After the user clarified that a charger was unavailable and directed continuation, a fresh guarded run uses battery power for both builds under unchanged power settings. `RESUMPTION.json` records starting/ending battery and power mode. The awake assertion prevents idle sleep on battery; it cannot override lid closure. These exclusions are never pooled into accepted quantiles. Untimed SSR/JavaScript-disabled diagnostics and the baseline regression probe are separate. All recorded rows, failures, warmups, aborted/pending transports and authority events remain in their accepted or excluded collection. The short power-preflight exclusion contains 10 recorded main outcomes; it is not a full balanced block. No tests or builds launched by this experiment competed with collection, and product/collector sources stayed frozen. Cleanup discovered external work in the original checkout: a branch change at14:25Z and an active development server on port3111 that began approximately14:29Z, overlapping the constrained run. Its actual CPU/build/browser load was not captured. The constrained latency comparison is therefore observational and confounded; **no isolated causal speedup is established**. Every adverse row remains retained. `ORIGINAL_CHECKOUT_OBSERVATION.json` and `MEASUREMENT_VALIDITY.json` record this limitation. The unrelated branch, edits and server are preserved. CPU frequency, thermal conditions and unrelated user workload were not controlled; balanced ordering reduces drift but does not eliminate it. Temporary awake assertions and actual power audits cover both complete accepted intervals.

Accepted: **384 main browser outcomes (320 measured, 64 warmups)**, **128 feature outcomes (96 measured, 32 warmups)**, **192 page/search interactions (160 measured, 32 warmups)** and **336 native HTTP outcomes (280 measured, 56 warmups)**. Browser source starts at the preceding document navigation in a fresh context; cold/warm describes the later destination. Click ends at the existing content predicate plus two animation frames. Settings waits for enabled real profile fields after draft reading, Meetings for fixture data, scheduled decisions for the fetched empty state, anonymous review for actual controls.

The original bounded non-SSE drain remains separate from useful-content time. Pending snapshots do not prove eventual termination; byte totals are observed encoded bodies, not complete eventual accounting. Preparatory groups/details open before timing with existing Link behavior; any pre-click preparation/prefetch lies outside source/click windows, with no extra wait to complete prefetch. Source+click is each row's sum of two loading waits, excluding drains, navigation preparation and warm visits; it is not an uninterrupted elapsed journey or a sum of percentiles. No synthetic product delays, response gates or cosmetic readiness changes occur in accepted samples.

## Main navigation

All timings p50 / p95 ms. Complete server/network/CPU/payload distributions remain in `BENCHMARK_RESULTS.json`, every worsening quantile in `REGRESSIONS.json`, and maximum source/click/interaction/native rows in `SOURCE_PEAKS.json` / `PEAKS.json`.

| Profile | Applicants | Destination / visit | Source before → after ms | Click before → after ms | Source requests before → after | Click requests before → after | Click bytes before → after |
|---|---:|---|---:|---:|---:|---:|---:|
| local | 1,000 | List / cold | 262.0 / 281.0 → 257.0 / 358.0 | 79.5 / 84.1 → 79.2 / 84.1 | 48.0 / 48.0 → 48.0 / 48.0 | 9.0 / 9.0 → 9.0 / 9.0 | 56,891.0 / 56,891.0 → 56,891.0 / 56,891.0 |
| local | 1,000 | List / warm | 250.0 / 289.0 → 252.0 / 280.0 | 61.7 / 71.6 → 61.0 / 75.1 | 48.0 / 48.0 → 48.0 / 48.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,240.0 / 7,240.0 → 7,240.0 / 7,240.0 |
| local | 1,000 | Detail / cold | 234.0 / 262.0 → 224.0 / 261.0 | 79.9 / 92.1 → 79.6 / 86.1 | 56.0 / 56.0 → 56.0 / 56.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,780.0 / 2,780.0 → 2,780.0 / 2,780.0 |
| local | 1,000 | Detail / warm | 250.0 / 342.0 → 248.0 / 371.0 | 97.2 / 97.6 → 97.5 / 113.3 | 56.0 / 57.0 → 56.0 / 57.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,780.0 / 2,780.0 → 2,780.0 / 2,780.0 |
| local | 5,000 | List / cold | 272.0 / 325.0 → 268.0 / 366.0 | 96.7 / 102.2 → 98.0 / 106.1 | 48.0 / 48.0 → 48.0 / 48.0 | 9.0 / 9.0 → 9.0 / 9.0 | 56,905.0 / 56,905.0 → 56,905.0 / 56,905.0 |
| local | 5,000 | List / warm | 258.0 / 457.0 → 265.0 / 306.0 | 86.7 / 97.7 → 84.4 / 185.9 | 48.0 / 48.0 → 48.0 / 48.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,254.0 / 7,254.0 → 7,254.0 / 7,254.0 |
| local | 5,000 | Detail / cold | 246.0 / 378.0 → 253.0 / 343.0 | 79.9 / 83.0 → 80.0 / 96.1 | 56.0 / 57.0 → 56.0 / 56.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,789.0 / 2,789.0 → 2,789.0 / 2,789.0 |
| local | 5,000 | Detail / warm | 331.0 / 359.0 → 268.0 / 352.0 | 97.0 / 98.4 → 97.1 / 98.3 | 56.0 / 56.0 → 56.0 / 56.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,789.0 / 2,789.0 → 2,789.0 / 2,789.0 |
| constrained | 1,000 | List / cold | 4,308.0 / 4,822.0 → 4,277.0 / 4,332.0 | 592.6 / 726.9 → 584.3 / 607.5 | 50.0 / 50.0 → 50.0 / 50.0 | 9.0 / 9.0 → 9.0 / 9.0 | 56,891.0 / 56,891.0 → 56,891.0 / 56,891.0 |
| constrained | 1,000 | List / warm | 4,293.0 / 4,697.0 → 4,293.0 / 4,613.0 | 226.6 / 249.9 → 222.2 / 252.4 | 50.0 / 50.0 → 50.0 / 50.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,240.0 / 7,240.0 → 7,240.0 / 7,240.0 |
| constrained | 1,000 | Detail / cold | 4,751.0 / 4,921.0 → 4,702.0 / 4,754.0 | 266.1 / 287.7 → 266.2 / 283.1 | 59.0 / 59.0 → 58.0 / 58.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,780.0 / 2,780.0 → 2,780.0 / 2,780.0 |
| constrained | 1,000 | Detail / warm | 4,755.0 / 5,002.0 → 4,697.0 / 4,740.0 | 239.9 / 277.1 → 241.0 / 254.2 | 59.0 / 59.0 → 58.0 / 58.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,780.0 / 2,780.0 → 2,780.0 / 2,780.0 |
| constrained | 5,000 | List / cold | 4,322.0 / 4,588.0 → 4,595.0 / 5,756.0 | 593.2 / 669.1 → 621.7 / 912.1 | 50.0 / 50.0 → 49.0 / 50.0 | 9.0 / 9.0 → 9.0 / 9.0 | 56,905.0 / 56,905.0 → 56,905.0 / 56,905.0 |
| constrained | 5,000 | List / warm | 4,339.0 / 4,803.0 → 4,711.0 / 7,969.0 | 231.8 / 360.6 → 385.0 / 761.7 | 50.0 / 50.0 → 49.0 / 50.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,254.0 / 7,254.0 → 7,254.0 / 7,254.0 |
| constrained | 5,000 | Detail / cold | 4,748.0 / 6,534.0 → 4,755.0 / 5,068.0 | 282.2 / 526.5 → 283.6 / 378.2 | 59.0 / 59.0 → 58.0 / 58.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,789.0 / 2,789.0 → 2,789.0 / 2,789.0 |
| constrained | 5,000 | Detail / warm | 4,743.0 / 4,824.0 → 4,716.0 / 5,850.0 | 242.4 / 259.5 → 239.6 / 270.4 | 59.0 / 59.0 → 58.0 / 58.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,789.0 / 2,789.0 → 2,789.0 / 2,789.0 |

The constrained replacement ran on battery from 83% to 62%, with recorded low-power mode 0. Power snapshots and actual sleep audit accompany the run; this condition is recorded separately from the earlier local profile.

| 5,000 warm-detail source | Local before → after p50 / p95 | Constrained before → after p50 / p95 |
|---|---:|---:|
| Observation elapsed ms incl. bounded drain | 415.0 / 457.0 → 395.0 / 436.0 | 4,830.0 / 4,936.0 → 4,805.0 / 6,060.0 |
| Observed encoded body bytes | 834,665.0 / 834,665.0 → 834,762.0 / 834,762.0 | 841,919.0 / 842,006.0 → 834,762.0 / 834,849.0 |
| Script bytes | 542,510.0 / 542,510.0 → 542,602.0 / 542,602.0 | 542,510.0 / 542,510.0 → 542,602.0 / 542,602.0 |
| Script requests | 36.0 / 36.0 → 36.0 / 36.0 | 36.0 / 36.0 → 36.0 / 36.0 |
| Font requests | 2.0 / 2.0 → 2.0 / 2.0 | 2.0 / 2.0 → 2.0 / 2.0 |
| Font bytes | 227,784.0 / 227,784.0 → 227,784.0 / 227,784.0 | 227,784.0 / 227,784.0 → 227,784.0 / 227,784.0 |
| Font readiness ms | 109.5 / 115.5 → 112.0 / 117.5 | 4,289.9 / 4,700.4 → 4,290.3 / 4,419.8 |
| FCP ms | 72.0 / 80.0 → 76.0 / 80.0 | 736.0 / 772.0 → 736.0 / 796.0 |

| 5,000 warm-detail click | Local before → after p50 / p95 | Constrained before → after p50 / p95 |
|---|---:|---:|
| Protected read TTFB ms | 38.9 / 45.6 → 38.6 / 49.0 | 85.6 / 92.5 → 86.1 / 93.2 |
| Server total ms | 37.1 / 43.7 → 36.6 / 46.9 | 39.1 / 83.4 → 39.9 / 79.2 |
| Identity verification ms | 29.4 / 36.4 → 29.7 / 35.4 | 31.4 / 72.1 → 32.3 / 55.8 |
| Live-session check ms | 0.5 / 0.7 → 0.5 / 0.6 | 0.6 / 1.2 → 0.5 / 2.1 |
| Observable transaction acquisition ms | 0.4 / 0.7 → 0.4 / 1.0 | 0.5 / 0.7 → 0.5 / 2.2 |
| Database span ms | 6.1 / 9.6 → 5.5 / 9.0 | 5.8 / 10.6 → 6.3 / 18.4 |
| Serialization ms | 0.3 / 0.3 → 0.3 / 0.3 | 0.3 / 3.2 → 0.3 / 0.7 |
| Transfer ms | 0.3 / 0.5 → 0.3 / 0.3 | 8.2 / 9.9 → 9.0 / 10.0 |
| Drain ms | 118.1 / 165.3 → 115.2 / 135.3 | 350.3 / 367.2 → 351.4 / 377.2 |
| Browser script ms | 17.5 / 19.1 → 17.5 / 18.8 | 66.2 / 76.6 → 64.9 / 81.2 |
| Browser task ms | 81.3 / 83.9 → 80.3 / 82.9 | 298.6 / 334.6 → 299.3 / 351.0 |

| 5,000 warm-list click | Local before → after p50 / p95 | Constrained before → after p50 / p95 |
|---|---:|---:|
| Protected read TTFB ms | 54.1 / 61.4 → 53.8 / 148.3 | 88.8 / 206.0 → 199.9 / 542.0 |
| Server total ms | 51.7 / 59.7 → 52.4 / 146.6 | 69.6 / 191.7 → 189.7 / 525.4 |
| Identity verification ms | 20.6 / 22.7 → 19.9 / 25.7 | 23.9 / 77.2 → 67.4 / 152.9 |
| Live-session check ms | 0.5 / 0.7 → 0.5 / 1.6 | 0.7 / 2.0 → 1.0 / 21.0 |
| Observable transaction acquisition ms | 0.5 / 0.6 → 0.4 / 0.5 | 0.5 / 1.2 → 1.2 / 7.5 |
| Database span ms | 18.4 / 22.4 → 19.5 / 116.9 | 27.3 / 64.6 → 60.8 / 275.4 |
| Transaction span ms | 28.3 / 34.9 → 29.4 / 124.8 | 43.0 / 100.2 → 101.0 / 338.6 |
| Serialization ms | 0.5 / 0.7 → 0.5 / 0.9 | 0.8 / 7.4 → 1.5 / 24.9 |
| Transfer ms | 0.4 / 0.4 → 0.4 / 0.5 | 38.4 / 39.5 → 38.3 / 39.4 |

| Constrained main source observations, including warmups | Baseline | Candidate |
|---|---:|---:|
| Captured pipelinePage requests | 92 | 48 |
| Observed pipelinePage response body bytes | 666,696 | 347,856 |
| PipelinePage unknown-byte snapshots | 0 | 0 |
| Recorded source Auth epoch notifications | 96 | 96 |
| Multiple-read source preparations with all observed Auth notifications before first selected-effect marker and readAuthority change recorded | 44 | 0 |

Each main timed entry/detail retains exactly one protected pipeline read. Database and transaction phases overlap and must not be summed. Database spans include Prisma/transport/scheduling; transaction acquisition is not an isolated pool wait. No server query or identity-validation change is claimed. CLS distributions, authority causes, source read multiplicities and incomplete byte snapshots remain in the accompanying JSON.

## Deferred-feature costs retained from Phase11

| Destination / visit | Source before → after ms | Click before → after ms | Source+click before → after ms | Click requests before → after | Click bytes before → after |
|---|---:|---:|---:|---:|---:|
| overview → settingsProfile / cold | 4,283.0 / 4,400.0 → 3,991.0 / 4,329.0 | 458.9 / 508.4 → 457.4 / 732.6 | 4,739.9 / 4,908.4 → 4,466.1 / 4,783.0 | 9.0 / 9.0 → 9.0 / 9.0 | 22,866.0 / 22,866.0 → 22,866.0 / 22,866.0 |
| overview → settingsProfile / warm | 3,955.0 / 4,284.0 → 4,299.0 / 4,332.0 | 147.0 / 159.1 → 149.4 / 154.0 | 4,098.1 / 4,438.4 → 4,450.8 / 4,470.2 | 1.0 / 1.0 → 1.0 / 1.0 | 88.0 / 88.0 → 88.0 / 88.0 |
| overview → meetings / cold | 4,280.0 / 4,482.0 → 3,947.0 / 4,314.0 | 444.8 / 457.2 → 454.9 / 471.4 | 4,724.3 / 4,927.2 → 4,410.4 / 4,770.0 | 7.0 / 7.0 → 7.0 / 7.0 | 36,049.0 / 36,049.0 → 36,049.0 / 36,049.0 |
| overview → meetings / warm | 3,925.0 / 4,312.0 → 4,280.0 / 4,313.0 | 129.7 / 137.5 → 133.3 / 140.9 | 4,053.7 / 4,446.5 → 4,407.9 / 4,453.9 | 1.0 / 1.0 → 1.0 / 1.0 | 397.0 / 397.0 → 397.0 / 397.0 |
| recruiting → scheduledDecisions / cold | 3,923.0 / 4,273.0 → 3,944.0 / 4,309.0 | 450.2 / 455.9 → 453.0 / 472.7 | 4,377.0 / 4,726.9 → 4,394.7 / 4,762.1 | 4.0 / 4.0 → 4.0 / 4.0 | 8,023.0 / 8,023.0 → 8,023.0 / 8,023.0 |
| recruiting → scheduledDecisions / warm | 4,233.0 / 4,516.0 → 3,923.0 / 4,292.0 | 143.8 / 152.2 → 141.3 / 183.3 | 4,385.2 / 4,657.2 → 4,064.1 / 4,433.3 | 1.0 / 1.0 → 1.0 / 1.0 | 86.0 / 86.0 → 86.0 / 86.0 |
| settingsApplication → rounds / cold | 4,352.0 / 4,372.0 → 4,353.0 / 4,368.0 | 595.1 / 613.6 → 595.4 / 596.5 | 4,948.2 / 4,966.9 → 4,946.9 / 4,963.4 | 8.0 / 8.0 → 8.0 / 8.0 | 10,176.0 / 12,468.0 → 10,176.0 / 12,466.0 |
| settingsApplication → rounds / warm | 920.0 / 4,369.0 → 943.0 / 4,351.0 | 264.7 / 278.2 → 264.5 / 281.5 | 1,190.2 / 4,631.6 → 1,209.5 / 4,615.4 | 4.0 / 4.0 → 4.0 / 4.0 | 1,341.0 / 3,633.0 → 1,342.0 / 3,632.0 |

This phase changes neither Settings module boundaries nor its first-use dispatch. Variations here do not establish that Settings or anonymous review has been fixed. The prior Phase11 cold list and feature penalties, FCP/CLS changes and uneven Settings source tail remain release risks. The SSR diagnostics export marker booleans rather than response bodies: full response markup is distinct from visible first-chunk rendering, especially with streamed hidden sections. Disabling JavaScript is a diagnostic observation, not a proposed product mode or an authorization shortcut. `SSR_DIAGNOSTICS.json` retains both builds' observations.

## Warm interactions and native diagnostic

| Profile | Applicants | Interaction | Before p50 / p95 ms | After p50 / p95 ms | Requests before → after |
|---|---:|---|---:|---:|---:|
| local | 1,000 | next-page | 96.4 / 111.9 | 96.6 / 112.9 | 1.0 / 1.0 → 1.0 / 1.0 |
| local | 1,000 | distant-search | 61.2 / 77.3 | 60.7 / 61.7 | 1.0 / 1.0 → 1.0 / 1.0 |
| local | 5,000 | next-page | 195.7 / 198.8 | 195.8 / 197.7 | 1.0 / 1.0 → 1.0 / 1.0 |
| local | 5,000 | distant-search | 78.1 / 94.6 | 77.7 / 94.3 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained | 1,000 | next-page | 202.0 / 206.1 | 202.9 / 212.3 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained | 1,000 | distant-search | 120.7 / 129.5 | 123.4 / 133.2 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained | 5,000 | next-page | 330.3 / 748.5 | 285.0 / 1,547.9 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained | 5,000 | distant-search | 118.0 / 229.3 | 126.1 / 234.7 | 1.0 / 1.0 → 1.0 / 1.0 |

| Applicants | Readers | Burst before → after p50 / p95 ms | Request before → after p50 / p95 ms |
|---:|---:|---:|---:|
| 1,000 | 1 | 47.9 / 52.1 → 46.7 / 75.0 | 47.9 / 52.1 → 46.7 / 75.0 |
| 1,000 | 2 | 51.5 / 55.6 → 51.0 / 56.3 | 51.1 / 55.1 → 50.4 / 56.1 |
| 1,000 | 4 | 73.0 / 90.7 → 68.2 / 83.0 | 62.8 / 86.7 → 65.1 / 79.0 |
| 5,000 | 1 | 151.6 / 165.5 → 149.8 / 377.0 | 151.6 / 165.5 → 149.8 / 377.0 |
| 5,000 | 2 | 206.8 / 319.2 → 174.0 / 236.5 | 197.7 / 305.8 → 164.6 / 228.0 |
| 5,000 | 4 | 251.8 / 615.3 → 209.1 / 859.2 | 251.7 / 601.7 → 195.8 / 846.0 |

Native reads use the identical pipelinePage GET, bounded 1/2/4 readers, pool limit eight per client and nominal 25ms aggregate sampling. Ten measured bursts per group; 10/20/40 per-request observations. Observed aggregate maxima: 9 connections, 4 active, 4 idle-in-transaction, 0 lock waiting. The monitor is excluded; sampling can miss brief peaks and aggregate connections do not establish pool saturation. These loopback same-role diagnostics do not establish hosted or multi-user performance.

## Errors, regressions and recommendation

The material new regression is the 5,000-applicant constrained warm list: click **231.8 / 360.6 → 385.0 / 761.7ms**, source **4,339.0 / 4,803.0 → 4,711.0 / 7,969.0ms**. The retained candidate source maximum contains identity spans up to **3,082.74ms** across otherwise unrelated background reads. Its worst warm-list click has protected-read TTFB **205.97 → 542.02ms**, server total **191.73 → 525.43ms**, database span **64.58 → 275.43ms**, and transaction span **100.24 → 338.64ms**. These are maxima from different rows, not paired isolated causes. `TAIL_ANALYSIS.json` retains each exact row and sanitized request timings. Identity includes remote verification and application scheduling; database and transaction spans overlap. The evidence locates substantial waiting in unchanged server paths, but does not isolate provider service time, HTTP queueing, event-loop contention or database-pool waits. Concurrent external development is a concrete confound, but is not proven to explain a particular slow span. No slow row is discarded or replaced.

local main: 192 outcomes, 0 failed outcomes, 0 page errors, 0 HTTP errors. Background flags: 10 failed transports, 192 pending SSE, 0 other pending snapshots. Source preparations with additional pipeline reads: 3. Interactions: 96, 0 failed, 0 script errors including preparation.

constrained main: 192 outcomes, 0 failed outcomes, 0 page errors, 0 HTTP errors. Background flags: 0 failed transports, 192 pending SSE, 178 other pending snapshots. Source preparations with additional pipeline reads: 44. Interactions: 96, 0 failed, 0 script errors including preparation.

constrained feature: 128 outcomes, 0 failed outcomes, 0 page errors, 0 HTTP errors. Background flags: 28 failed transports, 128 pending SSE, 14 other pending snapshots. Source preparations with additional pipeline reads: 0. Interactions: 0, 0 failed, 0 script errors including preparation.

local timed interactions: 0 HTTP errors, 0 failed transports, 0 pending snapshots. Interaction preparation script errors are included separately; other preparation network accounting was not captured.

constrained timed interactions: 0 HTTP errors, 0 failed transports, 0 pending snapshots. Interaction preparation script errors are included separately; other preparation network accounting was not captured.

Native HTTP: 336 outcomes, 0 failures; all retain private no-store and Cookie sensitivity. Background failure after a response, a pending snapshot and a failed useful-content outcome remain distinct. `TRANSPORT_DETAILS.json` retains per-variant sanitized routes, statuses/reasons, missing-byte snapshots, authority causes and source pipeline multiplicity. Required refreshes after genuine later Auth changes remain allowed.

All worsening useful-content/paired-wait, interaction/burst, font/FCP and CLS quantiles follow; all other worsening metrics remain in the complete JSON inventory. Small samples and unchanged server code preclude a causal backend claim.

- primary / local / 1000 / recruiting → applicants / cold, sourcePlusClickMs p95: 365.1 → 436.6.
- primary / local / 1000 / recruiting → applicants / cold, sourceUsefulMs p95: 281.0 → 358.0.
- primary / local / 1000 / recruiting → applicants / cold, sourceCLS p95: 0.000000 → 0.000004.
- primary / local / 1000 / recruiting → applicants / warm, clickMs p95: 71.6 → 75.1.
- primary / local / 1000 / recruiting → applicants / warm, sourceUsefulMs p50: 250.0 → 252.0.
- primary / local / 1000 / recruiting → applicants / warm, fontReadyMs p95: 127.4 → 131.2.
- primary / local / 1000 / applicants → applicantDetail / cold, fontReadyMs p95: 123.1 → 135.4.
- primary / local / 1000 / applicants → applicantDetail / cold, first-contentful-paintMs p50: 72.0 → 76.0.
- primary / local / 1000 / applicants → applicantDetail / cold, first-contentful-paintMs p95: 88.0 → 96.0.
- primary / local / 1000 / applicants → applicantDetail / warm, clickMs p50: 97.2 → 97.5.
- primary / local / 1000 / applicants → applicantDetail / warm, clickMs p95: 97.6 → 113.3.
- primary / local / 1000 / applicants → applicantDetail / warm, sourcePlusClickMs p50: 341.2 → 346.4.
- primary / local / 1000 / applicants → applicantDetail / warm, sourcePlusClickMs p95: 439.3 → 468.0.
- primary / local / 1000 / applicants → applicantDetail / warm, sourceUsefulMs p95: 342.0 → 371.0.
- primary / local / 1000 / applicants → applicantDetail / warm, fontReadyMs p50: 109.4 → 118.2.
- primary / local / 1000 / applicants → applicantDetail / warm, fontReadyMs p95: 120.5 → 147.0.
- primary / local / 1000 / applicants → applicantDetail / warm, first-contentful-paintMs p50: 72.0 → 80.0.
- primary / local / 1000 / applicants → applicantDetail / warm, first-contentful-paintMs p95: 104.0 → 124.0.
- primary / local / 5000 / recruiting → applicants / cold, clickMs p50: 96.7 → 98.0.
- primary / local / 5000 / recruiting → applicants / cold, clickMs p95: 102.2 → 106.1.
- primary / local / 5000 / recruiting → applicants / cold, sourcePlusClickMs p95: 415.5 → 470.3.
- primary / local / 5000 / recruiting → applicants / cold, sourceUsefulMs p95: 325.0 → 366.0.
- primary / local / 5000 / recruiting → applicants / cold, fontReadyMs p95: 126.6 → 132.9.
- primary / local / 5000 / recruiting → applicants / warm, clickMs p95: 97.7 → 185.9.
- primary / local / 5000 / recruiting → applicants / warm, sourcePlusClickMs p50: 347.2 → 352.9.
- primary / local / 5000 / recruiting → applicants / warm, sourceUsefulMs p50: 258.0 → 265.0.
- primary / local / 5000 / recruiting → applicants / warm, fontReadyMs p50: 117.6 → 120.0.
- primary / local / 5000 / recruiting → applicants / warm, fontReadyMs p95: 125.7 → 128.0.
- primary / local / 5000 / applicants → applicantDetail / cold, clickMs p50: 79.9 → 80.0.
- primary / local / 5000 / applicants → applicantDetail / cold, clickMs p95: 83.0 → 96.1.
- primary / local / 5000 / applicants → applicantDetail / cold, sourcePlusClickMs p50: 325.1 → 349.1.
- primary / local / 5000 / applicants → applicantDetail / cold, sourceUsefulMs p50: 246.0 → 253.0.
- primary / local / 5000 / applicants → applicantDetail / warm, clickMs p50: 97.0 → 97.1.
- primary / local / 5000 / applicants → applicantDetail / warm, fontReadyMs p50: 109.5 → 112.0.
- primary / local / 5000 / applicants → applicantDetail / warm, fontReadyMs p95: 115.5 → 117.5.
- primary / local / 5000 / applicants → applicantDetail / warm, first-contentful-paintMs p50: 72.0 → 76.0.
- primary / constrained / 1000 / recruiting → applicants / cold, fontReadyMs p50: 4,237.9 → 4,252.7.
- primary / constrained / 1000 / recruiting → applicants / cold, sourceCLS p50: 0.000016 → 0.001919.
- primary / constrained / 1000 / recruiting → applicants / warm, clickMs p95: 249.9 → 252.4.
- primary / constrained / 1000 / recruiting → applicants / warm, sourcePlusClickMs p50: 4,525.4 → 4,529.7.
- primary / constrained / 1000 / recruiting → applicants / warm, fontReadyMs p50: 4,245.1 → 4,253.9.
- primary / constrained / 1000 / recruiting → applicants / warm, fontReadyMs p95: 4,264.4 → 4,308.1.
- primary / constrained / 1000 / recruiting → applicants / warm, first-contentful-paintMs p50: 740.0 → 748.0.
- primary / constrained / 1000 / recruiting → applicants / warm, first-contentful-paintMs p95: 772.0 → 808.0.
- primary / constrained / 1000 / applicants → applicantDetail / cold, clickMs p50: 266.1 → 266.2.
- primary / constrained / 1000 / applicants → applicantDetail / cold, fontReadyMs p50: 4,277.2 → 4,294.6.
- primary / constrained / 1000 / applicants → applicantDetail / cold, sourceCLS p50: 0.000016 → 0.001919.
- primary / constrained / 1000 / applicants → applicantDetail / cold, first-contentful-paintMs p95: 760.0 → 772.0.
- primary / constrained / 1000 / applicants → applicantDetail / warm, clickMs p50: 239.9 → 241.0.
- primary / constrained / 1000 / applicants → applicantDetail / warm, fontReadyMs p95: 4,366.8 → 4,567.3.
- primary / constrained / 1000 / applicants → applicantDetail / warm, sourceCLS p50: 0.000016 → 0.001919.
- primary / constrained / 5000 / recruiting → applicants / cold, clickMs p50: 593.2 → 621.7.
- primary / constrained / 5000 / recruiting → applicants / cold, clickMs p95: 669.1 → 912.1.
- primary / constrained / 5000 / recruiting → applicants / cold, sourcePlusClickMs p50: 4,910.1 → 5,194.5.
- primary / constrained / 5000 / recruiting → applicants / cold, sourcePlusClickMs p95: 5,257.1 → 6,440.5.
- primary / constrained / 5000 / recruiting → applicants / cold, sourceUsefulMs p50: 4,322.0 → 4,595.0.
- primary / constrained / 5000 / recruiting → applicants / cold, sourceUsefulMs p95: 4,588.0 → 5,756.0.
- primary / constrained / 5000 / recruiting → applicants / cold, fontReadyMs p50: 4,242.5 → 4,255.1.
- primary / constrained / 5000 / recruiting → applicants / cold, fontReadyMs p95: 4,261.2 → 4,475.6.
- primary / constrained / 5000 / recruiting → applicants / cold, first-contentful-paintMs p50: 736.0 → 772.0.
- primary / constrained / 5000 / recruiting → applicants / cold, first-contentful-paintMs p95: 824.0 → 1,020.0.
- primary / constrained / 5000 / recruiting → applicants / warm, clickMs p50: 231.8 → 385.0.
- primary / constrained / 5000 / recruiting → applicants / warm, clickMs p95: 360.6 → 761.7.
- primary / constrained / 5000 / recruiting → applicants / warm, sourcePlusClickMs p50: 4,571.3 → 4,969.0.
- primary / constrained / 5000 / recruiting → applicants / warm, sourcePlusClickMs p95: 5,055.7 → 8,730.7.
- primary / constrained / 5000 / recruiting → applicants / warm, sourceUsefulMs p50: 4,339.0 → 4,711.0.
- primary / constrained / 5000 / recruiting → applicants / warm, sourceUsefulMs p95: 4,803.0 → 7,969.0.
- primary / constrained / 5000 / recruiting → applicants / warm, fontReadyMs p50: 4,240.9 → 4,399.6.
- primary / constrained / 5000 / recruiting → applicants / warm, fontReadyMs p95: 4,277.2 → 4,516.3.
- primary / constrained / 5000 / recruiting → applicants / warm, first-contentful-paintMs p50: 732.0 → 900.0.
- primary / constrained / 5000 / recruiting → applicants / warm, first-contentful-paintMs p95: 752.0 → 1,056.0.
- primary / constrained / 5000 / applicants → applicantDetail / cold, clickMs p50: 282.2 → 283.6.
- primary / constrained / 5000 / applicants → applicantDetail / cold, sourceUsefulMs p50: 4,748.0 → 4,755.0.
- primary / constrained / 5000 / applicants → applicantDetail / cold, sourceCLS p95: 0.000016 → 0.001919.
- primary / constrained / 5000 / applicants → applicantDetail / cold, first-contentful-paintMs p50: 736.0 → 784.0.
- primary / constrained / 5000 / applicants → applicantDetail / cold, first-contentful-paintMs p95: 828.0 → 960.0.
- primary / constrained / 5000 / applicants → applicantDetail / warm, clickMs p95: 259.5 → 270.4.
- primary / constrained / 5000 / applicants → applicantDetail / warm, sourcePlusClickMs p95: 5,071.2 → 6,120.4.
- primary / constrained / 5000 / applicants → applicantDetail / warm, sourceUsefulMs p95: 4,824.0 → 5,850.0.
- primary / constrained / 5000 / applicants → applicantDetail / warm, fontReadyMs p50: 4,289.9 → 4,290.3.
- primary / constrained / 5000 / applicants → applicantDetail / warm, sourceCLS p50: 0.000016 → 0.001919.
- primary / constrained / 5000 / applicants → applicantDetail / warm, first-contentful-paintMs p95: 772.0 → 796.0.
- feature / constrained / 1000 / overview → settingsProfile / cold, clickMs p95: 508.4 → 732.6.
- feature / constrained / 1000 / overview → settingsProfile / cold, fontReadyMs p50: 4,252.6 → 4,268.4.
- feature / constrained / 1000 / overview → settingsProfile / warm, clickMs p50: 147.0 → 149.4.
- feature / constrained / 1000 / overview → settingsProfile / warm, sourcePlusClickMs p50: 4,098.1 → 4,450.8.
- feature / constrained / 1000 / overview → settingsProfile / warm, sourcePlusClickMs p95: 4,438.4 → 4,470.2.
- feature / constrained / 1000 / overview → settingsProfile / warm, sourceUsefulMs p50: 3,955.0 → 4,299.0.
- feature / constrained / 1000 / overview → settingsProfile / warm, sourceUsefulMs p95: 4,284.0 → 4,332.0.
- feature / constrained / 1000 / overview → settingsProfile / warm, first-contentful-paintMs p50: 732.0 → 736.0.
- feature / constrained / 1000 / overview → settingsProfile / warm, first-contentful-paintMs p95: 780.0 → 908.0.
- feature / constrained / 1000 / overview → meetings / cold, clickMs p50: 444.8 → 454.9.
- feature / constrained / 1000 / overview → meetings / cold, clickMs p95: 457.2 → 471.4.
- feature / constrained / 1000 / overview → meetings / cold, fontReadyMs p50: 4,250.7 → 4,266.5.
- feature / constrained / 1000 / overview → meetings / warm, clickMs p50: 129.7 → 133.3.
- feature / constrained / 1000 / overview → meetings / warm, clickMs p95: 137.5 → 140.9.
- feature / constrained / 1000 / overview → meetings / warm, sourcePlusClickMs p50: 4,053.7 → 4,407.9.
- feature / constrained / 1000 / overview → meetings / warm, sourcePlusClickMs p95: 4,446.5 → 4,453.9.
- feature / constrained / 1000 / overview → meetings / warm, sourceUsefulMs p50: 3,925.0 → 4,280.0.
- feature / constrained / 1000 / overview → meetings / warm, sourceUsefulMs p95: 4,312.0 → 4,313.0.
- feature / constrained / 1000 / overview → meetings / warm, fontReadyMs p95: 4,269.9 → 4,285.1.
- feature / constrained / 1000 / overview → meetings / warm, first-contentful-paintMs p95: 764.0 → 768.0.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, clickMs p50: 450.2 → 453.0.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, clickMs p95: 455.9 → 472.7.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, sourcePlusClickMs p50: 4,377.0 → 4,394.7.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, sourcePlusClickMs p95: 4,726.9 → 4,762.1.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, sourceUsefulMs p50: 3,923.0 → 3,944.0.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, sourceUsefulMs p95: 4,273.0 → 4,309.0.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, fontReadyMs p50: 4,259.3 → 4,260.4.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, fontReadyMs p95: 4,261.7 → 4,274.0.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, first-contentful-paintMs p50: 732.0 → 740.0.
- feature / constrained / 1000 / recruiting → scheduledDecisions / warm, clickMs p95: 152.2 → 183.3.
- feature / constrained / 1000 / recruiting → scheduledDecisions / warm, fontReadyMs p50: 4,259.5 → 4,260.8.
- feature / constrained / 1000 / recruiting → scheduledDecisions / warm, first-contentful-paintMs p50: 732.0 → 736.0.
- feature / constrained / 1000 / settingsApplication → rounds / cold, clickMs p50: 595.1 → 595.4.
- feature / constrained / 1000 / settingsApplication → rounds / cold, sourceUsefulMs p50: 4,352.0 → 4,353.0.
- feature / constrained / 1000 / settingsApplication → rounds / cold, first-contentful-paintMs p50: 732.0 → 740.0.
- feature / constrained / 1000 / settingsApplication → rounds / warm, clickMs p95: 278.2 → 281.5.
- feature / constrained / 1000 / settingsApplication → rounds / warm, sourcePlusClickMs p50: 1,190.2 → 1,209.5.
- feature / constrained / 1000 / settingsApplication → rounds / warm, sourceUsefulMs p50: 920.0 → 943.0.
- feature / constrained / 1000 / settingsApplication → rounds / warm, fontReadyMs p50: 4,418.4 → 4,418.6.
- feature / constrained / 1000 / settingsApplication → rounds / warm, fontReadyMs p95: 4,443.7 → 4,444.3.
- interaction / local / 1000 / next-page, meaningfulMs p50: 96.4 → 96.6.
- interaction / local / 1000 / next-page, meaningfulMs p95: 111.9 → 112.9.
- interaction / local / 5000 / next-page, meaningfulMs p50: 195.7 → 195.8.
- interaction / constrained / 1000 / next-page, meaningfulMs p50: 202.0 → 202.9.
- interaction / constrained / 1000 / next-page, meaningfulMs p95: 206.1 → 212.3.
- interaction / constrained / 1000 / distant-search, meaningfulMs p50: 120.7 → 123.4.
- interaction / constrained / 1000 / distant-search, meaningfulMs p95: 129.5 → 133.2.
- interaction / constrained / 5000 / next-page, meaningfulMs p95: 748.5 → 1,547.9.
- interaction / constrained / 5000 / distant-search, meaningfulMs p50: 118.0 → 126.1.
- interaction / constrained / 5000 / distant-search, meaningfulMs p95: 229.3 → 234.7.
- http / 1000 / 1, burstMs p95: 52.1 → 75.0.
- http / 1000 / 2, burstMs p95: 55.6 → 56.3.
- http / 5000 / 1, burstMs p95: 165.5 → 377.0.
- http / 5000 / 4, burstMs p95: 615.3 → 859.2.

Retain the scoped request-ordering result locally and hold publication of the complete series. A synchronous browser fence is appropriate for work whose captured epoch is already obsolete; it must never suppress a later real authority change or replace live validation. The next phase should first repeat the complete matched comparison during an agreed idle-host window, without stopping unrelated work unilaterally, and isolate the retained identity and warm-list transaction tails with request-correlated provider/HTTP, event-loop and database-queue diagnostics in the disposable environment. Keep every required live validation and the bounded concurrency controls. Then isolate the Settings streamed-render/code-download path and anonymous-review handoff, preserving the Recruiting bundle saving while testing a bounded first-use improvement. The unchanged O(N) pipeline scan/freshness policy, prior adverse server tails, public/direct-entry coverage beyond these samples, hosted latency and multi-user pool behavior remain explicit risks. Profile server tails separately; do not infer resolution from a client ordering change.

`IMPLEMENTATION.diff` contains application, test and Phase12 collector changes. Frozen sources/builds, plans/protocols, excluded diagnostics, raw observations, derived distributions/regressions, test logs, power audits, privacy scan, cleanup, evidence inventory and checksums accompany this report. No production changes or publication occurred.
