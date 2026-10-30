# Controlled comparison: release gates not cleared

Exact measured main: `6e793dea0bd45052fa444749b26d432ae93392cd`. Measured application: `4d52103e0ca70086c8ff4f3e913a7bd11f377005`, digest `99077a7ff37acb0b67cb919c4ec4b1b95bc0401750472cc65f26b3aaeb029be1`. Constrained repeat tools: `3d4f4128579b2ed0e9f63ad344e56d5c48302da9`; application bytes are identical. Times below are p50/p95 milliseconds, nearest rank. Each cohort/profile/build pair uses one isolated GitHub Linux VM, loopback real Auth/PostgreSQL, production builds and full served-output/data-contract attestation. Different hosts/profiles/cohorts are never pooled. This is not production timing.

Main subsequently advanced to `bc22b0a30b98cbfab785ea3da5215a9351b76109` (#101 live-room transitions/guarded undo). Those changes were inspected, not timed by this study. No current-main or production clearance follows from older-source results.

## Primary cold entry and detail

| Profile | Applicants | Directory B → D (ms) | Detail B → D (ms) | n/build/path | Directory bytes p50 B → D |
|---|---:|---|---|---:|---:|
| local | 1 | 208.3/246.8 → 210.1/271.4 | 51.5/62.0 → 53.2/65.0 | 30 | 33513 → 36559 |
| local | 100 | 351.7/458.4 → 352.7/437.7 | 127.5/137.8 → 127.9/144.3 | 10 | 100465 → 104554 |
| local | 1,000 | 1715.0/1851.6 → 406.6/470.8 | 814.1/854.6 → 131.6/140.1 | 10 | 588487 → 104418 |
| local | 5,000 | 8148.3/8547.6 → 624.7/687.3 | 4792.5/4834.6 → 127.1/139.4 | 10 | 2735369 → 105378 |
| constrained | 1 | 552.3/612.9 → 608.3/669.3 | 225.6/259.9 → 243.7/272.6 | 30 | 33516 → 36552 |
| constrained | 100 | 1293.7/1381.3 → 1299.6/1329.8 | 566.1/614.0 → 576.5/602.2 | 10 | 103746 → 106518 |
| constrained | 1,000 | 8133.5/8571.9 → 1317.4/1383.3 | 3376.4/3504.6 → 560.9/590.0 | 10 | 589811 → 104050 |
| constrained | 5,000 | Whole incomplete cohort excluded | Unavailable | — | — |

One-applicant cold directory constrained p50 is 552.3→608.3 ms (+10.14%); the predeclared limit is 607.53 ms. It fails by 0.77 ms. The p95 limit passes. This is a screening-rule failure, not a claim of statistical significance. No tolerance is changed or result discarded. One-applicant detail passes both profiles and adds no pipeline detail GET: four→four total observed cold-window requests, two→two guarded workspace GETs. The historical three→four B/C count used an older source/window.

## Recorded strict complete-review journey

Includes source preparation, visible independent review/attendance readiness, switching, search/clear, complete quick-review selection, cold/warm Voting history, full Applied pool, setup discard and return. It is longer than the historical common workflow. These are instrumented journey durations: observer/actionability/automation costs scale with DOM size.

**Observer limitation:** OBSERVER_QA.json independently reproduces missed text-only readiness in the measured collector; unrelated later DOM changes can end an observation delay. The corrected observer is implemented for future comparisons. Past rows do not record exact DOM mutation times, so this does not prove the cause of a particular tail. Every recorded value, failed gate and slow row remains unchanged. These timings cannot establish isolated application/Auth stalls or production p95; strict-review release clearance remains false. No corrected performance rerun is launched for this independently failed candidate.

| Profile | Applicants | Recorded whole journey B → D (ms) | Source-through-content B → D (ms) | n/build | Requests p50/max B → D |
|---|---:|---|---|---:|---|
| local | 1 | 4228.3/4672.2 → 4195.1/4544.8 | 5455.3/5885.0 → 5414.1/5731.6 | 10 | 16/16 → 16/16 |
| local | 100 | 5174.4/5657.3 → 5204.9/5807.0 | 6393.7/6827.8 → 6390.5/7041.0 | 10 | 19/19 → 19/19 |
| local | 1,000 | 17875.5/18249.6 → 5812.8/5888.8 | 19223.3/19691.3 → 7012.6/7114.8 | 10 | 19/19 → 22/22 |
| local | 5,000 | 174456.6/182596.7 → 7414.3/7485.9 | 175840.7/185072.6 → 8614.2/8715.9 | 10 | 44/47 → 22/22 |
| constrained | 1 | 5456.2/5812.3 → 5451.5/33549.9 | 7032.8/7515.3 → 6943.1/35235.6 | 10 | 16/16 → 16/19 |
| constrained | 100 | 10881.1/11272.9 → 11339.5/37587.0 | 12518.4/12951.7 → 12985.4/39251.3 | 10 | 19/19 → 19/21 |
| constrained | 1,000 | 73999.3/76684.3 → 12619.3/12953.8 | 75963.4/78632.4 → 14369.0/14633.2 | 10 | 29/29 → 22/23 |
| constrained | 5,000 | Whole incomplete cohort excluded | Unavailable | — | — |

Constrained one-applicant recorded p95 is 5.81→33.55 seconds, with 28.41 seconds in detail readiness. At 100 it is 11.27→37.59 seconds, with 26.57 seconds in switch readiness. Relevant guarded responses were short; the data do not establish an Auth or database cause. One background notification GET overlaps each long observation. At 100 the recorded guarded-count maximum is 10→11, so the automated count gate fails; this is not an added pipeline detail/selection read. Median whole-workflow guarded count remains ten→ten.

| Profile | 100-applicant Voting history | B p50/p95 (ms) | D p50/p95 (ms) |
|---|---|---:|---:|
| local | votingCold | 283.3/341.3 | 291.0/314.9 |
| local | votingWarm | 280.5/322.4 | 284.9/314.9 |
| constrained | votingCold | 767.9/836.9 | 782.7/842.2 |
| constrained | votingWarm | 723.6/806.2 | 753.6/868.8 |

All four recorded 100-applicant voting numeric limits pass, n10/build. Initial setup IDs remain in the existing transactional voting snapshot. Closed-setup polling omits selection; explicit reopen requires a fresh exact read. Persistent live rooms are functionally checked separately, not timed. The strict collector limitation remains explicit.

## Bounded reader capacity

| Applicants | Readers | B p50/p95 (ms) | D p50/p95 (ms) | n/build |
|---:|---:|---:|---:|---:|
| 1,000 | 1 | 518.3/544.4 | 170.8/216.8 | 5 |
| 1,000 | 2 | 724.4/762.6 | 211.1/262.7 | 10 |
| 1,000 | 4 | 1320.4/1367.9 | 351.6/364.3 | 20 |
| 5,000 | 1 | 2382.8/2407.4 | 385.9/399.2 | 5 |
| 5,000 | 2 | 3680.4/3774.8 | 482.5/524.0 | 10 |
| 5,000 | 4 | 6873.8/7201.6 | 869.9/893.9 | 20 |

All 140 measured capacity requests succeed; 56 warmups are excluded. All six p95 gates pass. Pool eight applies to the application pool. Correlated bursts are labeled. Monitor maxima: five application connections, four active, four idle in transaction, zero waiting on locks, excluding the monitor. These are HTTP durations, not whole-navigation capacity or production guarantees.

## Sampling, errors and exclusions

Local completed: 560 measured browser outcomes plus 160 excluded warmups. Completed constrained cohorts 1/100/1,000: 460 measured outcomes plus 120 warmups, each cohort on its own VM. All included outcomes have zero useful-content, HTTP and page failures. One-applicant primary n30/build/path/condition; others n10. Strict n10/build/cohort. n10 p95 is the maximum, not a production-tail guarantee.

| Profile/collector/build | Outcomes | requestfailed events | Pending at capture | Unknown body sizes |
|---|---:|---:|---:|---:|
| local/navigation/B | 240 | 82 | 3 | 6 |
| local/navigation/D | 240 | 92 | 0 | 0 |
| local/full-review/B | 40 | 64 | 0 | 74 |
| local/full-review/D | 40 | 84 | 0 | 84 |
| constrained/navigation/B | 200 | 0 | 0 | 0 |
| constrained/navigation/D | 200 | 2 | 0 | 0 |
| constrained/full-review/B | 30 | 23 | 0 | 33 |
| constrained/full-review/D | 30 | 21 | 0 | 21 |

requestfailed events may include abandoned prefetch/navigation; workflow transport causes are not individually classified. Native abort/pending classifications are unavailable separately. Complete byte totals and network completion are null when unobserved; known partial sums/missing counts remain separate. Server spans can overlap and must not be added.

The first constrained all-cohort attempt hit its 180-minute overall limit. The separate 5,000 repeat hit its 315-minute collection-step limit in final main full-review; first main full-review also had observer failures. **Both whole incomplete units are excluded, including all primary and repaired successes.** No numeric 5,000 constrained comparison or 90% gate is claimed. ZIP hashes and unmodified raw files are retained. No further performance run is launched for this candidate.

All historical B/C context, Mac screening/sleep/power/source interruptions, first CI source mismatch, preflight failures and superseded preparation/partial-source attempts remain separately preserved. The historical first sleep-invalid supplement stays wholly excluded. No old successful row is restored.

The frozen numeric gate tally is 26 PASS, 6 FAIL, 2 MISSING. These are mechanical recorded-data outcomes; observer clearance is additionally false. Recommendation: accept dock independently; reject this pipeline candidate for release.

Fixtures have three answers/two submitted evaluations per application, two rounds and 61 active members, with repeated shared-profile enrichment. Booking/ballot history and large real essays are absent. Canonical full detail is bounded to 100; global metadata/ranking and explicit selection remain O(N). Production latency, pool/region experiments and the historic 4.2-second identity stall remain unmeasured/unattributed.
