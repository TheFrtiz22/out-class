# OutClass performance — Phase 14

Phase 14 tested starting the Anonymous Review editor download alongside its selected, live-authorized rounds GET, then rejected that change. Constrained cold Review click p50 / p95 changes **594.5 / 595.7 → 612.9 / 627.5ms**; local changes **160.8 / 162.3 → 159.9 / 178.4ms**. The target cold-click quantiles do not both improve. Download overlap did not establish a measurable navigation improvement. The application change is rejected and reverted; preserve the experiment and hold publication.

Comparison: Phase 13 `f14ab3a410268638bfceb7b51b7fb372d18a452b` versus the frozen candidate hashes in `CANDIDATE_SOURCE.json`. Build IDs: baseline `Wlr8arrf3PezIcM74hNyk`, candidate `IsvRepupMBRG8iwEClMiz`. Every before/after table describes this rejected experiment; the retained application/build is exactly baseline B, recorded in `FINAL_SOURCE.json`. Audit reference `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Branch `codex/performance-phase14-20261026`. In tables, B denotes the Phase 13 baseline and A the Phase 14 candidate. No push, PR, merge or deployment.

## Implementation and security

The measured experiment added three lines in the existing `RoundSettings` effect in `components/club-workspace.tsx`: initiate the public editor module import before requesting rounds. Previously the dynamic editor could begin downloading only after rounds settled. The same guarded dynamic component renders the editor and owns its load-error behavior; a speculative import rejection is consumed without bypassing the actual consumer. Code starts only on the selected review's mount/retry. There is no hover/idle prefetch, extra protected-data read or data/authorization cache. The other 912 measured application files match Phase 13. After rejecting the experiment, all 913 retained application files match Phase 13. This preserves earlier fonts, feature deferral, synchronous authority fencing, dirty-draft ownership and live updates.

Every protected read still performs remotely verified identity, live Auth session/revocation, account enablement, membership/capabilities/suspension, support restrictions, anonymous projections and voting snapshot authority as required. Private no-store/Cookie-sensitive behavior and Demo isolation remain. Mutations remain Server Actions. No production Supabase/Vercel configuration, region, schema/index, security policy, dependency, cache library, Redis or Edge Function change.

The investigation tools reuse the Phase 13 host and sanitized request observer with reserved-loopback guards. The separate instrumented browser probes now use the existing Settings/Meetings/Decisions/Review workload, and `rounds` is a fixed non-sensitive category. No diagnostic preload runs in primary timing servers or ships in application code.

## Verification and development history

| Check | Result |
|---|---|
| Measured candidate ordinary suite | 1,414 passed; 65 environment-gated skips; 0 failures; 1,479 total |
| Measured candidate complete serialized live suite | 69 passed; 0 failures; 0 skips |
| Retained application ordinary suite | 1,414 passed; 63 gated skips; 0 failures; 1,477 total |
| Retained application complete serialized live suite | 67 passed; 0 failures; 0 skips |
| Relocated opt-in experiment harness | 2 passed against the measured frozen candidate |
| Dedicated native security/concurrency | 3 passed |
| Normal signup/Auth/TOTP provisioning | 38 passed |
| Fresh/legacy migrations and browser denial | 57 migrations; 78 RLS tables |
| Builds, types and lint | Both production builds and type checks passed; lint 0 errors, 22 existing warnings |

Counts overlap and must not be added. The new ordinary cases exercise local diagnostic guards, safe concurrent correlation and foreign-worker ownership. The two opt-in experimental built-browser cases prove code download while the rounds response is held, and absence of late protected UI after abandoning Review and logging out with code/data held. Captured cookies then receive 401 on a rounds read. Existing tests retain explicit GET transport/allowlists, duplicate elimination, independent Interview Rooms dispatch, scheduler/settings/review draft continuity, rapid switching, mobile/pointer behavior, late-response fences, native metadata parity, revocation, anonymous/support scopes and signup privacy. Optional ordinary gates remain explicitly skipped; this is not a claim that every optional suite ran.

The unchanged overlap test fails on the baseline with its expected 10-second wait-for-code timeout while rounds are held; it passes on the candidate. Response holding is exclusive to regression tests. The experiment harness lives under `tests/experiments/` and requires `OUTCLASS_PHASE14_EXPERIMENT=1` plus the reserved local configuration; it is excluded from ordinary retained-application test discovery. Both excluded development pilots contain eight outcomes. The initial pilot obtains earlier code dispatch but its single constrained cold Review observation is slower; it never enters accepted quantiles. This is why the complete matched comparison, including adverse rows, determines the performance conclusion.

The first selected live invocation passes 65 cases but omits signup privacy. It is retained as `live-initial.log`; the complete 69-case serialized rerun includes all prior Phase 13 selected coverage and both new cases. No application assertion, readiness predicate, timeout or security policy was weakened. All measured-candidate checks and builds finish before accepted measurements. After capture and the rejection decision, separate ordinary/live/type/lint checks verify the retained Phase 13 application. These later checks never compete with measurements. The retained build is the already-validated frozen baseline, with 913 source hashes reverified.

## Controls and membership

Independent synthetic 1,000/5,000-applicant cohorts, identical within each build pair; BA then AB order. Local unthrottled and CDP 80ms,200,000B/s down,93,750B/s up,CPU 4×. Main groups have one warmup plus five measured outcomes per build/block/path/condition (n=10 per final variant group). Feature groups have one warmup plus three measured outcomes (n=6) and run in both profiles for 1,000 applicants. Nearest-rank p95 is a maximum in these small groups.

Membership: 384 main browser outcomes (320 measured/64 warmups),256 feature outcomes (192/64),192 page/search interactions (160/32) and 336 native HTTP outcomes (280/56). The two eight-outcome development pilots and separately instrumented probes are excluded whole. Phase 13 observations remain immutable and are never pooled here. Fresh source document time and later click time remain separate. Source+click is a per-row sum of two useful-content waits, excluding drains, preparation and warm visits; it is not uninterrupted elapsed journey time. Cold/warm describes the destination in a fresh browser context with warm local Next/Auth/database services.

The user confirmed an open lid and idle host. Five-second samples monitor known foreign build/test work, development-worker CPU, original checkout state, total CPU/free memory and power source/mode. Frozen application/collector/plan/package hashes are checked at block boundaries. Observed violations invalidate whole profiles; slow rows are never selectively replaced. Battery use is authorized; one initial source and low-power mode 0 must remain consistent within each profile. Temporary awake assertions do not change persistent settings. Actual Sleep/Wake/DarkWake is independently audited. Sampling can miss brief work and does not prove exclusive host access, fixed frequency or thermal conditions. Unrelated services and external checkout changes remain preserved.

| Profile | Start / end UTC | Host samples | Recorded power | Controls / actual sleep |
|---|---|---:|---|---|
| local | 2026-10-26T23:06:48.090Z / 2026-10-26T23:13:33.779Z | 82 | Battery Power, mode 0; 100% → 99% | Passed / no sleep interruption |
| constrained | 2026-10-26T23:13:38.580Z / 2026-10-26T23:46:11.157Z | 391 | Battery Power, mode 0; 99% → 86% | Passed / no sleep interruption |

## Selected Review timing and request order

| Profile / visit | Source before → after p50 / p95 ms | Click before → after | Source+click before → after | Requests before → after | Encoded bytes before → after |
|---|---:|---:|---:|---:|---:|
| local / cold | 436.0 / 454.0 → 437.0 / 453.0 | 160.8 / 162.3 → 159.9 / 178.4 | 597.3 / 611.2 → 596.9 / 620.4 | 7.0 / 7.0 → 7.0 / 7.0 | 10,176.0 / 10,177.0 → 10,178.0 / 12,468.0 |
| local / warm | 434.0 / 437.0 → 434.0 / 436.0 | 148.8 / 247.7 → 148.3 / 149.6 | 582.4 / 682.7 → 581.3 / 585.1 | 4.0 / 4.0 → 4.0 / 4.0 | 1,342.0 / 1,343.0 → 1,344.0 / 1,345.0 |
| constrained / cold | 930.0 / 945.0 → 926.0 / 950.0 | 594.5 / 595.7 → 612.9 / 627.5 | 1,522.5 / 1,539.7 → 1,549.1 / 1,577.5 | 8.0 / 8.0 → 8.0 / 8.0 | 10,176.0 / 12,463.0 → 10,179.0 / 10,179.0 |
| constrained / warm | 926.0 / 944.0 → 928.0 / 936.0 | 265.1 / 265.3 → 278.2 / 282.6 | 1,190.8 / 1,209.3 → 1,193.7 / 1,217.1 | 4.0 / 4.0 → 4.0 / 4.0 | 1,342.0 / 1,343.0 → 1,345.0 / 3,632.0 |

| Cold measured Review | Code requested before rounds complete / observations with code | Code start minus rounds end p50 / p95 ms | Code/data overlap p50 / p95 ms |
|---|---:|---:|---:|
| local / B | 0 / 6 | 3.0 / 3.0 | 0.0 / 0.0 |
| local / A | 6 / 6 | -30.0 / -28.0 | 1.0 / 1.0 |
| constrained / B | 0 / 6 | 9.0 / 12.0 | 0.0 / 0.0 |
| constrained / A | 6 / 6 | -116.0 / -109.0 | 113.0 / 117.0 |

Negative code-start-minus-rounds-end means dispatch before the rounds response completes. These offsets use the existing browser request clock; they do not establish when parsing/rendering completed. Warm visits may request no editor code. All 64 Review rows, including warmups, are identified in `REVIEW_TIMELINES.json`. Public static module reuse never authorizes data.

| Constrained Review data timing | Cold B → A p50 / p95 ms | Warm B → A p50 / p95 ms |
|---|---:|---:|
| Rounds TTFB | 86.4 / 89.4 → 109.6 / 116.8 | 87.2 / 90.2 → 90.3 / 98.2 |
| Rounds transfer | 0.3 / 0.6 → 0.3 / 1.2 | 0.6 / 0.9 → 0.4 / 0.7 |
| Server total | 27.9 / 35.2 → 26.8 / 35.7 | 27.9 / 36.4 → 27.2 / 29.3 |
| Identity verification | 22.0 / 30.5 → 22.5 / 27.2 | 20.4 / 29.4 → 20.3 / 20.8 |
| Live session | 0.6 / 0.8 → 0.6 / 0.9 | 0.7 / 0.9 → 0.6 / 0.9 |
| Database span | 4.0 / 8.9 → 3.9 / 7.9 | 3.3 / 7.6 → 6.4 / 7.8 |
| Serialization | 0.1 / 0.1 → 0.1 / 0.2 | 0.1 / 0.1 → 0.1 / 0.1 |

## Other feature and main navigation outcomes

Timings, requests and bytes are p50 / p95. Bytes are observed encoded bodies, excluding unavailable late/pending bytes and headers. Preparatory UI/pre-click prefetch traffic is outside the click clock. Server database/transaction spans may overlap; acquisition is not isolated pool-only waiting. Full CPU, network, server, fonts/FCP/CLS, payload and adverse quantiles remain in JSON.

| Profile / feature / visit | Source before → after ms | Click before → after ms | Source+click before → after ms | Requests before → after | Click bytes before → after |
|---|---:|---:|---:|---:|---:|
| local / overview → settingsProfile / cold | 258.0 / 271.0 → 254.0 / 347.0 | 382.8 / 387.6 → 384.9 / 387.2 | 634.6 / 653.8 → 638.2 / 712.9 | 9.0 / 9.0 → 9.0 / 9.0 | 22,705.0 / 22,866.0 → 22,865.0 / 22,865.0 |
| local / overview → settingsProfile / warm | 249.0 / 291.0 → 250.0 / 317.0 | 62.3 / 66.2 → 62.0 / 143.9 | 311.3 / 356.0 → 312.9 / 407.9 | 1.0 / 1.0 → 1.0 / 1.0 | 88.0 / 88.0 → 88.0 / 88.0 |
| local / overview → meetings / cold | 256.0 / 261.0 → 256.0 / 307.0 | 371.0 / 372.3 → 369.7 / 373.2 | 627.0 / 633.3 → 621.6 / 680.2 | 7.0 / 7.0 → 7.0 / 7.0 | 36,049.0 / 36,049.0 → 36,049.0 / 36,049.0 |
| local / overview → meetings / warm | 252.0 / 281.0 → 249.0 / 327.0 | 47.7 / 63.7 → 61.2 / 92.0 | 303.8 / 328.7 → 299.2 / 389.3 | 1.0 / 1.0 → 1.0 / 1.0 | 397.0 / 397.0 → 397.0 / 397.0 |
| local / recruiting → scheduledDecisions / cold | 257.0 / 277.0 → 252.0 / 259.0 | 360.7 / 377.4 → 376.0 / 378.3 | 624.4 / 649.8 → 626.3 / 635.0 | 4.0 / 4.0 → 4.0 / 4.0 | 8,023.0 / 8,023.0 → 8,023.0 / 8,023.0 |
| local / recruiting → scheduledDecisions / warm | 251.0 / 377.0 → 252.0 / 272.0 | 59.0 / 73.4 → 59.7 / 72.8 | 310.9 / 450.4 → 311.5 / 331.7 | 1.0 / 1.0 → 1.0 / 1.0 | 86.0 / 86.0 → 86.0 / 86.0 |
| constrained / overview → settingsProfile / cold | 4,311.0 / 4,350.0 → 4,294.0 / 4,335.0 | 459.2 / 465.3 → 458.6 / 476.1 | 4,771.6 / 4,815.3 → 4,756.5 / 4,805.4 | 9.0 / 9.0 → 9.0 / 9.0 | 22,866.0 / 22,866.0 → 22,865.0 / 22,865.0 |
| constrained / overview → settingsProfile / warm | 4,314.0 / 4,329.0 → 4,295.0 / 4,361.0 | 153.3 / 155.2 → 153.9 / 157.1 | 4,467.6 / 4,482.3 → 4,448.9 / 4,514.9 | 1.0 / 1.0 → 1.0 / 1.0 | 88.0 / 88.0 → 88.0 / 88.0 |
| constrained / overview → meetings / cold | 4,285.0 / 4,341.0 → 4,314.0 / 4,328.0 | 445.7 / 450.9 → 443.4 / 457.4 | 4,735.9 / 4,788.4 → 4,768.3 / 4,785.4 | 7.0 / 7.0 → 7.0 / 7.0 | 36,049.0 / 36,049.0 → 36,049.0 / 36,049.0 |
| constrained / overview → meetings / warm | 4,283.0 / 4,313.0 → 4,295.0 / 4,343.0 | 125.4 / 137.1 → 131.1 / 139.5 | 4,417.1 / 4,440.6 → 4,425.5 / 4,482.5 | 1.0 / 1.0 → 1.0 / 1.0 | 397.0 / 397.0 → 397.0 / 397.0 |
| constrained / recruiting → scheduledDecisions / cold | 4,283.0 / 4,384.0 → 4,277.0 / 4,351.0 | 438.1 / 520.0 → 442.3 / 454.7 | 4,748.3 / 4,820.4 → 4,731.7 / 4,805.6 | 4.0 / 4.0 → 4.0 / 4.0 | 8,023.0 / 8,023.0 → 8,023.0 / 8,023.0 |
| constrained / recruiting → scheduledDecisions / warm | 4,282.0 / 4,341.0 → 4,281.0 / 4,323.0 | 138.3 / 146.6 → 141.2 / 147.2 | 4,428.6 / 4,476.0 → 4,426.1 / 4,464.2 | 1.0 / 1.0 → 1.0 / 1.0 | 86.0 / 86.0 → 86.0 / 86.0 |

| Profile / applicants / destination / visit | Source before → after ms | Click before → after ms | Source requests before → after | Click requests before → after | Click bytes before → after |
|---|---:|---:|---:|---:|---:|
| local / 1,000 / List / cold | 273.0 / 303.0 → 294.0 / 656.0 | 79.2 / 89.9 → 103.6 / 382.4 | 48.0 / 48.0 → 48.0 / 48.0 | 9.0 / 9.0 → 9.0 / 9.0 | 56,914.0 / 56,914.0 → 56,914.0 / 56,914.0 |
| local / 1,000 / List / warm | 261.0 / 307.0 → 294.0 / 402.0 | 64.1 / 68.7 → 78.3 / 104.4 | 48.0 / 48.0 → 48.0 / 48.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,263.0 / 7,263.0 → 7,263.0 / 7,263.0 |
| local / 1,000 / Detail / cold | 216.0 / 226.0 → 243.0 / 772.0 | 80.3 / 86.0 → 80.0 / 99.4 | 56.0 / 56.0 → 56.0 / 56.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,774.0 / 2,774.0 → 2,774.0 / 2,774.0 |
| local / 1,000 / Detail / warm | 231.0 / 265.0 → 291.0 / 496.0 | 97.2 / 98.1 → 97.5 / 209.9 | 56.0 / 56.0 → 56.0 / 56.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,774.0 / 2,774.0 → 2,774.0 / 2,774.0 |
| local / 5,000 / List / cold | 258.0 / 293.0 → 271.0 / 573.0 | 96.5 / 119.4 → 113.0 / 219.0 | 48.0 / 48.0 → 48.0 / 48.0 | 9.0 / 9.0 → 9.0 / 9.0 | 56,921.0 / 56,921.0 → 56,921.0 / 56,921.0 |
| local / 5,000 / List / warm | 269.0 / 306.0 → 250.0 / 661.0 | 90.8 / 178.7 → 92.6 / 204.9 | 48.0 / 48.0 → 48.0 / 48.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,270.0 / 7,270.0 → 7,270.0 / 7,270.0 |
| local / 5,000 / Detail / cold | 238.0 / 341.0 → 314.0 / 502.0 | 80.0 / 86.3 → 80.5 / 134.8 | 56.0 / 56.0 → 56.0 / 57.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,767.0 / 2,767.0 → 2,767.0 / 2,767.0 |
| local / 5,000 / Detail / warm | 242.0 / 736.0 → 292.0 / 426.0 | 83.5 / 98.4 → 96.9 / 114.2 | 56.0 / 57.0 → 56.0 / 57.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,767.0 / 2,767.0 → 2,767.0 / 2,767.0 |
| constrained / 1,000 / List / cold | 4,288.0 / 4,595.0 → 4,287.0 / 4,399.0 | 585.0 / 894.6 → 582.3 / 597.0 | 50.0 / 50.0 → 50.0 / 50.0 | 9.0 / 9.0 → 9.0 / 9.0 | 56,914.0 / 56,914.0 → 56,914.0 / 56,914.0 |
| constrained / 1,000 / List / warm | 4,305.0 / 4,388.0 → 4,288.0 / 4,331.0 | 214.9 / 236.0 → 215.7 / 225.5 | 50.0 / 50.0 → 50.0 / 50.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,263.0 / 7,263.0 → 7,263.0 / 7,263.0 |
| constrained / 1,000 / Detail / cold | 4,699.0 / 4,740.0 → 4,700.0 / 4,763.0 | 254.2 / 267.7 → 259.3 / 276.6 | 58.0 / 58.0 → 58.0 / 58.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,774.0 / 2,774.0 → 2,774.0 / 2,774.0 |
| constrained / 1,000 / Detail / warm | 4,695.0 / 4,702.0 → 4,691.0 / 4,762.0 | 237.9 / 253.8 → 235.2 / 244.7 | 58.0 / 58.0 → 58.0 / 58.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,774.0 / 2,774.0 → 2,774.0 / 2,774.0 |
| constrained / 5,000 / List / cold | 4,275.0 / 4,308.0 → 4,293.0 / 4,309.0 | 584.9 / 600.1 → 579.3 / 595.5 | 50.0 / 50.0 → 50.0 / 50.0 | 9.0 / 9.0 → 9.0 / 9.0 | 56,921.0 / 56,921.0 → 56,921.0 / 56,921.0 |
| constrained / 5,000 / List / warm | 4,293.0 / 4,391.0 → 4,279.0 / 4,362.0 | 215.0 / 277.1 → 215.3 / 284.8 | 50.0 / 50.0 → 50.0 / 50.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,270.0 / 7,270.0 → 7,270.0 / 7,270.0 |
| constrained / 5,000 / Detail / cold | 4,697.0 / 4,724.0 → 4,696.0 / 4,842.0 | 256.3 / 280.8 → 263.6 / 270.3 | 58.0 / 58.0 → 58.0 / 58.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,767.0 / 2,767.0 → 2,767.0 / 2,767.0 |
| constrained / 5,000 / Detail / warm | 4,693.0 / 4,717.0 → 4,719.0 / 4,850.0 | 240.0 / 243.4 → 239.8 / 264.4 | 58.0 / 58.0 → 58.0 / 58.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,767.0 / 2,767.0 → 2,767.0 / 2,767.0 |

Settings module boundaries, its profile/draft reads, Meetings and scheduled decisions are unchanged. Variations there do not establish that Settings streamed rendering or the full first-use tradeoff is fixed. Main list/detail, page/search and native endpoint behavior are unchanged; their timings bound collateral effects and host variability.

## Page/search and bounded native concurrency

| Profile / applicants / interaction | Before p50 / p95 ms | After p50 / p95 ms | Requests before → after |
|---|---:|---:|---:|
| local / 1,000 / next-page | 95.3 / 113.4 | 80.8 / 96.7 | 1.0 / 1.0 → 1.0 / 1.0 |
| local / 1,000 / distant-search | 61.0 / 77.1 | 61.3 / 77.1 | 1.0 / 1.0 → 1.0 / 1.0 |
| local / 5,000 / next-page | 180.0 / 196.1 | 180.2 / 198.9 | 1.0 / 1.0 → 1.0 / 1.0 |
| local / 5,000 / distant-search | 77.5 / 208.7 | 77.8 / 107.0 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained / 1,000 / next-page | 199.5 / 209.5 | 203.9 / 213.8 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained / 1,000 / distant-search | 117.7 / 130.1 | 126.6 / 136.1 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained / 5,000 / next-page | 267.0 / 275.4 | 274.3 / 334.4 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained / 5,000 / distant-search | 118.2 / 277.5 | 117.9 / 133.1 | 1.0 / 1.0 → 1.0 / 1.0 |

| Applicants / readers | Burst before → after p50 / p95 ms | Per-request before → after p50 / p95 ms |
|---|---:|---:|
| 1,000 / 1 | 46.0 / 53.0 → 46.1 / 47.4 | 46.0 / 53.0 → 46.1 / 47.4 |
| 1,000 / 2 | 49.8 / 55.1 → 48.9 / 51.3 | 49.0 / 54.6 → 48.0 / 50.1 |
| 1,000 / 4 | 61.3 / 84.0 → 64.4 / 87.4 | 55.3 / 78.7 → 58.9 / 80.1 |
| 5,000 / 1 | 140.3 / 154.7 → 138.3 / 139.6 | 140.3 / 154.7 → 138.3 / 139.6 |
| 5,000 / 2 | 152.1 / 165.0 → 155.5 / 179.8 | 147.8 / 159.6 → 154.5 / 167.6 |
| 5,000 / 4 | 186.8 / 228.7 → 193.2 / 284.1 | 173.4 / 205.9 → 181.0 / 255.2 |

## Separate server-tail diagnostics

The following are outside primary quantiles: 168 instrumented native GETs,56 direct SDK identity observations,32 feature-browser outcomes and four read-only representative metadata plans. All native traces correlate existing workspace phase UUIDs with incoming diagnostic IDs and Auth HTTP lifecycle stages. Direct SDK observations do not replace application live-session checks or authorize a later request.

| Applicants / build | Matched native traces | Largest completed Auth HTTP ms | Max event-loop delay ms | Metadata plan execution ms | App-role max active / connections / lock waiting |
|---|---:|---:|---:|---:|---:|
| 1,000 / baseline | 42 / 42 | 223.14 | 507.51 | 9.57 | 6 / 9 / 0 |
| 1,000 / candidate | 42 / 42 | 156.85 | 522.19 | 10.27 | 4 / 9 / 0 |
| 5,000 / candidate | 42 / 42 | 88.44 | 473.69 | 32.82 | 6 / 9 / 0 |
| 5,000 / baseline | 42 / 42 | 302.91 | 514.33 | 22.84 | 7 / 9 / 0 |

| Four-reader measured diagnostic | Identity p50 / p95 ms | Auth create→send | Auth send→headers | Auth headers→end | Database span | Observable acquisition |
|---|---:|---:|---:|---:|---:|---:|
| 1,000 / baseline | 26.2 / 32.5 | 0.8 / 1.9 | 25.0 / 30.6 | 0.0 / 0.1 | 30.4 / 39.2 | 0.6 / 0.9 |
| 1,000 / candidate | 27.9 / 32.9 | 0.1 / 2.0 | 26.8 / 32.4 | 0.0 / 0.1 | 27.1 / 35.3 | 0.6 / 3.1 |
| 5,000 / candidate | 27.6 / 32.2 | 0.1 / 1.8 | 27.2 / 30.9 | 0.0 / 0.1 | 120.7 / 151.4 | 0.7 / 1.1 |
| 5,000 / baseline | 27.9 / 47.2 | 0.9 / 2.8 | 26.6 / 44.1 | 0.0 / 0.1 | 118.7 / 139.9 | 0.7 / 1.0 |

| Largest measured primary phase | Value ms | Location |
|---|---:|---|
| identity | 540.57 | local / A / applicants → applicantDetail / cold / source / /api/workspace?kind=pipelinePage |
| live_session | 22.21 | local / A / applicants → applicantDetail / cold / source / /api/workspace?kind=tutorial |
| transaction_acquire | 95.79 | local / A / applicants → applicantDetail / cold / source / /api/workspace?kind=invitations |
| database | 1,899.29 | local / A / recruiting → applicants / cold / source / /api/workspace?kind=overview |
| transaction | 336.19 | constrained / A / applicants → applicantDetail / cold / source / /api/workspace?kind=pipelinePage |
| serialization | 5.66 | constrained / A / applicants → applicantDetail / warm / source / /api/workspace?kind=pipelinePage |
| total | 614.01 | local / A / applicants → applicantDetail / cold / source / /api/workspace?kind=invitations |

These maxima identify retained slow primary requests; they do not isolate provider or pool execution. Exact trace IDs, files and row indices remain in `SERVER_TAILS.json`.

The database phase sums elapsed query-call spans, including observable waiting/transport. Concurrent query spans overlap and can exceed response wall time; the 1,899.29ms aggregate above is not a 1.9-second response or isolated database execution.

Auth create→send includes dispatch/connection/scheduling; send→headers includes transport/provider work/scheduling; headers→end is observed HTTP body completion. These do not isolate provider CPU. Process-window CPU spans overlap concurrent requests; one-second histogram maxima are not a whole-run p95. Role-aggregate 25ms DB samples can miss brief peaks and cannot assign per-request pool waits. Eight is a per-client pool limit, not a whole-system connection limit. The read-only representative plan exports only node/row-count/timing/buffer facts and does not represent the complete protected endpoint.

The lifecycle fields follow [Undici diagnostics](https://github.com/nodejs/undici/blob/main/docs/docs/api/DiagnosticsChannel.md); remotely verified [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser) and live-session SQL remain unchanged. Faster probes cannot explain away the prior Phase 13 roughly 1.5-second identity phases or older multi-second tails. This change touches no backend query, provider call, database pool or identity behavior.

## Errors and adverse outcomes

local main: 192 outcomes; 0 failed useful-content outcomes, 0 page errors, 0 HTTP errors. Transport snapshots: 11 failed, 192 pending SSE, 0 other pending.

constrained main: 192 outcomes; 0 failed useful-content outcomes, 0 page errors, 0 HTTP errors. Transport snapshots: 0 failed, 192 pending SSE, 190 other pending.

local feature: 128 outcomes; 0 failed useful-content outcomes, 0 page errors, 0 HTTP errors. Transport snapshots: 47 failed, 128 pending SSE, 0 other pending.

constrained feature: 128 outcomes; 0 failed useful-content outcomes, 0 page errors, 0 HTTP errors. Transport snapshots: 29 failed, 128 pending SSE, 0 other pending.

local interactions: 96 outcomes; 0 failed, 0 page errors including preparation, 0 timed HTTP errors and 0 timed failed transports. Other preparation network accounting is unavailable.

constrained interactions: 96 outcomes; 0 failed, 0 page errors including preparation, 0 timed HTTP errors and 0 timed failed transports. Other preparation network accounting is unavailable.

Native primary: 336 reads; 0 failures; all preserve private no-store and Cookie sensitivity. Failed/pending transport snapshots are distinct from failed useful-content outcomes. Exact sanitized routes, failure/status details and unknown-byte counts remain in `TRANSPORT_DETAILS.json`.

All worsening quantiles remain in `REGRESSIONS.json`. The largest useful-content/source/paired-wait regressions of at least 50ms appear below; omitted small differences remain fully retained. These small groups do not establish statistical significance.

- primary / local / 1000 / applicants → applicantDetail / cold, sourceUsefulMs p95: 226.0 → 772.0ms.
- primary / local / 1000 / applicants → applicantDetail / cold, sourcePlusClickMs p95: 306.4 → 852.2ms.
- primary / local / 5000 / recruiting → applicants / warm, sourcePlusClickMs p95: 443.9 → 865.9ms.
- primary / local / 1000 / recruiting → applicants / cold, sourcePlusClickMs p95: 380.7 → 791.8ms.
- primary / local / 5000 / recruiting → applicants / warm, sourceUsefulMs p95: 306.0 → 661.0ms.
- primary / local / 1000 / recruiting → applicants / cold, sourceUsefulMs p95: 303.0 → 656.0ms.
- primary / local / 5000 / recruiting → applicants / cold, sourcePlusClickMs p95: 409.9 → 732.9ms.
- primary / local / 1000 / recruiting → applicants / cold, clickMs p95: 89.9 → 382.4ms.
- primary / local / 5000 / recruiting → applicants / cold, sourceUsefulMs p95: 293.0 → 573.0ms.
- primary / local / 1000 / applicants → applicantDetail / warm, sourcePlusClickMs p95: 362.4 → 600.9ms.
- primary / local / 1000 / applicants → applicantDetail / warm, sourceUsefulMs p95: 265.0 → 496.0ms.
- primary / local / 5000 / applicants → applicantDetail / cold, sourcePlusClickMs p95: 421.0 → 636.8ms.
- primary / local / 5000 / applicants → applicantDetail / cold, sourceUsefulMs p95: 341.0 → 502.0ms.
- primary / constrained / 5000 / applicants → applicantDetail / warm, sourcePlusClickMs p95: 4,957.0 → 5,107.0ms.
- primary / constrained / 5000 / applicants → applicantDetail / warm, sourceUsefulMs p95: 4,717.0 → 4,850.0ms.
- primary / constrained / 5000 / applicants → applicantDetail / cold, sourcePlusClickMs p95: 4,981.0 → 5,105.9ms.
- primary / constrained / 5000 / applicants → applicantDetail / cold, sourceUsefulMs p95: 4,724.0 → 4,842.0ms.
- primary / local / 1000 / applicants → applicantDetail / warm, clickMs p95: 98.1 → 209.9ms.
- primary / local / 1000 / recruiting → applicants / warm, sourcePlusClickMs p95: 365.8 → 471.6ms.
- primary / local / 5000 / recruiting → applicants / cold, clickMs p95: 119.4 → 219.0ms.

## Recommendation

The target cold-click quantiles do not both improve. Download overlap did not establish a measurable navigation improvement. The application change is rejected and reverted; preserve the experiment and hold publication. Keep publication of the complete series on hold pending the inherited Settings/review first-use costs and retained adverse tails. Do not generalize earlier code dispatch into broader prefetching or successful authorization reuse. The existing guarded render, ownership and live validation remain authoritative.

The experiment proves earlier dispatch in every measured cold Review case but saves no requests: constrained rounds TTFB p50 increases 86.4→109.6ms while server total stays near 27ms. This is consistent with browser/network scheduling contention or a later rendering/handoff cost, but does not isolate a cause. Warm constrained visits also worsen despite no editor-code request. Do not attribute that warm difference to a cold code download. The next frontend step should follow actual module-evaluation/component-commit/visible-content stages around Settings and Review, preserving the initial Recruiting bundle saving. Overlap can leave parsing, rendering, route handoff, other protected reads or browser scheduling on the critical path; this comparison alone does not isolate which dominates. For backend work, capture long identity phases with request-correlated substages under the affected browser workload before selecting a remedy. Investigate growing metadata/query/ranking work with parity tests before increasing concurrency or pool size. Hosted network/region behavior, multi-user saturation, direct/public entry coverage outside these cases and unmeasured preparation intervals remain limits.

Implementation/application diffs, exact source/build/package manifests, plan and controls, all raw accepted/pilot/diagnostic observations, test history, transport details, privacy scan, owned cleanup and checksums accompany this report. External checkout changes and unrelated services are preserved. No production changes or publication occurred.
