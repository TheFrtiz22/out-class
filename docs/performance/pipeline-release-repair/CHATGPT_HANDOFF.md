# Architectural release handoff

Current recommendation: **ACCEPT**.

Measured main: `0a40de7cbcad158cf60d96c258610b832d818da8`. Held experiment: `375a00d54d95f24e7d600a56218b9bf8040a7937`. Repaired application source: `d0d6f2778239b5d3b921663780a01c7542f04fa3`. The repaired application digest is `df971d7995db833ce7730354b270c88e0d26091758bc7153163cfbeb33860bb7` over 965 files. Final evidence-only commits must preserve this fingerprint; exact final PR checks and the unchanged measured-main identity are verified immediately before merge. GitHub assigns the resulting merge SHA afterward.

The application projects complete canonical scalar/review metadata inside a fresh authorized Repeatable Read, then hydrates canonical full details only for the visible page, at most 100 applications. The page owns those details, so opening and switching applicants require only the existing fresh display/attendance reads. Actual complete unscoped coverage supports local query changes; a newly dispatched guarded operation permanently supersedes previous coverage even after denial or obsolescence. Full identity/authority epoch/support/club/privacy/query/mutation ownership fences every completion. Only identical pending reads share a promise; entries disappear on settlement, and successful server authorization is never cached.

Page and selection share the canonical metadata reader and complete same-snapshot round privacy map. Archived privacy stays internal, controls and gender eligibility remain active-only, and missing privacy fails closed. Voting computes complete candidate IDs inside its existing snapshot and retains all post-snapshot live permission checks and write transactions. The Overview CTA adopts the existing query-only navigator, preserving history and modified links while starting one fresh guarded page GET without the unused RSC dependency. No size threshold, raw SQL join, schema/index change or new cache/state framework is used.

ROOT_CAUSE.md contains baseline/repaired dependency graphs and the operation-by-operation request table. The first revision 2 source's 29.6-second entry completed RSC near 118ms but delayed destination chunks/data until roughly 29.5 seconds. This establishes deferred destination startup, without identifying a browser/router mechanism or proving an Auth transport cause. Its redundant round/selection retrieval and warm-voting failures motivated the current shared metadata contract. That rejected source remains separate.

Every cohort/profile/collector has its own complete B/D/D/B comparison on one fresh Linux VM. Both production builds, served assets/data contracts, collector hashes and continuous host clocks are attested before accepting a unit. Two warmups per block are excluded. Navigation uses n30 per build/path/condition for one applicant and n10 elsewhere; complete review uses n10 per build/cohort/profile. Nearest-rank p95 at n10 equals the maximum. These are controlled CI screening results, with observer/automation costs included, and do not establish hosted latency guarantees. The constrained profile applies 80ms latency, 200000 B/s down, 93750 B/s up and 4x CPU throttling. Native capacity uses a separate pool limit of eight with 1/2/4 readers. Hosts, incomplete units, sources and historical rows are never pooled.

Current collection: 16/16 eligible browser units, 1120 measured outcomes and 320 excluded warmups; capacity 140 measured plus 56 excluded warmups. All required current-source functional jobs pass. BENCHMARKS.json retains exact n/p50/p95/max, source/content/readiness/network/continuous timing, requests, partial/unknown bytes, available overlapping server spans and error/abort/pending counts. CONTROLLED_RESULTS.md contains every directory condition, detail, complete/continuous journey, voting and capacity pair.

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

One-applicant detail retains two guarded reads. The 100-applicant complete journey retains ten guarded reads. Large complete journeys include necessary bounded global-query and complete-selection requests; no expensive work has been moved outside measurement.

All 18 independent functional jobs pass: 1551 ordinary cases comprise 1499 passes, zero failures and 52 gated scenarios each mapped to its own passing integration. Production build/types pass; lint has zero errors and 22 existing warnings. All 61 migrations work on fresh/legacy fixtures and all 79 tables enforce RLS. Native 49 transaction and 42 recruitment/offer cases, security, scheduler, audiences, events, private storage/assets, writing/dashboard, Admin MFA/session, communications and active-room checks pass. Public and authenticated accessibility report 27 and 18 passes. Real Auth/settings 50, selected navigation 16, and pipeline/phase 5 11 pass. Counts overlap across jobs and must not be summed. revision-2/attempt-2/HOSTED_QA.json and GATED_COVERAGE.json give exact job/case receipts. The local parallel PDF/browser run had three failures; the unchanged sequential 22 tests and fresh full CI passed, with both outcomes retained.

