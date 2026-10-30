# OutClass release-candidate repair handoff

Final gated outcome: 51 of the 52 ordinary gated scenarios have their own
separate passing evidence; none remains unrun. This includes actual club-assets,
active-room authority/revocation, recipient audiences, invitation/communication
scheduling, publication, private decision letters and Admin workspace. The one
original Admin-session route test still fails its legacy literal /Admin
workspace/ expectation, while returned HTML contains the authorized Admin
product shell and current heading. No assertion is weakened and this test is
not counted as passing. Initial fixture/MFA/event prerequisite failures and the
successful unchanged-source port-startup retry remain in GATED_SUPPLEMENT_QA.json.
The gated supplement workflow therefore retains a failed conclusion for that
one scenario. Pipeline release remains rejected independently by performance.


**PARTIALLY ACCEPT: dock accepted independently; reject pipeline application
4d52103e for release. Keep PR #93 draft. No production-ready claim.**

## Exact sources and review status

- Current remote main at final inspection: `bc22b0a30b98cbfab785ea3da5215a9351b76109`.
- Exact measured/integration main: `6e793dea0bd45052fa444749b26d432ae93392cd`.
- Earlier integration bases: `29100f9cef68ffcba7a250200aa5b5ceb7727cb8`, `f2192e02e5e218537f4dda8a4333aecab1602993`.
- Historical measured B: `78402ee611f46b8764898250e46b6dcc8dab7654`.
- Held C, never merged: `375a00d54d95f24e7d600a56218b9bf8040a7937`.
- Original audit: `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`.
- Measured repaired application D: `4d52103e0ca70086c8ff4f3e913a7bd11f377005`.
- Application digest: `99077a7ff37acb0b67cb919c4ec4b1b95bc0401750472cc65f26b3aaeb029be1`; all 963 application source files remain identical in later evidence/tool commits.
- Constrained repeat collection tools: `3d4f4128579b2ed0e9f63ad344e56d5c48302da9`.
- [Pipeline draft PR #93](https://github.com/TheFrtiz22/out-class/pull/93).
- [Dock PR #92](https://github.com/TheFrtiz22/out-class/pull/92), isolated final `855bd592d32f06359fdf325804640a9cf5ea0173`; merged externally as `a0265dcb`.

Main's Phase 1, fonts/artwork, selected-workspace startup, centering, dock,
contextual loading, live rooms and read budgets through 6e793dea are preserved.
Main later advanced with #101 live-room transitions/guarded undo, 19 files and
an upstream migration. Those were inspected and do not overlap the 25 repair
application files. This held branch and its measurements do not claim a timed
or fully verified integration onto bc22b0a3. A future revision must preserve that
work and use then-current main. No repaired candidate was merged into main or
deployed. Diagnostic 980522d7 was read without merging; the October 28 decision
remains the authoritative historical interpretation.

## Confirmed dependencies and implementation

B loads every complete application. C bounds the page to 100 summaries, then
adds `pipeline(applicationId)` before mounting the original independent display,
attendance and recruitment-cycle resources. That is the historical detail
three→four request regression; it is not a metadata→selection→detail chain.
C also makes a search request despite a complete small dataset. Voting C waits
for complete pipeline selection before mounting its separately authorized board.

D's single guarded Repeatable Read ranks the whole cohort using canonical scalar
metadata, then hydrates full canonical fields for at most the existing visible
100 records. The current page owns one copy. On-page detail/switch uses that
projection and mounts the original independent authorized panels without an
extra pipeline detail GET. Page boundaries fetch once and hand off to the same
owner. Dashboard single-applicant previews retain fresh explicit reads.

`coverage.complete` proves the actual unscoped response contains the full base
set; it is not an applicant-count rollout threshold. Only its exact current
account/effective-actor/Auth-epoch/club/campus/membership/privacy/support/Demo/
query/mutation owner may derive canonical search/filter/sort/selection locally.
Starting any fresh guarded read supersedes old coverage even if denied or
obsolete; clearing a filter cannot resurrect it. Existing stale-result fences
remain. A WeakMap shares only identical pending kind/full-argument reads within
that owner, deleting success and failure entries. Server authorization is never
cached across requests; every new private request retains fresh authority.

Voting setup IDs/round/status/eligibility belong to its existing read-only
Repeatable Read snapshot, with unchanged member comparison and live post-
snapshot permission/participant checks. Initial entry includes selection;
closed-setup polls omit it; open setup polls refresh it. Explicit reopen hides
old eligibility until that exact fresh read settles, keeping the trigger/dialog
mounted for focus restoration. Writes, locks, isolation, histories and live-room
commands are unchanged by this repair.

Full global counts, facets, privacy-aware search/ranking, deterministic cursors,
anonymous/self-review/score rules and nested relation ordering are preserved.
Plain round filters retain global facet metadata. Metadata/ranking and explicit
complete selection remain O(N); no raw SQL join, speculative index/schema change,
Settings preload, new cache framework or production pool/region change is added.
The tradeoff is larger initial detail payloads than C's summaries. The synthetic
fixture lacks large real essays and booking/ballot history.

## Primary current-main/D comparisons

p50/p95 milliseconds, nearest rank. Each cohort/profile's B/D pair uses one VM,
complete BAAB blocks, exact served-build/asset/data-contract checks and final
source/tool/wall-versus-monotonic audits. No cross-host or historical pooling.

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


One-applicant cold detail adds no pipeline GET: four→four total observed requests,
two→two guarded GETs in the current window. Its numeric latency limits pass on
both profiles. Constrained cold directory p50 fails: 552.3→608.3 ms versus a
607.53 ms limit (+10.14%, exceeding the limit by 0.77 ms). P95 passes. This
borderline screening result is retained, not called statistically significant
or waived. Warm one-applicant primary limits pass.

Local 5,000 cold entry falls 92.3%/92.0% p50/p95; encoded bytes p50 are
2,735,369→105,378. At 100 bytes rise 100,465→104,554. The required 5,000
constrained whole cohort did not complete within the 315-minute collection step;
its primary and repaired successes are all excluded. No numeric constrained
5,000 gain or 90% clearance is claimed. The earlier 180-minute all-cohort
constrained attempt is likewise wholly excluded.

## Complete journey, voting and capacity

| Profile / applicants | Recorded strict journey B → D p50/p95 ms | Status |
|---|---|---|
| Local / 1 | 4228.3/4672.2 → 4195.1/4544.8 | Recorded numeric limits pass |
| Constrained / 1 | 5456.2/5812.3 → 5451.5/33549.9 | Recorded p95 fails |
| Local / 100 | 5174.4/5657.3 → 5204.9/5807.0 | Recorded numeric limits pass |
| Constrained / 100 | 10881.1/11272.9 → 11339.5/37587.0 | Recorded p95 fails |
| Local / 1,000 | 17875.5/18249.6 → 5812.8/5888.8 | Instrumented scaling context |
| Constrained / 1,000 | 73999.3/76684.3 → 12619.3/12953.8 | Instrumented scaling context |
| Local / 5,000 | 174456.6/182596.7 → 7414.3/7485.9 | Observer/actionability overhead scales with DOM size |
| Constrained / 5,000 | Unavailable | Whole incomplete cohort excluded |

These n10/build journeys include complete review/attendance readiness, switch,
search/clear, complete selection, cold/warm Voting history, full Applied pool,
setup discard and return. They are longer than the historical common workflow.
**They are instrumented durations, not isolated application or production-user
timing.** A real Chromium reproduction in OBSERVER_QA.json proves the measured
observer could miss text-only readiness until an unrelated DOM change. The
future observer is corrected. Past DOM mutation times are absent, so this does
not establish the cause of a particular 26–28 second detail/switch observation.
No elapsed time is subtracted, row removed, or failed gate changed to PASS.
Strict-review observer release clearance remains false. No more performance
runs are launched for this independently failed application candidate.

The 100 local journey has 19→19 total requests, ten→ten guarded reads. The
constrained median remains 19→19/ten→ten, but maximum guarded count is ten→11
because a background notification overlaps the long observation; the automated
count gate fails. It is not a repeated pipeline detail/selection fetch. At
1,000+ the bounded repair intentionally needs fresh search, clear-search and
complete scalar selection reads because it does not possess the entire cohort.

Recorded 100-applicant Voting history cold local is 283.3/341.3→291.0/314.9 ms;
warm 280.5/322.4→284.9/314.9. Constrained cold is
767.9/836.9→782.7/842.2; warm 723.6/806.2→753.6/868.8. All four numeric limits
pass, with the strict collector limitation retained. New persistent live rooms
are checked functionally rather than timed.

All six native HTTP capacity groups pass at 1,000/5,000 and concurrency 1/2/4,
pool eight: 140 successful measured requests, 56 excluded warmups. Four-reader
5,000 p50/p95 is 6873.8/7201.6→869.9/893.9 ms. Monitor maxima are five application
connections, four active, four idle in transaction, zero lock waits, excluding
its own backend. Correlated bursts are labeled; these are not hosted-navigation
or production capacity guarantees.

Local browser totals: 560 measured/160 warmups. Completed constrained 1/100/1,000:
460/120; all included outcomes have zero useful-content/HTTP/page failures.
ABORT/pending/unknown byte counts are explicit in CONTROLLED_RESULTS.md and all
raw distributions/spans/source preparation/network milestones remain in
BENCHMARKS.json. Unknown totals stay null, partial byte sums stay labeled,
spans may overlap, and n10 p95 is the maximum, not a production-tail guarantee.

## Historical context and unsuccessful attempts

Historical B/C is a separate environment: one-applicant constrained cold detail
83.7/102.4→167.5/649.0 ms, requests three→four; 100 earlier local common workflow
1030.4/1060.5→1145.5/1178.8, usually nine→eleven requests; 1,000 constrained entry
4126.9/4533.7→435.9/443.0; 5,000 19737.6/20003.4→437.3/445.4.
Historical cold voting p50 107.9→141.0 ms. None is paired with D. All 52 accepted
historical groups and their source/hash references remain separate.

Every Mac attempt remains excluded for screening/sleep/power/source interruption.
The first CI run served the repair in baseline slots and is wholly excluded.
Other attempts failed unused Pages-manifest preflights; the corrected check uses
App Router document build ID, required runtime JS hash and authenticated data
contract. Frozen production outputs restore into one owned runtime path, verified
by full file digest. Superseded preparations and partial source attempts remain
retained. The old workflow's incorrect baseline row count is not a product
regression. The historical first sleep-invalid supplement is never restored.

## Security, functional, UX and operational verification

All twelve hosted application-source jobs passed. Ordinary: 1,535 cases,
1,483 pass/52 gated skips/zero failures; production build/types pass; lint zero
errors/22 warnings. All 60 measured-main migrations apply to fresh/legacy
fixtures, and 79 tables have RLS/browser-role CRUD denial. No repair migration
exists. Native transactions 49, recruitment/offers 42, security eight, real
Auth/settings/runtime 50, selected navigation 16, pipeline/phase5 11, public
accessibility 27 and authenticated accessibility 18 pass. Do not add overlapping
suite counts. Dashboard/writing real journeys pass too. Source 3d4f4128's two
standard workflows also pass. Exact jobs/counters are in hosted QA manifests.

Real guards deny lost permissions, disabled accounts and revoked sessions;
voting also denies suspension. Existing CRM policy permitting authorized
read-only suspended-club history remains. Client tests fence old owners,
revisions/queries, failures, denied coverage, Auth notifications and page handoff.
Canonical details/counts/facets/ranking/selection are checked at all four sizes.
Writes, row/advisory locks, privacy, no-store/Cookie handling and post-snapshot
checks remain, with unchanged tails hashed in SOURCE_PROOF.json.

An evidence-only native scheduler backend-termination recovery assertion failed
once and passed on unchanged retry; both are retained in EVIDENCE_COMMIT_QA.json.
The gated supplement has passed real active-room authority/revocation,
communications, Corkboard and decision communications. Initial dependent
Admin/asset failures were fixture prerequisites, retained with corrected
sequencing outcomes retained below. GATED_COVERAGE.json and GATED_SUPPLEMENT_QA.json are the
authoritative per-scenario results; do not call an unrun/failed scenario a pass.

Dock PR92 independently fixes expanded-rail interception at x=240 by clearing
ownership/collapsing on navigation and allowing deliberate compact reentry.
Rightward diagonal travel renews hover intent. Real unforced pointer/menu/content
clicks, rapid switching, keyboard/arrows/Escape/focus, touch/mobile and reduced
motion pass, with animations/accessibility retained. Both hosted workflows pass.
Main incorporated it externally; the pipeline diff adds no dock patch.

Production aggregate reads initially returned 403, later succeeded with no
matching sanitized phase/failure events. No correlated browser/server trace
explains the historic 4.2-second identity stall. Do not blame Auth/geography.
No production records, deployment, configuration/region/pool change or candidate
merge into main occurred. Synthetic timed clubs have three answers/two submitted
evaluations, two rounds and 61 active members; shared profiles are repeatedly
enriched. Large essays and booking/ballot history are unrepresented.

Owned Mac services were stopped and private fixture credentials removed; all
29 unrelated containers were preserved. Later reuse of the temporary root and
an unavailable Docker daemon were observed and left alone. CI owns fresh VMs;
the cancelled job's owned-process cleanup failure and artifact success are
recorded, and platform teardown is not confused with a verified local cleanup.
No user checkout, unrelated worktree/service or historical evidence was removed.

## Final decision and next step

Accept the dock independently. Reject pipeline application 4d52103e for release;
keep its contract/coalescing/privacy work reviewable in draft PR93. Numeric tally:
26 PASS, six FAIL, two MISSING; strict observer clearance is additionally false.
The independent entry p50 failure alone prevents acceptance. No tolerance is
changed and no retry is used to hunt for a passing performance distribution.
A distinct follow-up must preserve bc22/current-main work, address small-entry
cost, use the corrected observer, and complete the constrained large-cohort
protocol before any new release claim. Production telemetry remains a separate
read-only evidence gap. RELEASE_DECISION.md is the final recommendation.

## Exact application file list

```text
actions/crm.ts
actions/voting.ts
app/api/workspace/route.ts
components/live-voting/board-decision-mode.tsx
components/selected-club-workspace.tsx
components/views/leader-dashboard/live-applicant-views.tsx
components/views/leader-dashboard/live-leader-workspace.tsx
hooks/use-pipeline-applicant.ts
hooks/use-pipeline-page.ts
lib/anonymous-review.ts
lib/applicant-pagination.ts
lib/application-review-visibility.ts
lib/demo/voting.ts
lib/in-flight-workspace-read.ts
lib/interview-review-summary.ts
lib/live-applicant-sorting.ts
lib/pipeline-detail.ts
lib/pipeline-list.ts
lib/pipeline-page-read.ts
lib/pipeline-page.ts
lib/pipeline-selection-read.ts
lib/pipeline-summary.ts
lib/recruitment-profile.ts
lib/voting-candidate-selection.ts
lib/workspace-api.ts
```

The complete changed-file/evidence manifest is CHANGED_FILES.json. Runtime and
fixture credentials are excluded. EVIDENCE_SEAL.json seals the final artifact
contents after collection; the application digest binds the tested source.


Evidence-commit follow-up: source 4085b134 changes only reports/analysis and retains
the measured application digest. Its audience job 123852886157 reached an
existing scheduler native backend-termination recovery assertion failure
(expected failed=1, actual=0 after a P1017 failure-marker event), followed by
five more subtest failures. This is a real failed verification, not a gated skip
or a startup-only failure. No scheduler code/test changes exist against current
main; that does not establish the cause or clear the failure. The identical
source passed previous full runs. The unchanged-source retry (job 123855873757) passed every original assertion, including actual backend termination and recovery. Failure and retry details are retained in EVIDENCE_COMMIT_QA.json. This records intermittent recovery-test instability; it does not establish a cause or erase the initial failed verification. Keep that issue visible alongside the gated omissions in release review.
