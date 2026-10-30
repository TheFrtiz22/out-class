# OutClass release-candidate repair handoff

**Current recommendation: PARTIALLY ACCEPT. Dock accepted independently;
pipeline remains a draft hold pending the constrained comparison and explicit regression-coverage limits. Local and capacity performance gates pass.**

## Exact source and review

- Current comparison/integration main: `6e793dea0bd45052fa444749b26d432ae93392cd`.
- Earlier integration bases: `29100f9cef68ffcba7a250200aa5b5ceb7727cb8` and `f2192e02e5e218537f4dda8a4333aecab1602993`.
- Historical measured main B: `78402ee611f46b8764898250e46b6dcc8dab7654`.
- Held C, never merged: `375a00d54d95f24e7d600a56218b9bf8040a7937`.
- Original audit: `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`.
- Current repaired code/tool candidate D: `4d52103e0ca70086c8ff4f3e913a7bd11f377005`.
- D application digest: `99077a7ff37acb0b67cb919c4ec4b1b95bc0401750472cc65f26b3aaeb029be1`.
- [Pipeline draft PR #93](https://github.com/TheFrtiz22/out-class/pull/93).
- [Separate dock PR #92](https://github.com/TheFrtiz22/out-class/pull/92), final isolated `855bd592d32f06359fdf325804640a9cf5ea0173`, incorporated by main as `a0265dcb` externally to this task.

Main's later visual/loading work, live voting rooms, explicit live-room read
budgets, Phase 1, fonts/artwork and selected-workspace startup changes are
preserved. Diagnostic branch `980522d7` was read without merging. Source hashes,
unchanged mutation tails and exact application-file list are in SOURCE_PROOF.json.
Documentary commits after the tested candidate may change reports/trigger policy;
the application digest identifies the implementation being reviewed.

## Confirmed dependencies and implementation

B's list reads all full applications. C bounds summaries to 100, then opening a
detail adds a guarded `pipeline(applicationId)` GET before mounting the three
original display/attendance/cycle reads. That accounts for the historical one-
applicant 3→4 requests. Metadata is inside the page transaction; ordinary detail
does not require complete selection. C's 100-applicant search/detail additions
usually change the older common-workflow window from nine to eleven requests.
C's voting wrapper serially fetches complete selection before mounting the board,
which then starts its separate authorized snapshot read (one→two requests).

D hydrates canonical full fields only for the existing visible page, at most
100 applications, in the same fresh Repeatable Read as global scalar ranking
metadata. The current page owns one copy of those details. Opening/switching on
that page mounts the original independent authorized panels without another
pipeline detail request. Page boundaries fetch once and hand off to the same
owner. Single-applicant dashboard previews retain a fresh explicit read.

`coverage.complete` proves that the actual response contains the whole base
set; it is not a benchmark-selected applicant threshold. Only the exact current
owner can derive canonical search/filter/sort/selection locally. A new guarded
read permanently supersedes old complete coverage even if it fails or becomes
obsolete. Account/effective actor, Auth epoch, membership/privacy, club, support,
Demo, query and mutation fences remain. Identical simultaneous reads share only
pending promises within that owner; entries disappear on success or failure.
No authorization decision is cached across server requests.

Voting-history setup's minimal IDs/round/status/eligibility are included in the
existing read-only snapshot. Existing snapshot member comparison and post-
snapshot fresh permission/participant checks remain. Session writes, ballots,
locks, isolation, publication and histories are unchanged. Persistent live rooms
introduced by main retain their separate guards and commands.

Global metadata/facets remain complete, including ordinary round filters.
Canonical anonymous/self-review/score rules and deterministic relation ordering
preserve parity. O(N) metadata/ranking and explicit selection remain a measurable
follow-up; no raw SQL join, speculative indexes, schema change, Settings preload,
new cache framework or production geography/pool experiment was introduced.

The tradeoff is larger initial page bytes than C's minimal summaries. Real long
essays, bookings and histories may change the result; request reduction alone
is not release acceptance. IMPLEMENTATION.md lists each application change.

## Before/after evidence

Historical values below are accepted B/C context from a separate environment,
not a paired measurement of D against current main. Times are p50/p95 ms.

| Cohort | Historical benchmark | B → held C | Accepted current-main → D |
|---|---|---|---|
| 1 | Constrained cold detail | 83.7/102.4 → 167.5/649.0; requests 3→4 | Pending |
| 100 | Earlier local common workflow | 1030.4/1060.5 → 1145.5/1178.8; usually 9→11 requests | Pending; new stricter extended workflow is separately identified |
| 1,000 | Constrained cold directory | 4126.9/4533.7 → 435.9/443.0 | Pending |
| 5,000 | Constrained cold directory | 19737.6/20003.4 → 437.3/445.4 | Pending |

Historical 100-applicant cold voting p50 rose 107.9→141.0ms. D's request graph
removes that serial selection dependency. Accepted local 100-applicant Voting history is 283.3/341.3 → 291.0/314.9 ms cold and 280.5/322.4 → 284.9/314.9 ms warm; both pass. BENCHMARKS.json retains all 52 historical comparisons, original error/
byte metrics and raw references, separately from new attempts.

Every Mac timing attempt is excluded as a whole (sleep/power/source interruption
or screening only), including successes. The older workflow incorrectly
required 100 baseline rows at large cohorts; all its rows are excluded. CI run
40905121217 also served candidate endpoints in baseline slots, so all primary,
workflow and capacity results are excluded. CI run 40918015976 stopped before
timing because the expected baseline build manifest returned 404. Raw files and
protocols are retained. None is a product-performance failure or a success claim.

The new run freezes both completed production outputs, restores each into one
owned runtime checkout, verifies the full output digest, verifies served document build ID and required runtime JavaScript bytes and the authenticated expected data contract, then runs the same
BAAB samples/warmups. Both builds have passed a separate preflight before sampling;
every later block is attested again. Source files never change during timing.
The one-applicant fixture is prepared automatically from the existing verified
local seed. Four sizes, five actor memberships, 61 active members/club, two rounds,
three answers and two submitted evaluations are represented. Shared profiles are
enriched by multiple passes; their actual experience distribution is recorded.
Measured clubs lack booking/ballot history; native tests cover those invariants.

The accepted local current-main/D comparisons are in [CONTROLLED_RESULTS.md](CONTROLLED_RESULTS.md), with raw distributions in [BENCHMARKS.json](BENCHMARKS.json):

| Applicants | Cold directory B → D, p50/p95 ms | Cold detail B → D, p50/p95 ms | Strict complete review B → D, p50/p95 ms |
|---:|---|---|---|
| 1 | 208.3/246.8 → 210.1/271.4 | 51.5/62.0 → 53.2/65.0 | 4228.3/4672.2 → 4195.1/4544.8 |
| 100 | 351.7/458.4 → 352.7/437.7 | 127.5/137.8 → 127.9/144.3 | 5174.4/5657.3 → 5204.9/5807.0 |
| 1,000 | 1715.0/1851.6 → 406.6/470.8 | 814.1/854.6 → 131.6/140.1 | 17875.5/18249.6 → 5812.8/5888.8 |
| 5,000 | 8148.3/8547.6 → 624.7/687.3 | 4792.5/4834.6 → 127.1/139.4 | 174456.6/182596.7 → 7414.3/7485.9 |

Primary n/build/path/condition is 30 at one applicant and ten otherwise; strict review n/build/cohort is ten. The strict review includes more operations and readiness checks than the historical workflow, including both voting entries. Its visible-row observer and automation/actionability costs scale with DOM size. In particular, the 5,000-row whole-journey numbers are instrumented durations, not isolated app or production-user improvements. One-applicant detail requests remain four→four total (two→two guarded GETs in this current window), and the 100-applicant whole review remains 19→19 total, ten→ten guarded reads. Do not compare those counts directly with the older historical window.

At 5,000 applicants local directory encoded bytes p50 fall 2,735,369→105,378; at 100 they rise 100,465→104,554. Full-workflow byte totals are null where any response size is unknown; partial sums remain labeled. Four-reader/5,000 capacity p95 is 7,201.6→893.9 ms, pool limit eight, with zero measured errors. This is HTTP read capacity, not a hosted navigation result.

## Tests, UX and operational status

Current-main hosted verification reports 1,535 ordinary cases:
1,483 pass, 52 environment-gated skips, zero failures. Build/types pass; lint has
zero errors and 22 warnings. All 60 migrations apply to fresh/legacy fixtures;
all 79 tables enforce RLS and deny browser-role CRUD. Real Auth/settings/runtime
50, selected navigation 16, pipeline/phase-5 11, native transactions 49, native
recruitment/offers 42, native security eight, public accessibility 27 and
authenticated accessibility 18 pass. Do not sum overlapping suites as independent
coverage. A Storage startup failure was retained and its retry passed.

All twelve latest-main hosted verification jobs pass for candidate 4d52103e.
The CI-only 330ada23 commit also passes both standard workflows and the two additional real dashboard/writing jobs, with identical application source.
The attested comparison is run 40974037305. Local collection completed with 560 measured browser outcomes, 160 excluded warmups, no functional/HTTP/page failures, and every local gate passing. Capacity completed with 140 measured requests and 56 excluded warmups, all successful and all six p95 gates passing. The constrained job reached its 180-minute limit; its entire partial attempt is retained and excluded. The predeclared repeat assigns each complete paired cohort to its own VM and gives both builds the same 180-second observer wait, retaining original content predicates, samples and release thresholds. See FULL_REVIEW_PLAN.md. A focused local 24-case owner/coalescing/voting-board
batch and three frozen-output/process provenance tests also pass. SECURITY_AND_FUNCTIONAL_QA.md and machine-readable QA
manifests identify exact sources, commands, counters and log references.

The separate dock fix reproduces real expanded-rail interception of a content
click at x=240. Navigation collapses and clears ownership; departing wide-area
entry cannot reopen it, while deliberate compact-column entry can. Rightward
pointer movement renews flyout hover intent during slow diagonal travel. Existing
animations/accessibility remain. Both isolated browser tests and both hosted
workflows passed, covering unforced hover/menu/content clicks, rapid return,
keyboard/arrows/Escape/focus, reduced motion and mobile touch. See the separate
report; the pipeline diff adds no dock change against current main.

Production access initially returned 403 and later succeeded. Aggregate-only
queries found no matching sanitized workspace phase traces in 24h or pipeline
failure events in 1h. No fresh correlated production browser/server measurement
was obtained. The historical 4.2-second identity stall remains unattributed.
Main's production voting walkthrough documents separate work by others; it is
not this task's performance evidence. This task performed no production write,
configuration change, deployment or merge.

Owned Mac Next/Supabase services are stopped and private fixture credentials
removed. All 29 unrelated containers present at cleanup were preserved. Other
user checkout changes were observed and retained. See CLEANUP.json. Worktrees,
raw results and failed local logs remain available for review; no historical
invalid supplement was restored.

## Decision and next step

Accept the dock independently. Keep PR93 draft until the original frozen
performance gates pass on valid current-main/D comparisons. If a gate fails,
reject that pipeline implementation for release and preserve independently
successful work. Do not claim production readiness from local/CI measurements.
Complete the constrained run and assess its frozen gates without moving thresholds. Local one-applicant tails, 100-applicant whole journey/cold and warm voting, and concurrency 1/2/4 already pass. The independently measured local 5,000 directory gain is 92.3% p50 and 92.0% p95; the required constrained gain remains pending. Update RELEASE_DECISION.md from the sealed raw evidence.

Ordinary manager session/history polls now omit selection metadata. Initial
entry still includes it to avoid a serial setup request, and open setup polls
refresh it. Explicit reopening hides prior eligibility until that exact fresh
operation settles. The workflow/trigger remains mounted for focus restoration.
No eligibility or authorization cache replaces those guards. Initial large
history entry and populated booking/ballot-history performance remain unmeasured.

The existing real Auth dashboard and application-writing journeys additionally
pass in separate jobs (ADDITIONAL_QA.json). They run on CI-only source 330ada23
with the identical 99077a7f application digest. Of 52 ordinary gated skips, 41
are covered by separate passing integrations; 11 specific scenarios remain
unrun and are enumerated in GATED_COVERAGE.json. No production-ready blanket
claim follows from the passing jobs.

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
