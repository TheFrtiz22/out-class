# Controlled current-main comparison

Current main `6e793dea0bd45052fa444749b26d432ae93392cd` versus repaired application `4d52103e0ca70086c8ff4f3e913a7bd11f377005`. Times are p50/p95 milliseconds, nearest rank. This is disposable localhost Auth/PostgreSQL on isolated GitHub-hosted Linux VMs, with real production builds. It is not production timing. Raw rows, source and served-build attestations, all milestone/request/span/error distributions and whole-attempt exclusions are in BENCHMARKS.json.

## Primary cold entry and detail

| Profile | Applicants | Directory B → D (ms) | Detail B → D (ms) | n/build/path | Directory encoded bytes p50 B → D |
|---|---:|---|---|---:|---:|
| local | 1 | 208.3/246.8 → 210.1/271.4 | 51.5/62.0 → 53.2/65.0 | 30 | 33513 → 36559 |
| local | 100 | 351.7/458.4 → 352.7/437.7 | 127.5/137.8 → 127.9/144.3 | 10 | 100465 → 104554 |
| local | 1,000 | 1715.0/1851.6 → 406.6/470.8 | 814.1/854.6 → 131.6/140.1 | 10 | 588487 → 104418 |
| local | 5,000 | 8148.3/8547.6 → 624.7/687.3 | 4792.5/4834.6 → 127.1/139.4 | 10 | 2735369 → 105378 |
| constrained | 1 | Pending | Pending | — | — |
| constrained | 100 | Pending | Pending | — | — |
| constrained | 1,000 | Pending | Pending | — | — |
| constrained | 5,000 | Pending | Pending | — | — |

At one applicant the current primary detail window has four total observed requests in both variants and two guarded workspace GETs. It adds no pipeline detail GET. The historical B/C three→four count used an older source/window and is retained separately. Primary detail content and later network/review readiness are recorded separately.

## Strict complete review

This includes source preparation, visible independent review panels, switching, search/clear, complete quick-review selection, cold/warm Voting history, full Applied-pool selection, setup discard and return. It is a stricter, longer workflow than the historical 1,030→1,145 ms comparison. The observer inspects visible rows and automation/actionability cost grows with DOM size; especially the 5,000-row baseline journey must not be presented as isolated app or production-user latency.

| Profile | Applicants | Whole workflow B → D (ms) | Continuous source-through-content B → D (ms) | n/build | Requests p50/max B → D |
|---|---:|---|---|---:|---|
| local | 1 | 4228.3/4672.2 → 4195.1/4544.8 | 5455.3/5885.0 → 5414.1/5731.6 | 10 | 16/16 → 16/16 |
| local | 100 | 5174.4/5657.3 → 5204.9/5807.0 | 6393.7/6827.8 → 6390.5/7041.0 | 10 | 19/19 → 19/19 |
| local | 1,000 | 17875.5/18249.6 → 5812.8/5888.8 | 19223.3/19691.3 → 7012.6/7114.8 | 10 | 19/19 → 22/22 |
| local | 5,000 | 174456.6/182596.7 → 7414.3/7485.9 | 175840.7/185072.6 → 8614.2/8715.9 | 10 | 44/47 → 22/22 |
| constrained | 1 | Pending | Pending | — | — |
| constrained | 100 | Pending | Pending | — | — |
| constrained | 1,000 | Pending | Pending | — | — |
| constrained | 5,000 | Pending | Pending | — | — |

| Profile | 100-applicant Voting history | B p50/p95 (ms) | D p50/p95 (ms) | n/build |
|---|---|---:|---:|---:|
| local | votingCold | 283.3/341.3 | 291.0/314.9 | 10 |
| local | votingWarm | 280.5/322.4 | 284.9/314.9 | 10 |
| constrained | votingCold | Pending | Pending | — |
| constrained | votingWarm | Pending | Pending | — |

Initial entry still includes fresh selection in the existing read-only voting snapshot. Ordinary closed-setup polling omits it; explicitly reopening setup requires a fresh exact read. The extra Applied-pool snapshot remains an intentional fresh operation. Persistent live rooms are functionally verified separately and are not these timings.

## Bounded reader capacity

| Applicants | Readers | B p50/p95 (ms) | D p50/p95 (ms) | n/build |
|---:|---:|---:|---:|---:|
| 1,000 | 1 | 518.3/544.4 | 170.8/216.8 | 5 |
| 1,000 | 2 | 724.4/762.6 | 211.1/262.7 | 10 |
| 1,000 | 4 | 1320.4/1367.9 | 351.6/364.3 | 20 |
| 5,000 | 1 | 2382.8/2407.4 | 385.9/399.2 | 5 |
| 5,000 | 2 | 3680.4/3774.8 | 482.5/524.0 | 10 |
| 5,000 | 4 | 6873.8/7201.6 | 869.9/893.9 | 20 |

Pool limit eight applies to the application connection pool. Correlated burst samples are labeled and are not independent hosted capacity guarantees. The monitor excludes its own connection. All 140 measured requests succeeded; 56 warmups are excluded. Observed maxima: five application connections, four active, four idle in transaction, zero waiting on locks. These HTTP durations are not whole-navigation measurements.

## Evidence and limits

Local: 560 measured browser outcomes, 160 excluded browser warmups, zero functional/HTTP/page failures. All local latency/request gates and all six capacity gates pass. The constrained comparison remains pending. The fixed tolerances were declared in ACCEPTANCE.md before candidate results; no limit changed. Thirty samples/build/path/condition at one applicant, ten elsewhere; n10 p95 is the maximum and is not a statistically reliable production p95.

Full-workflow encoded totals remain null where response sizes are missing. Known partial byte sums and unknown counts are retained separately. Requestfailed events are counted as aborts without inventing transport-cause classifications; native abort/pending classification is unavailable. Server-Timing spans can overlap and must not be summed.

Measured clubs have three answers, two submitted evaluations, two rounds and 61 active members. Shared profiles are enriched repeatedly. Booking/ballot history and large real essays are not represented. Global scalar metadata/ranking and explicit complete selection remain O(N); canonical details are limited to the visible page of at most 100.

No invalid attempt contributes successful samples. Historical B/C context, all Mac attempts, source-mismatched CI, preflight failures and superseded partial source attempts remain separately preserved with disposition and hashes.
