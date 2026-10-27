# OutClass performance — Phase 15

The Settings→Review handoff change is **rejected and reverted**. Constrained cold Review click p50 / p95 changes **594.6 / 611.5 → 465.0 / 1,463.2ms**; warm changes **264.9 / 463.4 → 162.0 / 166.2ms**. Cold click requests change **8.0 / 8.0 → 6.0 / 6.0**, encoded bytes **10,176.0 / 12,465.0 → 10,175.0 / 10,176.0**. The redundant page GET disappears and Review click medians improve in both profiles, but constrained cold p95 worsens from 611.5 to 1463.2ms and source+click p95 from 4980.5 to 9777.2ms. One fully retained candidate sample contains source identity spans up to 4221.61ms and rounds identity 932.40ms. The trace locates waiting but does not explain its root cause or prove independence from the candidate workload. Separate diagnostic cases do not reproduce it. The frozen no-material-unexplained-regression rule is therefore not met; preserve the experiment and restore baseline. This is not proof the handoff causes the stall.

Comparison: Phase 14 `30ad54846c6cbd4d3cf25cafd19eb99d6751f2bc` and its retained Phase 13 application versus the exact candidate hashes in `CANDIDATE_SOURCE.json`. Baseline build `8gb3WlwOdFPhj1b-uU6FI`, candidate `D-Qsd-xB5rEbF8lbg7twQ`. B denotes baseline and A candidate throughout the tables. Final chosen source/build is in `FINAL_SOURCE.json`. Audit reference `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Branch `codex/performance-phase15-20261026`. No push, PR, merge or deployment.

## Implementation and authority

Only `components/club-settings-workspace.tsx` differs in the measured application. **The final application has zero changes from baseline.** `EXPERIMENT_APPLICATION.diff` and `EXPERIMENT_IMPLEMENTATION.diff` preserve the measured candidate; `IMPLEMENTATION.diff` contains retained diagnostic tooling and opt-in tests. The Anonymous Review and Screening rules links retain the same leave/draft guard, delegate plain same-workspace clicks to the existing strict `handleClubLink` helper, and disable their unused server-page intent prefetch. The helper preserves modified and cross-page browser navigation. Existing history integration updates the query while the destination starts its fresh protected readers. The Phase 14 speculative module preload remains rejected. Code deferral, animations, focus rules, layout, draft ownership, mutations and every other application file are unchanged.

The removed page request did not supply the rounds payload. In the measured candidate, the remaining explicit GET still remotely verifies identity and live Auth session/revocation, enabled account, club membership, capability and suspension. Other destination reads and mutations keep their original support-session, anonymous-interview and voting-snapshot authority checks. No successful authorization or protected result is cached between requests. Direct/new-tab entry retains the server page and its guards. Private no-store/Cookie sensitivity and Demo isolation remain. No production configuration, database region/schema/index, security policy, dependency, caching library, Redis or Edge Function change.

## Measured-candidate verification and setup history

| Check | Result |
|---|---|
| Ordinary suite | 1,417 passed; 67 environment-gated skips; 0 failures; 0 cancelled; 1,484 total |
| Complete selected live suite | 71 passed;0 failures; 0 skips |
| Dedicated native security/concurrency | 3 passed |
| Normal verified signup/Auth/TOTP | 38 passed |
| Focused handoff checks | 4 passed; overlap live coverage |
| Existing migrations/browser denial | 57 migrations; 78 RLS tables |
| Builds, types and lint | Both production builds and types passed; lint 0 errors, 22 existing warnings |

Counts overlap and must not be added. New browser cases prove no redundant destination page GET for both handoffs, fresh rounds reads on history revisits, denial/no old editor after global provider-session revocation, blocked navigation during a real held draft save followed by the existing automatic replay, durable draft restoration without publishing, and ordinary modified-click new-tab entry. The final corrected handoff test is also run against baseline and fails for its actual redundant Review page request. The three ordinary diagnostics cases cover disposable guards, safe concurrent correlation and foreign-worker ownership. Existing suites retain GET allowlists/arguments, identity/session/account/membership/capability/suspension, support/anonymous scopes, voting authority, draft continuity, rapid switching, mobile/pointer behavior and native metadata parity. Optional gates remain explicit, not a claim that every optional suite ran.

Development failures remain recorded. The real textarea's accessible name includes its initial value, so the new test uses its actual name prefix. The request counter initially included legitimate browser-Back and unrelated Applicants prefetch; it now rejects only the two Review destination page GETs, while the complete benchmark retains all traffic. The shared autosave capture handler automatically retries navigation after a successful flush; the test verifies that contract rather than waiting for a status on an unmounted editor. No product guard, test timeout, animation or benchmark readiness rule changed.

The first ordinary attempt records 1,416 passes, 67 skips and one cancelled browser case, alongside repeated actual Mac Sleep/Wake events. It is retained as `unit-interrupted.log` and `QA_POWER_INTERRUPTION.json`. The entire suite is rerun under a temporary awake assertion before timing collection. `QA_AWAKE_AUDIT.json` retrospectively audits that complete QA resumption; it changes no primary row membership. Tests/builds finish before accepted timing collection. Both eight-outcome development pilots are excluded whole.

## Final retained-source verification

After diagnostics and rejection, all 913 application hashes match baseline and the existing baseline production build is restored. The complete ordinary suite passes again: **1,417 passed, 63 gated skips, zero failures/cancellations, 1,480 total**. The retained live selection passes **67 / 67**, with types and lint passing (22 existing warnings). Native security/concurrency already passed three cases; all relevant server/Auth/database sources and dependencies are identical. Counts overlap the earlier candidate verification.

The four candidate-only regression cases live in `tests/experiments/navigation-phase15-e2e.test.cjs`, require `OUTCLASS_PHASE15_EXPERIMENT=1` plus the disposable config, and pass again against the frozen candidate. A separate run with the live config but without that opt-in skips all four. They do not assert rejected behavior against the retained application. `FINAL_VERIFICATION.json` records every command interval/status.

## Measurement controls and membership

Same independent 1,000/5,000 synthetic cohorts within each build pair, BA then AB order, local and CDP 80ms/200,000B/s down/93,750B/s up/CPU 4×. Main groups: one warmup plus five measured per build/block/path/condition, final n=10 per variant. Feature groups: one warmup plus three measured in both profiles at 1,000 applicants, n=6. Nearest-rank p95 is a maximum for these small groups. Cold/warm refers to the destination in fresh browser contexts with warm local production Next/Auth/database services.

Membership: 384 main browser outcomes (320 measured/64 warmups),256 feature outcomes (192/64),192 page/search interactions (160/32) and 336 native HTTP outcomes (280/56). Prior phases, development pilots and separate instrumented probes are never pooled into these quantiles. Source and subsequent click are measured separately. Source+click is a per-row sum of two useful-content waits, excluding drains/preparation/warm visits; it is not uninterrupted elapsed journey time. Pre-click intent traffic outside capture windows is not fully accounted. Encoded bodies exclude unavailable late/pending bytes and headers.

Five-second read-only samples monitor known foreign build/test work, dev-worker CPU, original checkout changes, total CPU/free memory and power source/mode. Source/tool/plan/package manifests and actual Sleep/Wake/DarkWake are checked. An observed violation invalidates a whole profile; no slow row is selectively replaced. The user confirmed an idle/open-lid window and permits battery operation; one recorded initial source and low-power mode 0 remain fixed within each profile. Temporary awake assertions change no persistent settings. Sampling can miss brief activity; exclusive access, CPU frequency and thermal state are not proven. Unrelated services and checkout changes remain preserved.

| Profile | Start / end UTC | Host samples | Power | Controls / actual sleep |
|---|---|---:|---|---|
| local | 2026-10-27T01:28:39.920Z / 2026-10-27T01:35:03.293Z | 78 | Battery Power, mode 0; 97% → 95% | Passed / no sleep interruption |
| constrained | 2026-10-27T01:35:07.979Z / 2026-10-27T02:07:58.018Z | 395 | Battery Power, mode 0; 95% → 81% | Passed / no sleep interruption |

## Targeted Review handoff

All timings, requests and bytes are p50 / p95.

| Profile / visit | Source before → after ms | Click before → after ms | Source+click before → after ms | Requests before → after | Bytes before → after |
|---|---:|---:|---:|---:|---:|
| local / cold | 435.0 / 441.0 → 437.0 / 455.0 | 158.6 / 176.4 → 95.8 / 125.7 | 595.5 / 612.4 → 535.7 / 567.7 | 7.0 / 7.0 → 6.0 / 6.0 | 10,175.0 / 10,176.0 → 10,175.0 / 10,175.0 |
| local / warm | 435.0 / 447.0 → 431.0 / 449.0 | 149.3 / 166.0 → 66.2 / 82.0 | 583.2 / 605.0 → 511.0 / 523.6 | 4.0 / 4.0 → 3.0 / 3.0 | 1,341.0 / 1,342.0 → 1,341.0 / 1,342.0 |
| constrained / cold | 4,341.0 / 4,369.0 → 4,341.0 / 8,314.0 | 594.6 / 611.5 → 465.0 / 1,463.2 | 4,933.3 / 4,980.5 → 4,807.2 / 9,777.2 | 8.0 / 8.0 → 6.0 / 6.0 | 10,176.0 / 12,465.0 → 10,175.0 / 10,176.0 |
| constrained / warm | 928.0 / 4,373.0 → 931.0 / 968.0 | 264.9 / 463.4 → 162.0 / 166.2 | 1,195.6 / 4,634.7 → 1,082.2 / 1,130.0 | 4.0 / 4.0 → 3.0 / 3.0 | 1,342.0 / 3,630.0 → 1,341.0 / 1,342.0 |

| Constrained observed stage | Cold B → A p50 / p95 | Warm B → A p50 / p95 |
|---|---:|---:|
| Click→query URL ms | 128.6 / 133.0 → 1.5 / 2.0 | 113.9 / 242.4 → 0.9 / 1.7 |
| Rounds request start ms | 174.0 / 188.8 → 52.0 / 169.0 | 150.1 / 295.7 → 45.7 / 71.7 |
| Rounds response end ms | 263.0 / 276.8 → 139.8 / 1,126.0 | 238.1 / 432.7 → 132.5 / 143.7 |
| Rounds-end→useful DOM ms | 330.2 / 335.6 → 324.7 / 337.2 | 26.6 / 32.9 → 25.5 / 33.5 |
| All captured workspace page GETs | 1.0 / 1.0 → 0.0 / 0.0 | 1.0 / 1.0 → 0.0 / 0.0 |
| Observed page body bytes | 0.0 / 2,288.0 → 0.0 / 0.0 | 0.0 / 2,288.0 → 0.0 / 0.0 |
| Unknown page-body snapshots | 1.0 / 1.0 → 0.0 / 0.0 | 1.0 / 1.0 → 0.0 / 0.0 |
| Favicon requests | 1.0 / 1.0 → 0.0 / 0.0 | 0.0 / 0.0 → 0.0 / 0.0 |
| Rounds TTFB ms | 86.2 / 87.3 → 89.5 / 1,030.9 | 87.9 / 134.3 → 85.4 / 89.1 |
| Rounds transfer ms | 0.4 / 0.4 → 0.3 / 1.9 | 0.3 / 0.6 → 0.4 / 0.6 |
| Rounds server total ms | 31.1 / 53.0 → 39.6 / 956.1 | 31.3 / 121.7 → 43.5 / 58.8 |
| Identity verification ms | 23.5 / 34.2 → 31.4 / 932.4 | 22.9 / 87.5 → 29.4 / 42.4 |
| Live session ms | 0.5 / 1.7 → 0.9 / 7.2 | 0.9 / 2.1 → 1.2 / 7.5 |
| Database span ms | 4.5 / 18.1 → 8.1 / 18.0 | 8.1 / 31.5 → 8.9 / 16.6 |
| Captured script requests | 2.0 / 2.0 → 2.0 / 2.0 | 0.0 / 0.0 → 0.0 / 0.0 |
| Last captured pre-useful script end ms | 403.8 / 417.8 → 277.8 / 1,276.0 | unavailable → unavailable |
| Script-end→useful DOM ms | 188.6 / 197.6 → 186.7 / 188.6 | unavailable → unavailable |
| Browser script delta ms | 76.0 / 88.2 → 62.6 / 129.4 | 34.4 / 55.9 → 32.3 / 44.1 |
| Browser task delta ms | 243.3 / 283.8 → 226.7 / 471.2 | 125.0 / 195.4 → 134.7 / 183.7 |
| Observed page React commits | 13.0 / 13.0 → 12.0 / 13.0 | 12.0 / 12.0 → 11.0 / 11.0 |

Timeline gaps locate observed waiting; they are not exclusive React render duration. Script/task deltas include bounded post-content drain. Sanitized primary page routes omit query values and may include unrelated prefetch or Back traffic. The targeted browser test independently proves that the two Review destination page GETs disappear; it does not suppress other requests. All 64 targeted rows and script completions after useful content remain in `HANDOFF_TIMELINES.json`.

## Other feature and main navigation

| Profile / feature / visit | Source before → after ms | Click before → after ms | Source+click before → after ms | Requests before → after | Bytes before → after |
|---|---:|---:|---:|---:|---:|
| local / overview → settingsProfile / cold | 250.0 / 259.0 → 258.0 / 273.0 | 368.8 / 387.7 → 371.4 / 388.2 | 618.8 / 646.7 → 626.1 / 647.2 | 9.0 / 9.0 → 9.0 / 9.0 | 22,866.0 / 22,866.0 → 22,899.0 / 22,899.0 |
| local / overview → settingsProfile / warm | 252.0 / 299.0 → 240.0 / 257.0 | 62.0 / 64.0 → 62.7 / 65.1 | 314.7 / 361.0 → 304.4 / 319.8 | 1.0 / 1.0 → 1.0 / 1.0 | 88.0 / 88.0 → 88.0 / 88.0 |
| local / overview → meetings / cold | 240.0 / 271.0 → 235.0 / 307.0 | 356.9 / 371.8 → 368.9 / 372.9 | 609.9 / 625.4 → 605.6 / 660.6 | 7.0 / 7.0 → 7.0 / 7.0 | 36,049.0 / 36,049.0 → 36,049.0 / 36,049.0 |
| local / overview → meetings / warm | 241.0 / 275.0 → 246.0 / 263.0 | 47.8 / 63.7 → 48.4 / 64.6 | 293.4 / 320.4 → 306.4 / 325.2 | 1.0 / 1.0 → 1.0 / 1.0 | 397.0 / 397.0 → 397.0 / 397.0 |
| local / recruiting → scheduledDecisions / cold | 254.0 / 273.0 → 255.0 / 283.0 | 376.4 / 377.7 → 360.4 / 378.3 | 631.0 / 649.3 → 614.0 / 643.1 | 4.0 / 4.0 → 4.0 / 4.0 | 8,023.0 / 8,023.0 → 8,023.0 / 8,023.0 |
| local / recruiting → scheduledDecisions / warm | 254.0 / 305.0 → 252.0 / 260.0 | 59.1 / 77.5 → 58.6 / 91.6 | 313.1 / 362.5 → 311.6 / 338.6 | 1.0 / 1.0 → 1.0 / 1.0 | 86.0 / 86.0 → 86.0 / 86.0 |
| constrained / overview → settingsProfile / cold | 3,954.0 / 4,328.0 → 4,290.0 / 4,363.0 | 459.5 / 480.3 → 457.3 / 480.0 | 4,413.5 / 4,786.5 → 4,743.7 / 4,843.0 | 9.0 / 9.0 → 9.0 / 9.0 | 22,866.0 / 22,866.0 → 22,899.0 / 22,899.0 |
| constrained / overview → settingsProfile / warm | 4,313.0 / 4,609.0 → 3,939.0 / 4,565.0 | 150.3 / 215.3 → 143.6 / 170.0 | 4,454.3 / 4,824.3 → 4,109.0 / 4,705.0 | 1.0 / 1.0 → 1.0 / 1.0 | 88.0 / 88.0 → 88.0 / 88.0 |
| constrained / overview → meetings / cold | 4,283.0 / 4,438.0 → 3,938.0 / 4,313.0 | 443.9 / 1,273.8 → 447.1 / 451.1 | 4,727.0 / 5,711.8 → 4,380.7 / 4,761.7 | 7.0 / 7.0 → 7.0 / 7.0 | 36,049.0 / 36,049.0 → 36,049.0 / 36,049.0 |
| constrained / overview → meetings / warm | 4,198.0 / 4,290.0 → 3,954.0 / 4,546.0 | 123.6 / 137.2 → 126.2 / 140.1 | 4,328.3 / 4,422.2 → 4,088.8 / 4,666.8 | 1.0 / 1.0 → 1.0 / 1.0 | 397.0 / 397.0 → 397.0 / 397.0 |
| constrained / recruiting → scheduledDecisions / cold | 4,008.0 / 4,308.0 → 4,023.0 / 4,310.0 | 454.2 / 475.7 → 451.0 / 458.2 | 4,462.2 / 4,749.8 → 4,477.1 / 4,752.8 | 4.0 / 4.0 → 4.0 / 4.0 | 8,023.0 / 8,023.0 → 8,023.0 / 8,023.0 |
| constrained / recruiting → scheduledDecisions / warm | 3,921.0 / 4,344.0 → 4,089.0 / 4,470.0 | 136.4 / 153.7 → 144.1 / 152.0 | 4,064.7 / 4,497.7 → 4,235.7 / 4,614.1 | 1.0 / 1.0 → 1.0 / 1.0 | 86.0 / 86.0 → 86.0 / 86.0 |

| Profile / applicants / destination / visit | Source before → after ms | Click before → after ms | Source requests before → after | Click requests before → after | Bytes before → after |
|---|---:|---:|---:|---:|---:|
| local / 1,000 / List / cold | 271.0 / 282.0 → 250.0 / 301.0 | 79.0 / 82.0 → 78.7 / 84.2 | 48.0 / 48.0 → 48.0 / 48.0 | 9.0 / 9.0 → 9.0 / 9.0 | 56,902.0 / 56,902.0 → 56,902.0 / 56,902.0 |
| local / 1,000 / List / warm | 250.0 / 255.0 → 248.0 / 351.0 | 56.6 / 80.0 → 57.4 / 88.8 | 48.0 / 48.0 → 48.0 / 48.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,251.0 / 7,251.0 → 7,251.0 / 7,251.0 |
| local / 1,000 / Detail / cold | 237.0 / 264.0 → 226.0 / 290.0 | 79.8 / 96.7 → 80.2 / 81.1 | 56.0 / 56.0 → 56.0 / 57.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,795.0 / 2,795.0 → 2,795.0 / 2,795.0 |
| local / 1,000 / Detail / warm | 240.0 / 276.0 → 235.0 / 269.0 | 96.9 / 101.3 → 97.2 / 97.5 | 56.0 / 56.0 → 56.0 / 56.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,795.0 / 2,795.0 → 2,795.0 / 2,795.0 |
| local / 5,000 / List / cold | 272.0 / 305.0 → 260.0 / 295.0 | 97.9 / 143.4 → 96.6 / 172.4 | 48.0 / 48.0 → 48.0 / 48.0 | 9.0 / 9.0 → 9.0 / 9.0 | 56,893.0 / 56,893.0 → 56,893.0 / 56,893.0 |
| local / 5,000 / List / warm | 253.0 / 339.0 → 245.0 / 254.0 | 83.3 / 96.7 → 84.4 / 170.1 | 48.0 / 48.0 → 48.0 / 48.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,242.0 / 7,242.0 → 7,242.0 / 7,242.0 |
| local / 5,000 / Detail / cold | 232.0 / 317.0 → 317.0 / 363.0 | 79.8 / 97.7 → 80.4 / 91.9 | 56.0 / 56.0 → 56.0 / 56.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,763.0 / 2,763.0 → 2,763.0 / 2,763.0 |
| local / 5,000 / Detail / warm | 316.0 / 359.0 → 278.0 / 354.0 | 97.0 / 98.6 → 85.5 / 97.8 | 56.0 / 56.0 → 56.0 / 56.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,763.0 / 2,763.0 → 2,763.0 / 2,763.0 |
| constrained / 1,000 / List / cold | 4,289.0 / 4,608.0 → 4,290.0 / 4,531.0 | 585.3 / 604.1 → 584.6 / 621.2 | 50.0 / 50.0 → 50.0 / 50.0 | 9.0 / 9.0 → 9.0 / 9.0 | 56,902.0 / 56,902.0 → 56,902.0 / 56,902.0 |
| constrained / 1,000 / List / warm | 4,281.0 / 4,440.0 → 4,277.0 / 4,355.0 | 218.3 / 223.2 → 214.2 / 358.7 | 50.0 / 50.0 → 50.0 / 50.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,251.0 / 7,251.0 → 7,251.0 / 7,251.0 |
| constrained / 1,000 / Detail / cold | 4,702.0 / 4,736.0 → 4,694.0 / 5,358.0 | 255.2 / 280.2 → 253.1 / 412.3 | 58.0 / 58.0 → 58.0 / 58.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,795.0 / 2,795.0 → 2,795.0 / 2,795.0 |
| constrained / 1,000 / Detail / warm | 4,694.0 / 4,716.0 → 4,690.0 / 4,803.0 | 237.9 / 262.5 → 240.0 / 269.4 | 58.0 / 58.0 → 58.0 / 58.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,795.0 / 2,795.0 → 2,795.0 / 2,795.0 |
| constrained / 5,000 / List / cold | 4,307.0 / 4,557.0 → 4,274.0 / 4,306.0 | 589.0 / 604.6 → 580.5 / 598.1 | 50.0 / 50.0 → 50.0 / 50.0 | 9.0 / 9.0 → 9.0 / 9.0 | 56,893.0 / 56,893.0 → 56,893.0 / 56,893.0 |
| constrained / 5,000 / List / warm | 4,281.0 / 4,340.0 → 4,288.0 / 4,393.0 | 213.8 / 224.1 → 215.2 / 218.6 | 50.0 / 50.0 → 50.0 / 50.0 | 1.0 / 1.0 → 1.0 / 1.0 | 7,242.0 / 7,242.0 → 7,242.0 / 7,242.0 |
| constrained / 5,000 / Detail / cold | 4,694.0 / 4,705.0 → 4,693.0 / 4,726.0 | 254.7 / 286.1 → 257.1 / 270.1 | 58.0 / 58.0 → 58.0 / 58.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,763.0 / 2,763.0 → 2,763.0 / 2,763.0 |
| constrained / 5,000 / Detail / warm | 4,691.0 / 4,899.0 → 4,694.0 / 4,770.0 | 238.4 / 240.5 → 238.4 / 251.5 | 58.0 / 58.0 → 58.0 / 58.0 | 4.0 / 4.0 → 4.0 / 4.0 | 2,763.0 / 2,763.0 → 2,763.0 / 2,763.0 |

## Page/search and bounded native reads

| Profile / applicants / interaction | Before p50 / p95 ms | After p50 / p95 ms | Requests before → after |
|---|---:|---:|---:|
| local / 1,000 / next-page | 95.6 / 96.7 | 81.3 / 96.9 | 1.0 / 1.0 → 1.0 / 1.0 |
| local / 1,000 / distant-search | 60.7 / 61.4 | 61.1 / 61.9 | 1.0 / 1.0 → 1.0 / 1.0 |
| local / 5,000 / next-page | 182.2 / 197.9 | 183.9 / 196.5 | 1.0 / 1.0 → 1.0 / 1.0 |
| local / 5,000 / distant-search | 78.2 / 109.9 | 77.3 / 94.5 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained / 1,000 / next-page | 199.8 / 202.5 | 201.5 / 255.3 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained / 1,000 / distant-search | 117.8 / 129.7 | 127.6 / 133.0 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained / 5,000 / next-page | 270.1 / 285.4 | 275.7 / 335.6 | 1.0 / 1.0 → 1.0 / 1.0 |
| constrained / 5,000 / distant-search | 120.1 / 133.2 | 118.3 / 132.5 | 1.0 / 1.0 → 1.0 / 1.0 |

| Applicants / readers | Burst before → after p50 / p95 ms | Per-request before → after p50 / p95 ms |
|---|---:|---:|
| 1,000 / 1 | 47.0 / 52.9 → 48.4 / 51.0 | 47.0 / 52.9 → 48.4 / 51.0 |
| 1,000 / 2 | 56.6 / 74.7 → 52.6 / 96.1 | 55.1 / 73.5 → 51.2 / 92.5 |
| 1,000 / 4 | 64.7 / 89.3 → 70.9 / 85.6 | 59.9 / 76.8 → 63.5 / 84.0 |
| 5,000 / 1 | 138.7 / 148.3 → 144.7 / 150.9 | 138.7 / 148.3 → 144.7 / 150.9 |
| 5,000 / 2 | 164.4 / 200.7 → 156.1 / 167.7 | 160.6 / 194.1 → 153.3 / 166.4 |
| 5,000 / 4 | 192.8 / 234.3 → 191.7 / 218.2 | 182.1 / 209.1 → 175.2 / 194.7 |

## Why the cold-tail requirement failed

All six measured candidate cold clicks remain included: 463.1, 464.5, 465.0, 466.2, 493.5 and 1,463.2ms. In the slow row (`constrained/size-1000-pair-2-1-A-features-measure/browser-samples.json`, index 19), the query URL changes after 1.7ms, but rounds dispatch starts at 169ms and ends at 1,126ms. Rounds reports 932.40ms identity, 17.54ms summed database spans and 956.12ms server total. The editor scripts subsequently finish around 1,276ms; useful content arrives at 1,463.2ms. The preceding source also stalls: 8,314ms useful-content time, including identity spans of 4,221.61ms on corkboard, 4,199.79ms on invitations and 3,895.65ms on tutorial. Those spans overlap and must not be added.

The unchanged primary collector locates server identity waiting; it does not distinguish provider execution, connection/dispatch or process scheduling during this row. Host and sleep controls pass, which rules out observed protocol violations but does not establish exclusive access or thermal/frequency stability. The separate instrumented diagnostics observe completed Auth HTTP maxima below 92ms and therefore do not reproduce or explain the primary multi-second stall. This prevents claiming a cold-p95 win or dismissing the row as unrelated. The frozen interpretation rule is unmet despite real median and structural request improvements. No repeat was used to replace this result.

## Separate server diagnostics and tails

Outside primary quantiles: 168 instrumented native GETs,56 direct SDK identity observations,32 feature-browser outcomes and four read-only representative metadata plans. Native request IDs correlate with the existing phase UUIDs and Auth HTTP substages. Direct SDK observations never authorize an application request or replace live-session SQL.

| Applicants / build | Native trace matches | Max completed Auth HTTP ms | Max event-loop delay ms | Metadata plan execution ms | App-role max active / connections / lock waiting |
|---|---:|---:|---:|---:|---:|
| 1,000 / baseline | 42 / 42 | 69.75 | 559.94 | 10.76 | 6 / 9 / 0 |
| 1,000 / candidate | 42 / 42 | 65.65 | 528.74 | 5.56 | 6 / 9 / 0 |
| 5,000 / candidate | 42 / 42 | 57.06 | 498.60 | 23.83 | 4 / 9 / 0 |
| 5,000 / baseline | 42 / 42 | 91.71 | 494.67 | 22.65 | 6 / 9 / 0 |

| Four-reader diagnostic | Identity p50 / p95 ms | Auth create→send | Auth send→headers | Database span | Observable acquisition |
|---|---:|---:|---:|---:|---:|
| 1,000 / baseline | 32.4 / 38.4 | 0.9 / 2.8 | 31.2 / 37.0 | 33.5 / 45.3 | 0.6 / 0.8 |
| 1,000 / candidate | 36.2 / 41.1 | 0.9 / 2.8 | 34.9 / 40.9 | 29.6 / 35.9 | 0.9 / 1.9 |
| 5,000 / candidate | 28.1 / 31.2 | 0.1 / 2.0 | 27.2 / 29.5 | 125.0 / 155.0 | 0.7 / 2.0 |
| 5,000 / baseline | 26.4 / 29.1 | 0.1 / 2.1 | 25.4 / 28.2 | 127.1 / 150.1 | 0.7 / 1.5 |

| Largest measured primary phase | Value ms | Location |
|---|---:|---|
| identity | 4,221.61 | constrained / A / settingsApplication → rounds / cold / source / /api/workspace?kind=corkboard |
| live_session | 107.45 | constrained / A / overview → meetings / warm / source / /api/workspace?kind=corkboard |
| transaction_acquire | 13.56 | constrained / A / settingsApplication → rounds / cold / source / /api/workspace?kind=invitations |
| database | 1,787.71 | constrained / B / recruiting → applicants / cold / source / /api/workspace?kind=overview |
| transaction | 229.40 | constrained / A / applicants → applicantDetail / warm / source / /api/workspace?kind=pipelinePage |
| serialization | 11.59 | local / A / applicants → applicantDetail / cold / source / /api/workspace?kind=taskNotifications |
| total | 4,349.88 | constrained / A / settingsApplication → rounds / cold / source / /api/workspace?kind=invitations |

Database spans sum elapsed query calls, including observable waiting/transport, and may overlap or exceed response wall time. Transaction acquisition includes BEGIN/transport and is not pool-only waiting. Auth create→send includes dispatch/connection/scheduling; send→headers includes provider/transport/scheduling; headers→end is body completion. Process-window CPU overlaps other requests; per-second histogram maxima are not whole-run p95. Aggregate 25ms DB samples may miss brief peaks, and eight is a per-client pool limit. The representative plan is not the complete endpoint and exports no SQL parameter values or rows.

The lifecycle observations follow [Undici diagnostics](https://github.com/nodejs/undici/blob/main/docs/docs/api/DiagnosticsChannel.md). Remotely verified [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser) and live-session SQL remain unchanged. These diagnostics do not explain away prior intermittent identity/database tails or establish hosted/multi-user capacity.

## Errors and adverse observations

local main: 192 outcomes; 0 failed useful-content outcomes, 0 page errors, 0 HTTP errors. Transport snapshots: 17 failed, 192 pending SSE, 0 other pending.

constrained main: 192 outcomes; 0 failed useful-content outcomes, 0 page errors, 0 HTTP errors. Transport snapshots: 1 failed, 192 pending SSE, 190 other pending.

local feature: 128 outcomes; 0 failed useful-content outcomes, 0 page errors, 0 HTTP errors. Transport snapshots: 29 failed, 128 pending SSE, 0 other pending.

constrained feature: 128 outcomes; 0 failed useful-content outcomes, 0 page errors, 0 HTTP errors. Transport snapshots: 12 failed, 128 pending SSE, 9 other pending.

local interactions: 96 outcomes, 0 failed, 0 page errors including preparation, 0 timed HTTP errors and 0 timed failed transports. Other preparation network accounting is unavailable.

constrained interactions: 96 outcomes, 0 failed, 0 page errors including preparation, 0 timed HTTP errors and 0 timed failed transports. Other preparation network accounting is unavailable.

Native primary: 336 reads, 0 failures; all preserve private no-store and Cookie sensitivity. Pending/failed transport snapshots are distinct from failed useful-content outcomes. Exact routes/statuses/failure reasons and unknown-byte counts remain in `TRANSPORT_DETAILS.json`.

Every worsening quantile remains in `REGRESSIONS.json`. Largest useful-content/source/paired-wait regressions of at least 50ms are listed below, including unchanged paths. Small groups do not establish statistical significance or causality.

- feature / constrained / 1000 / settingsApplication → rounds / cold, sourcePlusClickMs p95: 4,980.5 → 9,777.2ms.
- feature / constrained / 1000 / settingsApplication → rounds / cold, sourceUsefulMs p95: 4,369.0 → 8,314.0ms.
- feature / constrained / 1000 / settingsApplication → rounds / cold, clickMs p95: 611.5 → 1,463.2ms.
- primary / constrained / 1000 / applicants → applicantDetail / cold, sourcePlusClickMs p95: 4,999.3 → 5,643.2ms.
- primary / constrained / 1000 / applicants → applicantDetail / cold, sourceUsefulMs p95: 4,736.0 → 5,358.0ms.
- feature / constrained / 1000 / overview → settingsProfile / cold, sourceUsefulMs p50: 3,954.0 → 4,290.0ms.
- feature / constrained / 1000 / overview → settingsProfile / cold, sourcePlusClickMs p50: 4,413.5 → 4,743.7ms.
- feature / constrained / 1000 / overview → meetings / warm, sourceUsefulMs p95: 4,290.0 → 4,546.0ms.
- feature / constrained / 1000 / overview → meetings / warm, sourcePlusClickMs p95: 4,422.2 → 4,666.8ms.
- feature / constrained / 1000 / recruiting → scheduledDecisions / warm, sourcePlusClickMs p50: 4,064.7 → 4,235.7ms.
- feature / constrained / 1000 / recruiting → scheduledDecisions / warm, sourceUsefulMs p50: 3,921.0 → 4,089.0ms.
- primary / constrained / 1000 / recruiting → applicants / warm, clickMs p95: 223.2 → 358.7ms.
- primary / constrained / 1000 / applicants → applicantDetail / cold, clickMs p95: 280.2 → 412.3ms.
- feature / constrained / 1000 / recruiting → scheduledDecisions / warm, sourceUsefulMs p95: 4,344.0 → 4,470.0ms.
- feature / constrained / 1000 / recruiting → scheduledDecisions / warm, sourcePlusClickMs p95: 4,497.7 → 4,614.1ms.
- primary / local / 1000 / recruiting → applicants / warm, sourceUsefulMs p95: 255.0 → 351.0ms.
- primary / local / 1000 / recruiting → applicants / warm, sourcePlusClickMs p95: 328.0 → 418.1ms.
- primary / constrained / 1000 / applicants → applicantDetail / warm, sourceUsefulMs p95: 4,716.0 → 4,803.0ms.
- primary / local / 5000 / applicants → applicantDetail / cold, sourceUsefulMs p50: 232.0 → 317.0ms.
- primary / local / 5000 / applicants → applicantDetail / cold, sourcePlusClickMs p50: 313.7 → 397.6ms.

## Recommendation

Resolve the constrained multi-request identity stalls and Settings first-use variability before another adoption decision. Reuse the preserved transport patch and opt-in regression cases only in a fresh complete paired comparison; do not delete or replace the slow row, pool pilot/diagnostic data, cache successful authorization, or increase pool/concurrency limits. No further optimization is justified by median/request savings alone while the tail remains unresolved.

Keep publication of the complete series on hold until the remaining Settings first-use tradeoff and server-tail risks are resolved. This change does not alter Settings module loading, profile/draft reads, animations or backend queries. Diagnose remaining module/data/render/frame stages without assuming a gap is pure React time. Preserve the Recruiting bundle saving. Capture intermittent identity stalls with request-correlated substages under the affected workload; investigate growing metadata/query/ranking work with parity tests before increasing concurrency or pool size. No successful authorization reuse is justified.

The next phase should prioritize a request-correlated diagnosis of the affected constrained source-and-Review workload before another optimization attempt. Retest the preserved candidate only after that cause is understood, using a fresh complete paired protocol.

All source/build/package manifests, diffs, controls, test history, accepted/pilot/diagnostic observations, timings, privacy scan, chosen-source cleanup and checksums accompany this report. Original checkout changes and unrelated services remain preserved. No live production resources or deployments changed.