The independent dock #92 is already in main. Its unforced hover/diagonal/menu/content-row, keyboard/Escape/focus, rapid switching, reduced-motion and mobile checks pass; no additional dock change is present in #93. Main's subsequent voting changes and #103 contextual loading feedback are retained. See DOCK_INTERACTION_REPORT.md.

Global metadata/ranking and explicit complete selection remain O(N). The initial full-detail projection and rendered directory stay bounded to 100 applications; no deferred whole-pipeline hydration is hidden outside measurement. Constrained 100-applicant warm voting is close to its fixed tolerance, despite passing. Raw route/prefetch cancellations remain separately reported; unknown total byte sizes stay null, and received chunks from canceled responses are partial observations. Server-Timing spans overlap. Separate timing distributions for every filter, paging, history and revocation operation are unavailable; those paths have functional coverage. The historical production identity stall remains unattributed: no new correlated production browser/server trace, pure pool/lock attribution or Auth transport subdivision is available. No production deployment, configuration, schema, index, region or pool change is part of this work.

The held experiment is historical context only: its accepted comparison contains 808 browser outcomes plus 140 capacity requests, excluding 184 browser and 28 capacity warmups. The first sleep-invalid supplement, including successes, stays excluded. Revision 1 (application `4d52103e`, evidence `b2d8883d`) failed the frozen one-applicant constrained cold-directory p50 limit by 0.77ms and had an incomplete constrained 5000 unit. Its reports are preserved byte-for-byte under `revision-1/`; original raw files remain in their original directories. Revision 2 attempt 1 (`511fd305`, application digest `0ce8317a…`) completed all eight small units but failed four voting/journey gates. Its complete 720 measured outcomes, 160 warmups, source proof and rejection remain under `revision-2/attempt-1/`. No old success, tail or failed attempt is paired with current source.

Hosted sources/checks:

- [PR #93](https://github.com/TheFrtiz22/out-class/pull/93)
- [Already merged #103](https://github.com/TheFrtiz22/out-class/pull/103)
- [Independent dock #92](https://github.com/TheFrtiz22/out-class/pull/92)
- [Production validation](https://github.com/TheFrtiz22/out-class/actions/runs/41120761640)
- [Disposable integrations](https://github.com/TheFrtiz22/out-class/actions/runs/41120761637)
- [Gated workflows](https://github.com/TheFrtiz22/out-class/actions/runs/41120776403)
- [Small controlled comparisons](https://github.com/TheFrtiz22/out-class/actions/runs/41120776662)
- [Large comparisons and capacity](https://github.com/TheFrtiz22/out-class/actions/runs/41126174308)

Next: seal the complete current evidence and verify exact final-head checks and unchanged measured main before the already authorized squash merge. Verify the resulting main tree. Then measure O(N) metadata/ranking separately and obtain correlated sanitized production telemetry if separately authorized.

Exact application files changed from measured main (26):

- `actions/crm.ts`
- `actions/voting.ts`
- `app/api/workspace/route.ts`
- `components/live-voting/board-decision-mode.tsx`
- `components/recruiting-overview.tsx`
- `components/selected-club-workspace.tsx`
- `components/views/leader-dashboard/live-applicant-views.tsx`
- `components/views/leader-dashboard/live-leader-workspace.tsx`
- `hooks/use-pipeline-applicant.ts`
- `hooks/use-pipeline-page.ts`
- `lib/anonymous-review.ts`
- `lib/applicant-pagination.ts`
- `lib/application-review-visibility.ts`
- `lib/demo/voting.ts`
- `lib/in-flight-workspace-read.ts`
- `lib/interview-review-summary.ts`
- `lib/live-applicant-sorting.ts`
- `lib/pipeline-detail.ts`
- `lib/pipeline-list.ts`
- `lib/pipeline-page-read.ts`
- `lib/pipeline-page.ts`
- `lib/pipeline-selection-read.ts`
- `lib/pipeline-summary.ts`
- `lib/recruitment-profile.ts`
- `lib/voting-candidate-selection.ts`
- `lib/workspace-api.ts`

SOURCE_PROOF.json hashes all 965 application files and verifies byte-identical CRM/voting write tails and voting post-snapshot live checks, with no schema/migration/deployment/dock diff. CHANGED_FILES.json lists the broader source/test/harness/report changes. The evidence seal records the final full retained-evidence digest, excluding only itself; GitHub final-head/merge details belong in the PR and final execution receipt rather than a self-referential commit SHA.
