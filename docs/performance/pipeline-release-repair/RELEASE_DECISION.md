# Release decision

Recommendation: **ACCEPT** for the repaired application in [PR #93](https://github.com/TheFrtiz22/out-class/pull/93).

Measured main: `0a40de7cbcad158cf60d96c258610b832d818da8`. Held experiment: `375a00d54d95f24e7d600a56218b9bf8040a7937`. Repaired application source: `d0d6f2778239b5d3b921663780a01c7542f04fa3`. The repaired application digest is `df971d7995db833ce7730354b270c88e0d26091758bc7153163cfbeb33860bb7` over 965 files. Final evidence-only commits must preserve this fingerprint; exact final PR checks and the unchanged measured-main identity are verified immediately before merge. GitHub assigns the resulting merge SHA afterward.

All 34 frozen numerical/request gates pass, all 16 browser comparison units and the native capacity unit are complete and attested, and all 18 independent functional CI jobs pass. The large-cohort gain is preserved without exceeding the predeclared one-applicant or 100-applicant tolerances. No acceptance threshold was changed after results.

Current evidence includes 1120 measured browser outcomes, 320 excluded browser warmups, 140 measured capacity requests and 56 excluded capacity warmups. All included current useful-content, HTTP/page and native capacity outcomes succeed. Canceled route/prefetch traffic is retained separately.

Milliseconds below are p50 / p95; each row uses its own paired unit.

| Profile | Applicants | Cold directory main ms | Repair ms | Main complete review ms | Repair ms |
|---|---:|---:|---:|---:|---:|
| local | 1 | 182.9 / 218.0 | 188.3 / 210.8 | 4017.6 / 4094.1 | 3943.9 / 4380.6 |
| local | 100 | 325.3 / 402.8 | 339.4 / 382.4 | 5239.2 / 5640.7 | 5162.3 / 5615.0 |
| local | 1000 | 1645.5 / 1759.0 | 396.2 / 475.9 | 14322.1 / 14488.7 | 4894.8 / 5075.9 |
| local | 5000 | 6484.5 / 6610.2 | 461.9 / 504.5 | 182765.5 / 190411.8 | 7327.5 / 7761.9 |
| constrained | 1 | 457.7 / 504.1 | 492.3 / 524.1 | 4915.6 / 33955.3 | 4847.1 / 5035.5 |
| constrained | 100 | 1222.3 / 1346.3 | 1242.4 / 1417.3 | 10749.5 / 11308.9 | 10666.0 / 11104.7 |
| constrained | 1000 | 5724.7 / 6185.5 | 946.7 / 978.8 | 71362.3 / 72349.3 | 12260.6 / 12657.6 |
| constrained | 5000 | 41276.7 / 41750.4 | 1641.1 / 1755.7 | 467066.4 / 531595.2 | 12286.3 / 12918.8 |

| Profile | Detail | Main ms | Repair ms | Guarded reads main / repair |
|---|---|---:|---:|---:|
| local | cold | 51.9 / 56.9 | 54.3 / 58.5 | 2 / 2 |
| local | warm | 37.4 / 65.6 | 38.1 / 43.9 | 2 / 2 |
| constrained | cold | 174.2 / 198.4 | 186.1 / 218.4 | 2 / 2 |
| constrained | warm | 128.6 / 155.2 | 140.3 / 157.6 | 2 / 2 |

| Profile | Voting entry | Main ms | Repair ms |
|---|---|---:|---:|
| local | votingCold | 294.7 / 343.6 | 298.8 / 344.3 |
| local | votingWarm | 276.3 / 355.2 | 289.3 / 303.7 |
| constrained | votingCold | 714.8 / 779.8 | 727.3 / 779.3 |
| constrained | votingWarm | 701.3 / 746.6 | 733.0 / 817.3 |

At 100 applicants the complete workflow retains ten guarded requests per sample in both profiles. At 1000/5000 the bounded workflow normally needs three additional fresh reads for global search/reset and complete selection; their latency and bytes remain inside the measured journey. Very slow baseline journeys can trigger additional background polls; raw counts are retained. At 5000/four native readers, p95 changes from 4646.3ms to 487.0ms with zero errors. Every other capacity gate also passes.

Every cohort/profile/collector has its own complete B/D/D/B comparison on one fresh Linux VM. Both production builds, served assets/data contracts, collector hashes and continuous host clocks are attested before accepting a unit. Two warmups per block are excluded. Navigation uses n30 per build/path/condition for one applicant and n10 elsewhere; complete review uses n10 per build/cohort/profile. Nearest-rank p95 at n10 equals the maximum. These are controlled CI screening results, with observer/automation costs included, and do not establish hosted latency guarantees. The constrained profile applies 80ms latency, 200000 B/s down, 93750 B/s up and 4x CPU throttling. Native capacity uses a separate pool limit of eight with 1/2/4 readers. Hosts, incomplete units, sources and historical rows are never pooled.

Functional verification includes 1499 ordinary passes, zero failures, 52 separately covered gated scenarios, production build/types/lint, 61 fresh/legacy migrations, 79 RLS tables, real Auth/MFA/session revocation, canonical privacy/count/order/selection, voting snapshots/live authority, native concurrency and real desktop/touch/history/drafts/accessibility flows. Dock #92 and feedback #103 are already part of measured main. The failed local parallel PDF/browser run is retained; all 22 cases in those files passed unchanged sequentially and the fresh entire CI suite passed.

Global metadata/ranking and explicit complete selection remain O(N). The initial full-detail projection and rendered directory stay bounded to 100 applications; no deferred whole-pipeline hydration is hidden outside measurement. Constrained 100-applicant warm voting is close to its fixed tolerance, despite passing. Raw route/prefetch cancellations remain separately reported; unknown total byte sizes stay null, and received chunks from canceled responses are partial observations. Server-Timing spans overlap. Separate timing distributions for every filter, paging, history and revocation operation are unavailable; those paths have functional coverage. The historical production identity stall remains unattributed: no new correlated production browser/server trace, pure pool/lock attribution or Auth transport subdivision is available. No production deployment, configuration, schema, index, region or pool change is part of this work.

The held experiment is historical context only: its accepted comparison contains 808 browser outcomes plus 140 capacity requests, excluding 184 browser and 28 capacity warmups. The first sleep-invalid supplement, including successes, stays excluded. Revision 1 (application `4d52103e`, evidence `b2d8883d`) failed the frozen one-applicant constrained cold-directory p50 limit by 0.77ms and had an incomplete constrained 5000 unit. Its reports are preserved byte-for-byte under `revision-1/`; original raw files remain in their original directories. Revision 2 attempt 1 (`511fd305`, application digest `0ce8317a…`) completed all eight small units but failed four voting/journey gates. Its complete 720 measured outcomes, 160 warmups, source proof and rejection remain under `revision-2/attempt-1/`. No old success, tail or failed attempt is paired with current source.

The user explicitly authorizes merging the verified repair. Before merge, seal all retained evidence, confirm the same application digest, require final PR-head checks to pass and confirm main still equals the measured baseline. Merge with the exact expected head SHA, then verify the resulting main tree equals the verified feature tree. No manual production deployment follows. A measured metadata/ranking follow-up and separately authorized correlated production tracing are the next engineering work.
