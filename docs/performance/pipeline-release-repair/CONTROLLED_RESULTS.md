# Controlled current-source results

Application source: `d0d6f2778239b5d3b921663780a01c7542f04fa3`. Measured main: `0a40de7cbcad158cf60d96c258610b832d818da8`.
Application digest: `df971d7995db833ce7730354b270c88e0d26091758bc7153163cfbeb33860bb7`. Each table row is its own paired unit; hosts and historical sources are not pooled.

Current release clearance: **PASS**. Quantiles are nearest rank; milliseconds below are p50 / p95. n10 p95 is its maximum, not a hosted SLO.

Browser measured outcomes: 1120; excluded browser warmups: 320.

## Directory entry

| Profile | Applicants | Condition | n per build | Main ms | Repair ms |
|---|---:|---|---:|---:|---:|
| local | 1 | cold | 30 | 182.9 / 218.0 | 188.3 / 210.8 |
| local | 1 | warm | 30 | 126.9 / 147.9 | 129.6 / 168.9 |
| local | 100 | cold | 10 | 325.3 / 402.8 | 339.4 / 382.4 |
| local | 100 | warm | 10 | 259.6 / 288.4 | 265.3 / 306.3 |
| local | 1000 | cold | 10 | 1645.5 / 1759.0 | 396.2 / 475.9 |
| local | 1000 | warm | 10 | 1564.2 / 1707.9 | 312.0 / 358.6 |
| local | 5000 | cold | 10 | 6484.5 / 6610.2 | 461.9 / 504.5 |
| local | 5000 | warm | 10 | 6134.1 / 6337.2 | 415.8 / 444.8 |
| constrained | 1 | cold | 30 | 457.7 / 504.1 | 492.3 / 524.1 |
| constrained | 1 | warm | 30 | 204.3 / 238.7 | 214.4 / 236.5 |
| constrained | 100 | cold | 10 | 1222.3 / 1346.3 | 1242.4 / 1417.3 |
| constrained | 100 | warm | 10 | 1037.4 / 1083.8 | 1051.8 / 1121.6 |
| constrained | 1000 | cold | 10 | 5724.7 / 6185.5 | 946.7 / 978.8 |
| constrained | 1000 | warm | 10 | 5629.1 / 5768.8 | 784.0 / 860.3 |
| constrained | 5000 | cold | 10 | 41276.7 / 41750.4 | 1641.1 / 1755.7 |
| constrained | 5000 | warm | 10 | 41016.7 / 41627.9 | 1407.1 / 1541.3 |

## One-applicant detail

| Profile | Condition | n per build | Main ms | Repair ms | Guarded requests main / repair (median) |
|---|---|---:|---:|---:|---:|
| local | cold | 30 | 51.9 / 56.9 | 54.3 / 58.5 | 2 / 2 |
| local | warm | 30 | 37.4 / 65.6 | 38.1 / 43.9 | 2 / 2 |
| constrained | cold | 30 | 174.2 / 198.4 | 186.1 / 218.4 | 2 / 2 |
| constrained | warm | 30 | 128.6 / 155.2 | 140.3 / 157.6 | 2 / 2 |

## Complete review, search, selection and voting journey

| Profile | Applicants | n per build | Main journey ms | Repair journey ms | Main continuous source-through-content ms | Repair continuous ms | Guarded requests main / repair (median) |
|---|---:|---:|---:|---:|---:|---:|---:|
| local | 1 | 10 | 4017.6 / 4094.1 | 3943.9 / 4380.6 | 5095.9 / 5245.6 | 5081.9 / 5549.8 | 8 / 8 |
| local | 100 | 10 | 5239.2 / 5640.7 | 5162.3 / 5615.0 | 6456.8 / 6892.9 | 6398.4 / 6817.6 | 10 / 10 |
| local | 1000 | 10 | 14322.1 / 14488.7 | 4894.8 / 5075.9 | 15487.1 / 15635.4 | 6007.7 / 6192.9 | 10 / 13 |
| local | 5000 | 10 | 182765.5 / 190411.8 | 7327.5 / 7761.9 | 185221.3 / 192494.3 | 8581.1 / 8963.0 | 28 / 13 |
| constrained | 1 | 10 | 4915.6 / 33955.3 | 4847.1 / 5035.5 | 6332.5 / 35448.6 | 6405.4 / 6552.5 | 8 / 8 |
| constrained | 100 | 10 | 10749.5 / 11308.9 | 10666.0 / 11104.7 | 12397.9 / 12941.9 | 12274.6 / 12744.5 | 10 / 10 |
| constrained | 1000 | 10 | 71362.3 / 72349.3 | 12260.6 / 12657.6 | 73448.0 / 74267.3 | 13879.7 / 14336.0 | 17 / 13 |
| constrained | 5000 | 10 | 467066.4 / 531595.2 | 12286.3 / 12918.8 | 477773.6 / 535540.0 | 13594.6 / 14240.3 | 48 / 13 |

