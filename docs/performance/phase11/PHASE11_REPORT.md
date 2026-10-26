# OutClass performance — Phase 11

Phase 11 defers five inactive feature components from the main club workspace JavaScript. In the constrained 5,000-applicant warm-destination group, the preceding fresh source load changes **4,666.0 / 4,679.0 → 4,306.0 / 4,352.0ms p50 / p95**; observed initial script body bytes change **543,416.0 / 543,416.0 → 493,676.0 / 493,676.0**. The separate list click changes **221.0 / 293.2 → 219.9 / 273.4ms**. This is a client startup experiment. The full results include first-use penalties on the newly deferred screens below.

Baseline: Phase 10 `2c95b4dec8fa218274c37f9dd406a090c37e58e0`; original audit reference `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Branch `codex/performance-phase11-20261025` in the attached managed worktree. Frozen build IDs: baseline `Tha4c6I2ApofrlFBcoCtd`, candidate `02anxbf_teiZ6LLVG7dPN`. This phase remains local, with no push, PR, merge or deployment. The earlier unpublished series' database tails and resident-list/freshness decisions remain unresolved.

## Implementation and security

The sole application change is in `components/club-workspace.tsx`: `ClubSettingsWorkspace`, `ClubMeetingsWorkspace`, the member-only `MeetingList`, `DecisionSchedules` and `RecruitmentReviewSettings` use top-level `next/dynamic` imports with the existing `WorkspaceLoading` fallback. Default SSR is retained. Existing render guards, props, keys, state/draft ownership and actual data readers are unchanged. The other **912 application files** and four font files match Phase 10; its font deferral is retained. No eager hover/focus prefetch is added. Next's build summary estimates workspace initial JavaScript 524KB → 475KB, but observed browser wire bytes, rather than this estimate, determine the measured result.

The real built-browser test verifies feature-specific chunks are absent before selection and downloaded on actual selected visits. `FEATURE_CHUNKS.json` retains the public program-asset mapping used for this check. Public JavaScript module caching is distinct from authorization or protected-data caching. Every actual protected request retains remote identity verification, live Auth session validity/revocation, account enablement, club membership, capabilities, suspension, support-session restrictions, anonymous interview protections and voting snapshot authority. No successful authorization cache is added, and protected content still waits for required validation. Private no-store, Cookie-sensitive responses, Demo isolation and mutations are unchanged. No production configuration, infrastructure, schema/index, database region, dependency, cache library, Redis or Edge Function changes.

## Verification

| Check | Result |
|---|---|
| Ordinary suites | 1,405 passed, 62 explicitly environment-gated skips, 0 failures; 1,467 total |
| Serialized live Auth/account/privacy/revocation/navigation/settings | 66 passed, 0 failures, 0 skips |
| Native security/concurrency | 3 passed |
| Normal disposable verified signup/TOTP provisioning | 38 passed |
| Fresh/legacy migrations and browser-role denial | 57 migrations; 78 RLS tables |
| Production build / typecheck | Passed |
| Lint | 0 errors; 22 existing warnings |

Counts overlap and must not be added. The five new built-browser cases cover selected feature loading; abandoning a tab during a held code download; actual logout during that download followed by a denied protected read; durable Settings draft restoration after leaving and reloading without publication; and direct member-only Meetings entry without management controls. The existing cases retain strict GET transport/allowlists, duplicate elimination, scheduler and review draft continuity, rapid switching, late-response fences, live revocation, authorization scopes, font behavior and native metadata parity. Other gated suites remain explicitly skipped.

Development failures remain in `tests/`: a pointer-based test navigation hit the expanded dock, the database correctly prevented demoting the only owner, and a follow-up browser case was cancelled. The host power log also contained Sleep/Wake events; causality was not isolated. The fixture now adds a normal verified replacement owner before testing the member role, and uses the existing keyboard navigation path. The ordinary Settings static-render harness initially replaced every dynamic component with null; it now resolves mocked modules before rendering and keeps all existing permission assertions. A first asynchronous mock attempt waited on a proxy's accidental `then` method; that development run was stopped, and the mock now behaves as a non-thenable module. No application safeguard was removed to make these cases pass. The focused 31-case suite and complete final candidate checks pass. Response holding occurs only in regression tests, never accepted timings.

## Measurement protocol

Matched frozen production builds and independently seeded 1,000/5,000-applicant synthetic cohorts; BA then AB order; local unthrottled and CDP 80ms latency, 200,000B/s down, 93,750B/s up, CPU4×. Main paths use one warmup and five measured outcomes per build/block/path/condition (n10 per comparison, nearest-rank p95=max). Extra feature paths use the 1,000-applicant constrained cohort only, one warmup and three measured outcomes per build/block/path/condition (n6; p95=max). The 16-outcome pilot is excluded whole. All slow rows, errors, warmups and failed/pending transports remain. No product or collector edits, tests or builds compete with accepted collection; temporary awake assertions and actual power-log audits cover each complete accepted set.

Accepted: **384 main browser outcomes (320 measured, 64 warmups)**, **128 extra feature outcomes (96 measured, 32 warmups)**, **192 warm page/search interactions (160 measured, 32 warmups)**, and **336 native HTTP outcomes (280 measured, 56 warmups)**. Cold/warm describes the later destination visit; even a warm-destination row begins from a fresh source browser context. Source starts at document navigation and the existing visible-content predicate. Click runs from the actual action to the actual content predicate plus two animation frames. Settings waits for the enabled real profile fields after draft reading; Meetings waits for fixture data, scheduled decisions for the fetched empty state, and anonymous review for its actual controls. Dock groups/details open before the timed action; anonymous review uses its existing Settings/Application link and real browser-history return. Existing Next Link behavior is retained. Preparatory UI actions and any resulting pre-click prefetch traffic fall outside the source/click capture windows; those intervals are not a complete uninterrupted journey or an accounting of all possible preparation traffic. No extra wait is added to complete prefetch.

Source observation includes the existing bounded non-SSE drain, reported separately from useful content. Pending request snapshots do not prove eventual termination or complete byte accounting: body/script totals are observed encoded bytes. Source+click below is the distribution of each row's sum of two useful-content waits; it excludes source drain, navigation preparation and any deliberate warmup visit. It is neither an uninterrupted elapsed clock nor a sum of percentiles. Font readiness, FCP and observed layout shifts retain Phase 10 instrumentation. No synthetic product delays, response interception or cosmetic clock changes occur in accepted benchmarks.

## Main source and destination

All timings are p50 / p95 ms. Complete network/server/CPU/payload distributions are in `BENCHMARK_RESULTS.json`; every worsening quantile is retained in `REGRESSIONS.json`. Maximum source request timelines and click/interaction/native rows remain in `SOURCE_PEAKS.json` / `PEAKS.json`.

| Profile | Applicants | Destination / visit | Source before → after | Click before → after |
|---|---:|---|---:|---:|
| local | 1,000 | List / cold | 267.0 / 280.0 → 272.0 / 324.0 | 80.5 / 84.4 → 78.7 / 81.6 |
| local | 1,000 | List / warm | 264.0 / 281.0 → 250.0 / 305.0 | 62.2 / 72.6 → 67.5 / 79.1 |
| local | 1,000 | Detail / cold | 240.0 / 279.0 → 219.0 / 259.0 | 79.9 / 93.0 → 80.0 / 82.2 |
| local | 1,000 | Detail / warm | 261.0 / 306.0 → 243.0 / 311.0 | 85.0 / 98.0 → 97.3 / 98.1 |
| local | 5,000 | List / cold | 274.0 / 315.0 → 261.0 / 305.0 | 97.4 / 111.7 → 97.8 / 114.1 |
| local | 5,000 | List / warm | 264.0 / 301.0 → 256.0 / 274.0 | 84.8 / 178.9 → 87.1 / 170.8 |
| local | 5,000 | Detail / cold | 254.0 / 266.0 → 331.0 / 340.0 | 80.1 / 80.6 → 79.9 / 80.8 |
| local | 5,000 | Detail / warm | 322.0 / 352.0 → 251.0 / 327.0 | 97.5 / 101.1 → 97.5 / 136.0 |
| constrained | 1,000 | List / cold | 4,644.0 / 4,706.0 → 4,306.0 / 4,368.0 | 435.1 / 444.0 → 592.8 / 601.4 |
| constrained | 1,000 | List / warm | 4,663.0 / 4,681.0 → 4,314.0 / 4,363.0 | 222.7 / 228.2 → 218.1 / 226.7 |
| constrained | 1,000 | Detail / cold | 4,886.0 / 4,894.0 → 4,753.0 / 4,774.0 | 265.2 / 274.6 → 266.7 / 268.7 |
| constrained | 1,000 | Detail / warm | 4,878.0 / 4,887.0 → 4,756.0 / 4,774.0 | 246.8 / 258.4 → 240.7 / 248.8 |
| constrained | 5,000 | List / cold | 4,661.0 / 4,670.0 → 4,310.0 / 4,364.0 | 435.7 / 442.8 → 593.6 / 600.0 |
| constrained | 5,000 | List / warm | 4,666.0 / 4,679.0 → 4,306.0 / 4,352.0 | 221.0 / 293.2 → 219.9 / 273.4 |
| constrained | 5,000 | Detail / cold | 4,891.0 / 4,893.0 → 4,768.0 / 4,815.0 | 268.0 / 270.1 → 265.7 / 298.4 |
| constrained | 5,000 | Detail / warm | 4,888.0 / 4,895.0 → 4,766.0 / 4,813.0 | 243.2 / 252.4 → 239.6 / 249.4 |

| Profile / applicants / destination / visit | Source requests before → after p50 / p95 | Click requests before → after p50 / p95 | Click bytes before → after p50 / p95 | Source observation incl. drain before → after ms |
|---|---:|---:|---:|---:|
| local / 1000 / List / cold | 56.0 / 57.0 → 48.0 / 48.0 | 5.0 / 5.0 → 9.0 / 9.0 | 39,969.0 / 39,969.0 → 56,905.0 / 56,905.0 | 349.0 / 364.0 → 355.0 / 408.0 |
| local / 1000 / List / warm | 56.0 / 56.0 → 48.0 / 48.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,254.0 / 7,254.0 → 7,254.0 / 7,254.0 | 347.0 / 365.0 → 334.0 / 389.0 |
| local / 1000 / Detail / cold | 60.0 / 60.0 → 56.0 / 56.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,780.0 / 2,780.0 → 2,780.0 / 2,780.0 | 356.0 / 389.0 → 363.0 / 384.0 |
| local / 1000 / Detail / warm | 60.0 / 60.0 → 56.0 / 56.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,780.0 / 2,780.0 → 2,780.0 / 2,780.0 | 361.0 / 403.0 → 364.0 / 456.0 |
| local / 5000 / List / cold | 56.0 / 56.0 → 48.0 / 48.0 | 5.0 / 5.0 → 9.0 / 9.0 | 39,957.0 / 39,957.0 → 56,893.0 / 56,893.0 | 358.0 / 399.0 → 345.0 / 389.0 |
| local / 5000 / List / warm | 56.0 / 56.0 → 48.0 / 48.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,242.0 / 7,242.0 → 7,242.0 / 7,242.0 | 348.0 / 384.0 → 339.0 / 358.0 |
| local / 5000 / Detail / cold | 60.0 / 60.0 → 56.0 / 56.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,771.0 / 2,771.0 → 2,771.0 / 2,771.0 | 392.0 / 409.0 → 413.0 / 423.0 |
| local / 5000 / Detail / warm | 60.0 / 60.0 → 56.0 / 56.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,771.0 / 2,771.0 → 2,771.0 / 2,771.0 | 407.0 / 497.0 → 396.0 / 456.0 |
| constrained / 1000 / List / cold | 59.0 / 59.0 → 50.0 / 50.0 | 5.0 / 5.0 → 9.0 / 9.0 | 39,969.0 / 39,969.0 → 56,905.0 / 56,905.0 | 4,777.0 / 4,830.0 → 4,440.0 / 4,549.0 |
| constrained / 1000 / List / warm | 59.0 / 59.0 → 50.0 / 50.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,254.0 / 7,254.0 → 7,254.0 / 7,254.0 | 4,783.0 / 4,806.0 → 4,456.0 / 4,495.0 |
| constrained / 1000 / Detail / cold | 63.0 / 63.0 → 59.0 / 59.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,780.0 / 2,780.0 → 2,780.0 / 2,780.0 | 5,087.0 / 5,106.0 → 4,841.0 / 4,861.0 |
| constrained / 1000 / Detail / warm | 63.0 / 63.0 → 59.0 / 59.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,780.0 / 2,780.0 → 2,780.0 / 2,780.0 | 5,091.0 / 5,099.0 → 4,844.0 / 4,860.0 |
| constrained / 5000 / List / cold | 59.0 / 59.0 → 50.0 / 50.0 | 5.0 / 5.0 → 9.0 / 9.0 | 39,957.0 / 39,957.0 → 56,893.0 / 56,893.0 | 4,781.0 / 4,816.0 → 4,459.0 / 4,482.0 |
| constrained / 5000 / List / warm | 59.0 / 59.0 → 50.0 / 50.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,242.0 / 7,242.0 → 7,242.0 / 7,242.0 | 4,795.0 / 4,817.0 → 4,450.0 / 4,482.0 |
| constrained / 5000 / Detail / cold | 63.0 / 63.0 → 59.0 / 59.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,771.0 / 2,771.0 → 2,771.0 / 2,771.0 | 5,099.0 / 5,107.0 → 4,856.0 / 4,903.0 |
| constrained / 5000 / Detail / warm | 63.0 / 63.0 → 59.0 / 59.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,771.0 / 2,771.0 → 2,771.0 / 2,771.0 | 5,099.0 / 5,108.0 → 4,852.0 / 4,900.0 |

| 5,000 warm-destination source | Local before → after p50 / p95 | Constrained before → after p50 / p95 |
|---|---:|---:|
| Requests | 56.0 / 56.0 → 48.0 / 48.0 | 59.0 / 59.0 → 50.0 / 50.0 |
| Observed encoded body bytes | 837,139.0 / 837,140.0 → 778,747.0 / 778,748.0 | 837,226.0 / 837,227.0 → 778,834.0 / 778,835.0 |
| Observed script bytes | 543,416.0 / 543,416.0 → 493,676.0 / 493,676.0 | 543,416.0 / 543,416.0 → 493,676.0 / 493,676.0 |
| Script requests | 32.0 / 32.0 → 29.0 / 29.0 | 32.0 / 32.0 → 29.0 / 29.0 |
| Font requests | 2.0 / 2.0 → 2.0 / 2.0 | 2.0 / 2.0 → 2.0 / 2.0 |
| Font bytes | 227,784.0 / 227,784.0 → 227,784.0 / 227,784.0 | 227,784.0 / 227,784.0 → 227,784.0 / 227,784.0 |
| Font readiness ms | 120.6 / 130.6 → 112.9 / 134.6 | 4,548.6 / 4,552.8 → 4,249.0 / 4,269.8 |
| First contentful paint ms | 84.0 / 96.0 → 76.0 / 100.0 | 580.0 / 612.0 → 748.0 / 780.0 |
| CLS | 0.000000 / 0.000000 → 0.000000 / 0.000000 | 0.000016 / 0.000016 → 0.001919 / 0.001919 |
| Source observation elapsed ms incl. bounded drain | 348.0 / 384.0 → 339.0 / 358.0 | 4,795.0 / 4,817.0 → 4,450.0 / 4,482.0 |

| 5,000 warm list click | Local before → after p50 / p95 | Constrained before → after p50 / p95 |
|---|---:|---:|
| Captured requests | 1.0 / 1.0 → 1.0 / 1.0 | 1.0 / 1.0 → 1.0 / 1.0 |
| Observed encoded body bytes | 7,242.0 / 7,242.0 → 7,242.0 / 7,242.0 | 7,242.0 / 7,242.0 → 7,242.0 / 7,242.0 |
| Protected read TTFB ms | 53.3 / 140.9 → 54.3 / 138.1 | 94.0 / 162.2 → 92.0 / 140.9 |
| Server total ms | 51.8 / 139.3 → 52.8 / 136.6 | 63.2 / 153.6 → 59.7 / 138.6 |
| Identity verification ms | 20.3 / 23.8 → 20.7 / 30.1 | 25.1 / 28.4 → 25.9 / 101.8 |
| Database span ms | 18.5 / 107.5 → 19.5 / 106.7 | 22.6 / 115.5 → 20.1 / 24.2 |
| Serialization ms | 0.5 / 0.5 → 0.5 / 0.6 | 0.7 / 2.0 → 0.6 / 0.7 |
| Transfer ms | 0.4 / 0.5 → 0.4 / 0.5 | 38.0 / 40.5 → 38.5 / 40.7 |
| Network drain ms | 56.8 / 145.4 → 57.9 / 141.4 | 146.1 / 214.9 → 145.6 / 196.1 |
| Browser script ms | 11.5 / 13.0 → 11.5 / 12.4 | 51.8 / 55.2 → 49.2 / 58.1 |
| Browser task ms | 35.7 / 41.1 → 35.2 / 38.9 | 176.3 / 182.8 → 170.9 / 202.8 |

The constrained 5,000 cold list click worsens 435.7 / 442.8 → 593.6 / 600.0ms and captured requests rise 5 → 9: script requests rise 3 → 7 and script bytes 31,898 → 48,834. This is a real first-selection penalty even though its preceding source improves. In the warm-source group, FCP rises 580 / 612 → 748 / 780ms and observed CLS 0.000016 → 0.001919. The lower useful-content wait does not make every paint metric better.

Each main timed entry/detail still has exactly one protected pipeline read. This phase changes no data request/transport or server query. Later click, page/search and native server fluctuations are observations rather than evidence of backend improvement. Overlapping phases must not be summed; database spans include transport/Prisma/client scheduling, and transaction acquisition is not an isolated pool wait.

## First-use cost of deferred screens

Constrained, 1,000 applicants; n6 per build/path/condition. The earlier source and later click are shown independently. The real Settings/Application source for anonymous review already needs Settings code; savings on that source may differ from Recruiting/Overview.

| Destination / visit | Source before → after ms | Click before → after ms | Source+click before → after ms | Click requests before → after | Click encoded bytes before → after |
|---|---:|---:|---:|---:|---:|
| overview → settingsProfile / cold | 4,655.0 / 4,672.0 → 4,285.0 / 4,315.0 | 172.3 / 192.7 → 458.6 / 483.5 | 4,828.0 / 4,864.7 → 4,760.5 / 4,771.9 | 2.0 / 2.0 → 9.0 / 9.0 | 249.0 / 249.0 → 22,866.0 / 22,866.0 |
| overview → settingsProfile / warm | 4,641.0 / 4,685.0 → 4,306.0 / 4,327.0 | 154.8 / 169.2 → 162.6 / 171.6 | 4,776.6 / 4,854.2 → 4,442.4 / 4,489.6 | 1.0 / 1.0 → 1.0 / 1.0 | 88.0 / 88.0 → 88.0 / 88.0 |
| overview → meetings / cold | 4,661.0 / 4,700.0 → 3,934.0 / 4,306.0 | 140.7 / 154.0 → 450.1 / 460.5 | 4,801.7 / 4,838.7 → 4,387.5 / 4,750.5 | 1.0 / 1.0 → 7.0 / 7.0 | 397.0 / 397.0 → 36,049.0 / 36,049.0 |
| overview → meetings / warm | 4,289.0 / 4,631.0 → 3,946.0 / 4,295.0 | 123.2 / 138.9 → 125.9 / 141.6 | 4,426.9 / 4,754.2 → 4,083.0 / 4,421.0 | 1.0 / 1.0 → 1.0 / 1.0 | 397.0 / 397.0 → 397.0 / 397.0 |
| recruiting → scheduledDecisions / cold | 4,320.0 / 4,664.0 → 3,944.0 / 4,325.0 | 149.8 / 173.8 → 448.9 / 468.9 | 4,478.5 / 4,806.5 → 4,392.9 / 4,768.0 | 1.0 / 1.0 → 4.0 / 4.0 | 86.0 / 86.0 → 8,023.0 / 8,023.0 |
| recruiting → scheduledDecisions / warm | 4,323.0 / 4,734.0 → 3,937.0 / 3,955.0 | 147.6 / 153.5 → 142.6 / 151.4 | 4,467.4 / 4,887.5 → 4,080.0 / 4,104.4 | 1.0 / 1.0 → 1.0 / 1.0 | 86.0 / 86.0 → 86.0 / 86.0 |
| settingsApplication → rounds / cold | 4,252.0 / 4,292.0 → 4,355.0 / 4,381.0 | 304.7 / 329.0 → 595.9 / 611.2 | 4,577.9 / 4,596.7 → 4,950.9 / 4,978.1 | 4.0 / 5.0 → 8.0 / 8.0 | 1,338.0 / 3,810.0 → 10,176.0 / 12,463.0 |
| settingsApplication → rounds / warm | 633.0 / 897.0 → 927.0 / 4,357.0 | 281.3 / 283.2 → 279.1 / 282.7 | 909.0 / 1,180.2 → 1,209.7 / 4,637.6 | 4.0 / 4.0 → 4.0 / 4.0 | 1,338.0 / 3,812.0 → 1,342.0 / 3,628.0 |

| Destination / visit | Initial script bytes before → after | Click script requests before → after | Click script bytes before → after | Data TTFB before → after ms | Data transfer before → after ms |
|---|---:|---:|---:|---:|---:|
| overview → settingsProfile / cold | 543,416.0 / 543,416.0 → 493,676.0 / 493,676.0 | 0.0 / 0.0 → 4.0 / 4.0 | 0.0 / 0.0 → 20,062.0 / 20,062.0 | 90.4 / 123.5 → 91.8 / 117.6 | 0.4 / 1.1 → 0.4 / 1.8 |
| overview → settingsProfile / warm | 543,416.0 / 543,416.0 → 493,676.0 / 493,676.0 | 0.0 / 0.0 → 0.0 / 0.0 | 0.0 / 0.0 → 0.0 / 0.0 | 105.2 / 116.1 → 111.4 / 116.2 | 0.4 / 0.9 → 0.5 / 0.8 |
| overview → meetings / cold | 543,416.0 / 543,416.0 → 493,676.0 / 493,676.0 | 0.0 / 0.0 → 5.0 / 5.0 | 0.0 / 0.0 → 31,012.0 / 31,012.0 | 93.2 / 96.9 → 91.0 / 97.6 | 0.9 / 1.2 → 0.4 / 0.8 |
| overview → meetings / warm | 543,416.0 / 543,416.0 → 493,676.0 / 493,676.0 | 0.0 / 0.0 → 0.0 / 0.0 | 0.0 / 0.0 → 0.0 / 0.0 | 90.5 / 96.2 → 92.9 / 99.1 | 0.4 / 0.6 → 0.6 / 1.1 |
| recruiting → scheduledDecisions / cold | 543,416.0 / 543,416.0 → 493,676.0 / 493,676.0 | 0.0 / 0.0 → 3.0 / 3.0 | 0.0 / 0.0 → 7,937.0 / 7,937.0 | 102.5 / 113.4 → 100.6 / 117.2 | 0.4 / 1.1 → 0.4 / 0.9 |
| recruiting → scheduledDecisions / warm | 543,416.0 / 543,416.0 → 493,676.0 / 493,676.0 | 0.0 / 0.0 → 0.0 / 0.0 | 0.0 / 0.0 → 0.0 / 0.0 | 97.1 / 111.6 → 99.7 / 110.4 | 0.5 / 1.2 → 0.4 / 1.3 |
| settingsApplication → rounds / cold | 547,304.0 / 547,304.0 → 517,623.0 / 517,623.0 | 0.0 / 0.0 → 2.0 / 2.0 | 0.0 / 0.0 → 7,804.0 / 7,804.0 | 95.5 / 112.7 → 98.4 / 103.4 | 0.8 / 10.3 → 1.0 / 9.1 |
| settingsApplication → rounds / warm | 547,304.0 / 547,304.0 → 517,623.0 / 517,623.0 | 0.0 / 0.0 → 0.0 / 0.0 | 0.0 / 0.0 → 0.0 / 0.0 | 98.2 / 105.4 → 96.2 / 104.1 | 0.6 / 10.3 → 0.9 / 8.9 |

Anonymous review is the clear adverse path: cold source+click changes 4,577.9 / 4,596.7 → 4,950.9 / 4,978.1ms; warm-destination Settings source changes 633.0 / 897.0 → 927.0 / 4,357.0ms even though the later warm click changes only 281.3 / 283.2 → 279.1 / 282.7ms. Keeping default SSR does not establish equal content timing. The initial Settings render/download sequence needs further investigation; these observations do not isolate its mechanism or establish a database cause.

A slower cold click on a deferred feature is an observed cost of moving public code downloads to selection. The table tests whether earlier startup savings offset that cost in these paths; it does not establish how often real users visit them or make every destination faster. Warm visits can reuse the downloaded program modules, but required protected reads still validate live authority. Server Actions without Server-Timing headers remain visible as request TTFB/transfer observations; no server phase is invented for them.

## Warm interactions and native diagnostic

| Profile | Applicants | Interaction | Before p50 / p95 ms | After p50 / p95 ms | Requests before → after |
|---|---:|---|---:|---:|---:|
| local | 1,000 | next-page | 95.9 / 96.4 | 96.0 / 96.7 | 1.0 / 1.0 → 1.0 / 1.0 |
| local | 1,000 | distant-search | 61.2 / 62.1 | 61.3 / 77.5 | 1.0 / 1.0 → 1.0 / 1.0 |
| local | 5,000 | next-page | 179.7 / 196.0 | 182.7 / 196.3 | 1.0 / 1.0 → 1.0 / 1.0 |
| local | 5,000 | distant-search | 77.6 / 93.5 | 77.5 / 95.1 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained | 1,000 | next-page | 210.4 / 217.9 | 206.1 / 212.6 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained | 1,000 | distant-search | 129.2 / 136.7 | 125.5 / 134.9 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained | 5,000 | next-page | 266.8 / 273.8 | 267.3 / 273.1 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained | 5,000 | distant-search | 128.4 / 137.4 | 127.6 / 134.3 | 1.0 / 1.0 → 1.0 / 1.0 |

| Applicants | Simultaneous readers | Burst before → after p50 / p95 ms | Request before → after p50 / p95 ms |
|---:|---:|---:|---:|
| 1,000 | 1 | 46.2 / 48.5 → 45.0 / 51.2 | 46.2 / 48.5 → 45.0 / 51.2 |
| 1,000 | 2 | 49.9 / 56.6 → 50.9 / 58.0 | 49.7 / 53.5 → 49.0 / 55.1 |
| 1,000 | 4 | 60.6 / 76.4 → 60.9 / 71.3 | 54.0 / 69.6 → 56.5 / 69.3 |
| 5,000 | 1 | 134.9 / 161.7 → 136.5 / 141.8 | 134.9 / 161.7 → 136.5 / 141.8 |
| 5,000 | 2 | 155.5 / 229.9 → 154.0 / 241.9 | 150.9 / 211.3 → 153.2 / 230.7 |
| 5,000 | 4 | 188.2 / 201.1 → 201.3 / 214.1 | 175.7 / 194.4 → 184.4 / 207.4 |

Native HTTP uses the identical pipelinePage GET in both builds, bounded 1/2/4 readers, eight connections per client and nominal 25ms aggregate sampling. There are ten measured bursts per group and 10/20/40 per-request observations. Aggregate observed maxima: 9 connections, 4 active queries, 4 idle-in-transaction connections and 0 lock-waiting samples. The monitor is excluded, short peaks may be missed, and aggregate connections do not establish pool saturation. Fixed-order local same-role diagnostics do not establish hosted or multi-user behavior.

## Errors, regressions and next phase

local main: 192 outcomes; 0 failed outcomes, 0 page errors, 0 HTTP errors. Captured background transports: 11 failed, 192 pending SSE, 0 other pending snapshots; source preparations with additional pipeline reads: 0. Interactions: 96, 0 failed, 0 script errors including preparation.

constrained main: 192 outcomes; 0 failed outcomes, 0 page errors, 0 HTTP errors. Captured background transports: 0 failed, 192 pending SSE, 112 other pending snapshots; source preparations with additional pipeline reads: 43. Interactions: 96, 0 failed, 0 script errors including preparation.

constrained feature: 128 outcomes; 0 failed outcomes, 0 page errors, 0 HTTP errors. Captured background transports: 23 failed, 128 pending SSE, 6 other pending snapshots; source preparations with additional pipeline reads: 0.

Native HTTP: 336 outcomes, 0 failures; all retain private no-store and Cookie sensitivity. Background failures after an HTTP response, pending snapshots and failed useful-content navigation are distinct. Authority events and extra source reads are retained. `TRANSPORT_DETAILS.json` groups their sanitized routes/statuses for inspection.

The 11 local main failed transports are recruitment-cycle Server Action responses after HTTP 200 (baseline 5, candidate 6). The 23 feature failures are workspace RSC responses aborted after HTTP 200 (baseline 11, candidate 12), with successful visible navigation. Main constrained non-SSE pending snapshots are view-as and corkboard reads: baseline 8 each, candidate 48 each. The feature series adds baseline 1 each and candidate 2 each. Their eventual completion is not established.

All 43 main source preparations with an additional pipeline read occur in candidate rows, alongside 43 recorded `readAuthority` causes. These are not proven to be identical reads within one authorization scope: the live authority fence can require a fresh read. The timing/order correlation needs investigation before release; suppressing that signal or caching successful authorization would be a security shortcut. Required source refreshes and the background-pending gap remain unresolved despite lower aggregate source requests.

All worsening useful-content, paired-wait, interaction/burst, font/FCP and CLS quantiles are enumerated below; every other metric is retained in the complete machine-readable regression inventory. These small samples do not establish causality for unchanged code paths.

- primary / local / 1000 / recruiting → applicants / cold, sourcePlusClickMs p50: 344.5 → 349.6.
- primary / local / 1000 / recruiting → applicants / cold, sourcePlusClickMs p95: 357.3 → 403.5.
- primary / local / 1000 / recruiting → applicants / cold, sourceUsefulMs p50: 267.0 → 272.0.
- primary / local / 1000 / recruiting → applicants / cold, sourceUsefulMs p95: 280.0 → 324.0.
- primary / local / 1000 / recruiting → applicants / cold, fontReadyMs p50: 105.9 → 116.4.
- primary / local / 1000 / recruiting → applicants / cold, first-contentful-paintMs p95: 92.0 → 100.0.
- primary / local / 1000 / recruiting → applicants / warm, clickMs p50: 62.2 → 67.5.
- primary / local / 1000 / recruiting → applicants / warm, clickMs p95: 72.6 → 79.1.
- primary / local / 1000 / recruiting → applicants / warm, sourcePlusClickMs p95: 353.6 → 373.1.
- primary / local / 1000 / recruiting → applicants / warm, sourceUsefulMs p95: 281.0 → 305.0.
- primary / local / 1000 / applicants → applicantDetail / cold, clickMs p50: 79.9 → 80.0.
- primary / local / 1000 / applicants → applicantDetail / warm, clickMs p50: 85.0 → 97.3.
- primary / local / 1000 / applicants → applicantDetail / warm, clickMs p95: 98.0 → 98.1.
- primary / local / 1000 / applicants → applicantDetail / warm, sourcePlusClickMs p95: 387.9 → 407.8.
- primary / local / 1000 / applicants → applicantDetail / warm, sourceUsefulMs p95: 306.0 → 311.0.
- primary / local / 1000 / applicants → applicantDetail / warm, fontReadyMs p95: 116.8 → 124.7.
- primary / local / 1000 / applicants → applicantDetail / warm, first-contentful-paintMs p95: 80.0 → 88.0.
- primary / local / 5000 / recruiting → applicants / cold, clickMs p50: 97.4 → 97.8.
- primary / local / 5000 / recruiting → applicants / cold, clickMs p95: 111.7 → 114.1.
- primary / local / 5000 / recruiting → applicants / cold, fontReadyMs p50: 104.6 → 114.8.
- primary / local / 5000 / recruiting → applicants / cold, fontReadyMs p95: 122.2 → 124.4.
- primary / local / 5000 / recruiting → applicants / cold, first-contentful-paintMs p95: 100.0 → 108.0.
- primary / local / 5000 / recruiting → applicants / warm, clickMs p50: 84.8 → 87.1.
- primary / local / 5000 / recruiting → applicants / warm, fontReadyMs p95: 130.6 → 134.6.
- primary / local / 5000 / recruiting → applicants / warm, first-contentful-paintMs p95: 96.0 → 100.0.
- primary / local / 5000 / applicants → applicantDetail / cold, clickMs p95: 80.6 → 80.8.
- primary / local / 5000 / applicants → applicantDetail / cold, sourcePlusClickMs p50: 333.5 → 411.0.
- primary / local / 5000 / applicants → applicantDetail / cold, sourcePlusClickMs p95: 345.4 → 420.5.
- primary / local / 5000 / applicants → applicantDetail / cold, sourceUsefulMs p50: 254.0 → 331.0.
- primary / local / 5000 / applicants → applicantDetail / cold, sourceUsefulMs p95: 266.0 → 340.0.
- primary / local / 5000 / applicants → applicantDetail / warm, clickMs p95: 101.1 → 136.0.
- primary / constrained / 1000 / recruiting → applicants / cold, clickMs p50: 435.1 → 592.8.
- primary / constrained / 1000 / recruiting → applicants / cold, clickMs p95: 444.0 → 601.4.
- primary / constrained / 1000 / recruiting → applicants / cold, sourceCLS p50: 0.000016 → 0.001919.
- primary / constrained / 1000 / recruiting → applicants / cold, first-contentful-paintMs p50: 576.0 → 736.0.
- primary / constrained / 1000 / recruiting → applicants / cold, first-contentful-paintMs p95: 620.0 → 776.0.
- primary / constrained / 1000 / recruiting → applicants / warm, sourceCLS p50: 0.000016 → 0.001919.
- primary / constrained / 1000 / recruiting → applicants / warm, first-contentful-paintMs p50: 588.0 → 740.0.
- primary / constrained / 1000 / recruiting → applicants / warm, first-contentful-paintMs p95: 616.0 → 756.0.
- primary / constrained / 1000 / applicants → applicantDetail / cold, clickMs p50: 265.2 → 266.7.
- primary / constrained / 1000 / applicants → applicantDetail / cold, sourceCLS p50: 0.000004 → 0.001919.
- primary / constrained / 1000 / applicants → applicantDetail / cold, first-contentful-paintMs p50: 588.0 → 744.0.
- primary / constrained / 1000 / applicants → applicantDetail / cold, first-contentful-paintMs p95: 644.0 → 792.0.
- primary / constrained / 1000 / applicants → applicantDetail / warm, sourceCLS p50: 0.000004 → 0.000016.
- primary / constrained / 1000 / applicants → applicantDetail / warm, first-contentful-paintMs p50: 580.0 → 744.0.
- primary / constrained / 1000 / applicants → applicantDetail / warm, first-contentful-paintMs p95: 608.0 → 816.0.
- primary / constrained / 5000 / recruiting → applicants / cold, clickMs p50: 435.7 → 593.6.
- primary / constrained / 5000 / recruiting → applicants / cold, clickMs p95: 442.8 → 600.0.
- primary / constrained / 5000 / recruiting → applicants / cold, sourceCLS p50: 0.000016 → 0.001919.
- primary / constrained / 5000 / recruiting → applicants / cold, first-contentful-paintMs p50: 588.0 → 744.0.
- primary / constrained / 5000 / recruiting → applicants / cold, first-contentful-paintMs p95: 616.0 → 792.0.
- primary / constrained / 5000 / recruiting → applicants / warm, sourceCLS p50: 0.000016 → 0.001919.
- primary / constrained / 5000 / recruiting → applicants / warm, sourceCLS p95: 0.000016 → 0.001919.
- primary / constrained / 5000 / recruiting → applicants / warm, first-contentful-paintMs p50: 580.0 → 748.0.
- primary / constrained / 5000 / recruiting → applicants / warm, first-contentful-paintMs p95: 612.0 → 780.0.
- primary / constrained / 5000 / applicants → applicantDetail / cold, clickMs p95: 270.1 → 298.4.
- primary / constrained / 5000 / applicants → applicantDetail / cold, sourceCLS p50: 0.000004 → 0.000016.
- primary / constrained / 5000 / applicants → applicantDetail / cold, sourceCLS p95: 0.000016 → 0.001919.
- primary / constrained / 5000 / applicants → applicantDetail / cold, first-contentful-paintMs p50: 580.0 → 732.0.
- primary / constrained / 5000 / applicants → applicantDetail / cold, first-contentful-paintMs p95: 628.0 → 784.0.
- primary / constrained / 5000 / applicants → applicantDetail / warm, sourceCLS p50: 0.000004 → 0.000016.
- primary / constrained / 5000 / applicants → applicantDetail / warm, sourceCLS p95: 0.000016 → 0.001919.
- primary / constrained / 5000 / applicants → applicantDetail / warm, first-contentful-paintMs p50: 580.0 → 744.0.
- primary / constrained / 5000 / applicants → applicantDetail / warm, first-contentful-paintMs p95: 612.0 → 816.0.
- feature / constrained / 1000 / overview → settingsProfile / cold, clickMs p50: 172.3 → 458.6.
- feature / constrained / 1000 / overview → settingsProfile / cold, clickMs p95: 192.7 → 483.5.
- feature / constrained / 1000 / overview → settingsProfile / cold, sourceCLS p50: 0.000016 → 0.001919.
- feature / constrained / 1000 / overview → settingsProfile / cold, first-contentful-paintMs p50: 572.0 → 740.0.
- feature / constrained / 1000 / overview → settingsProfile / cold, first-contentful-paintMs p95: 584.0 → 820.0.
- feature / constrained / 1000 / overview → settingsProfile / warm, clickMs p50: 154.8 → 162.6.
- feature / constrained / 1000 / overview → settingsProfile / warm, clickMs p95: 169.2 → 171.6.
- feature / constrained / 1000 / overview → settingsProfile / warm, sourceCLS p50: 0.000016 → 0.001919.
- feature / constrained / 1000 / overview → settingsProfile / warm, first-contentful-paintMs p50: 584.0 → 728.0.
- feature / constrained / 1000 / overview → settingsProfile / warm, first-contentful-paintMs p95: 652.0 → 748.0.
- feature / constrained / 1000 / overview → meetings / cold, clickMs p50: 140.7 → 450.1.
- feature / constrained / 1000 / overview → meetings / cold, clickMs p95: 154.0 → 460.5.
- feature / constrained / 1000 / overview → meetings / cold, sourceCLS p50: 0.000016 → 0.001919.
- feature / constrained / 1000 / overview → meetings / cold, first-contentful-paintMs p50: 576.0 → 736.0.
- feature / constrained / 1000 / overview → meetings / cold, first-contentful-paintMs p95: 604.0 → 792.0.
- feature / constrained / 1000 / overview → meetings / warm, clickMs p50: 123.2 → 125.9.
- feature / constrained / 1000 / overview → meetings / warm, clickMs p95: 138.9 → 141.6.
- feature / constrained / 1000 / overview → meetings / warm, first-contentful-paintMs p50: 608.0 → 736.0.
- feature / constrained / 1000 / overview → meetings / warm, first-contentful-paintMs p95: 636.0 → 788.0.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, clickMs p50: 149.8 → 448.9.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, clickMs p95: 173.8 → 468.9.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, first-contentful-paintMs p50: 576.0 → 732.0.
- feature / constrained / 1000 / recruiting → scheduledDecisions / cold, first-contentful-paintMs p95: 600.0 → 772.0.
- feature / constrained / 1000 / recruiting → scheduledDecisions / warm, first-contentful-paintMs p50: 584.0 → 736.0.
- feature / constrained / 1000 / recruiting → scheduledDecisions / warm, first-contentful-paintMs p95: 620.0 → 756.0.
- feature / constrained / 1000 / settingsApplication → rounds / cold, clickMs p50: 304.7 → 595.9.
- feature / constrained / 1000 / settingsApplication → rounds / cold, clickMs p95: 329.0 → 611.2.
- feature / constrained / 1000 / settingsApplication → rounds / cold, sourcePlusClickMs p50: 4,577.9 → 4,950.9.
- feature / constrained / 1000 / settingsApplication → rounds / cold, sourcePlusClickMs p95: 4,596.7 → 4,978.1.
- feature / constrained / 1000 / settingsApplication → rounds / cold, sourceUsefulMs p50: 4,252.0 → 4,355.0.
- feature / constrained / 1000 / settingsApplication → rounds / cold, sourceUsefulMs p95: 4,292.0 → 4,381.0.
- feature / constrained / 1000 / settingsApplication → rounds / cold, first-contentful-paintMs p50: 612.0 → 736.0.
- feature / constrained / 1000 / settingsApplication → rounds / cold, first-contentful-paintMs p95: 624.0 → 756.0.
- feature / constrained / 1000 / settingsApplication → rounds / warm, sourcePlusClickMs p50: 909.0 → 1,209.7.
- feature / constrained / 1000 / settingsApplication → rounds / warm, sourcePlusClickMs p95: 1,180.2 → 4,637.6.
- feature / constrained / 1000 / settingsApplication → rounds / warm, sourceUsefulMs p50: 633.0 → 927.0.
- feature / constrained / 1000 / settingsApplication → rounds / warm, sourceUsefulMs p95: 897.0 → 4,357.0.
- feature / constrained / 1000 / settingsApplication → rounds / warm, sourceCLS p50: 0.000016 → 0.001919.
- feature / constrained / 1000 / settingsApplication → rounds / warm, first-contentful-paintMs p50: 600.0 → 608.0.
- feature / constrained / 1000 / settingsApplication → rounds / warm, first-contentful-paintMs p95: 632.0 → 752.0.
- interaction / local / 1000 / next-page, meaningfulMs p50: 95.9 → 96.0.
- interaction / local / 1000 / next-page, meaningfulMs p95: 96.4 → 96.7.
- interaction / local / 1000 / distant-search, meaningfulMs p50: 61.2 → 61.3.
- interaction / local / 1000 / distant-search, meaningfulMs p95: 62.1 → 77.5.
- interaction / local / 5000 / next-page, meaningfulMs p50: 179.7 → 182.7.
- interaction / local / 5000 / next-page, meaningfulMs p95: 196.0 → 196.3.
- interaction / local / 5000 / distant-search, meaningfulMs p95: 93.5 → 95.1.
- interaction / constrained / 5000 / next-page, meaningfulMs p50: 266.8 → 267.3.
- http / 1000 / 1, burstMs p95: 48.5 → 51.2.
- http / 1000 / 2, burstMs p50: 49.9 → 50.9.
- http / 1000 / 2, burstMs p95: 56.6 → 58.0.
- http / 1000 / 4, burstMs p50: 60.6 → 60.9.
- http / 5000 / 1, burstMs p50: 134.9 → 136.5.
- http / 5000 / 2, burstMs p95: 229.9 → 241.9.
- http / 5000 / 4, burstMs p50: 188.2 → 201.3.
- http / 5000 / 4, burstMs p95: 201.1 → 214.1.

Retain this as a measured local client-startup experiment and hold publication of the complete series. The smaller initial script transfer is real, but anonymous-review and first-use delays need refinement before release. Prioritize tracing the new source authority-refresh ordering and the Settings initial-render/code-download sequence, then test a bounded change that preserves the Recruiting startup saving while reducing first-use and anonymous-review penalties. Any deduplication must retain complete authorization scopes and necessary live refreshes. Profile the unchanged live-authorized source sequence and 5,000-applicant server tails separately, retaining the adverse earlier collections. The resident pipeline's O(N) scalar scan and freshness policy, direct-entry/public-page behavior outside these samples, hosted latency, multi-user pool behavior and all earlier adverse server tails remain explicit risks. Do not extend data or authorization caching to hide them.

`IMPLEMENTATION.diff` contains application, harness and test changes. Source/build manifests, declared protocol, excluded pilot, raw observations, derived comparisons, regressions, test logs, power audits, privacy scan, cleanup, evidence inventory and checksums accompany this report. No production changes or publication occurred.