## 100-applicant voting entry

| Profile | Path | Main ms | Repair ms |
|---|---|---:|---:|
| local | votingCold | 294.7 / 343.6 | 298.8 / 344.3 |
| local | votingWarm | 276.3 / 355.2 | 289.3 / 303.7 |
| constrained | votingCold | 714.8 / 779.8 | 727.3 / 779.3 |
| constrained | votingWarm | 701.3 / 746.6 | 733.0 / 817.3 |

## Native bounded reader capacity

| Applicants | Readers | n per build | Main ms | Repair ms |
|---:|---:|---:|---:|---:|
| 1000 | 1 | 5 | 290.0 / 328.2 | 102.0 / 104.4 |
| 1000 | 2 | 10 | 442.2 / 484.3 | 127.0 / 175.8 |
| 1000 | 4 | 20 | 859.6 / 867.8 | 190.5 / 230.6 |
| 5000 | 1 | 5 | 1435.1 / 1477.3 | 201.2 / 210.6 |
| 5000 | 2 | 10 | 2357.4 / 2390.6 | 251.3 / 298.2 |
| 5000 | 4 | 20 | 4454.7 / 4646.3 | 462.4 / 487.0 |

## Data-transfer and observation limits

The initial directory returns/renders at most 100 canonical full applications. Global metadata and explicit complete selection remain O(N). At 1000/5000 the bounded workflow needs fresh global search/reset and complete-selection reads; their cost remains in the full journey. At 100 applicants the guarded count stays ten.

Route/prefetch cancellations are retained separately from HTTP/page/useful-content failures. Unknown total byte sizes remain null; known partial bytes and missing counts are separate. Do not turn partial byte observations into a total-transfer reduction. Every raw outcome retains its requests and available Server-Timing spans; overlapping spans must not be summed as disjoint phases.

These are instrumented CI/Chromium/CDP comparisons, including actionability and observer overhead. They do not establish production latency or isolate app CPU. Separate latency distributions for every filter/paging/history operation are unavailable; those paths have independent functional coverage.

All prior rejected sources, unsuccessful attempts and whole-unit exclusions remain separate under revision-1/, revision-2/attempt-1/ and their original raw directories. None is pooled here.

## Frozen gates

| Gate | Status |
|---|---|
| one applicant detail local cold | PASS |
| one applicant directory local cold | PASS |
| one applicant detail local warm | PASS |
| one applicant directory local warm | PASS |
| one applicant complete review local | PASS |
| one applicant continuous journey local | PASS |
| 100 complete review local | PASS |
| 100 continuous source-through-content local | PASS |
| 100 votingCold local | PASS |
| 100 votingWarm local | PASS |
| one applicant guarded detail requests local cold | PASS |
| one applicant guarded detail requests local warm | PASS |
| 100 complete review guarded requests local | PASS |
| one applicant detail constrained cold | PASS |
| one applicant directory constrained cold | PASS |
| one applicant detail constrained warm | PASS |
| one applicant directory constrained warm | PASS |
| one applicant complete review constrained | PASS |
| one applicant continuous journey constrained | PASS |
| 100 complete review constrained | PASS |
| 100 continuous source-through-content constrained | PASS |
| 100 votingCold constrained | PASS |
| 100 votingWarm constrained | PASS |
| one applicant guarded detail requests constrained cold | PASS |
| one applicant guarded detail requests constrained warm | PASS |
| 100 complete review guarded requests constrained | PASS |
| 5000 constrained directory cold | PASS |
| 5000 constrained directory warm | PASS |
| capacity 1000 readers-1 | PASS |
| capacity 1000 readers-2 | PASS |
| capacity 1000 readers-4 | PASS |
| capacity 5000 readers-1 | PASS |
| capacity 5000 readers-2 | PASS |
| capacity 5000 readers-4 | PASS |
