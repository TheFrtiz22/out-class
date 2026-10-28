# OutClass navigation — ChatGPT review handoff

Updated October 28, 2026. Original audit reference: `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Measured main: `78402ee611f46b8764898250e46b6dcc8dab7654`. Experimental bounded-pipeline implementation: `375a00d54d95f24e7d600a56218b9bf8040a7937`, local branch `codex/performance-pipeline-ready-20261027`. This report is on the separate unmerged diagnostic branch `codex/performance-followup-20261027`.

**Decision: preserve the candidate unmerged.** It substantially improves large-list entry but adds requests and waiting to small-club detail/search/voting interactions. Passing security tests does not establish a general performance win. The overall optimization backlog remains open. No candidate PR, merge or deployment was created.

## Already released

- Phase 1 tracing, hidden Scheduling mount/request work and strict navigation-read transport are already in main history. Preserve dirty drafts and necessary live updates.
- Font/missing-artwork subset: [PR85](https://github.com/TheFrtiz22/out-class/pull/85), main `06d3e93`. Initial-entry n=20/build/route: Overview p50/p95/max268.6/300.5/412.9→267.4/308.4/311.0ms, requests61→57; Personal436.2/450.3/451.8→446.9/452.9/456.5ms, requests62→60. Mixed small latency changes do not establish a consistent speedup.
- Fresh selected-workspace code/data overlap and synchronous authority fences: [PR87](https://github.com/TheFrtiz22/out-class/pull/87), main `4c27bbe`. Separate320 measured outcomes/64 warmups, n=10/group; cold p50/p95 improves in all eight local/constrained groups. Warm Members/Applicants incur fresh-validation cost. [Release evidence](followup-20261027/SELECTED_RELEASE.json).
- Centered collapsed sidebar O/C mark: [PR88](https://github.com/TheFrtiz22/out-class/pull/88), main `78402ee`. All12 hosted checks passed; exact main observed Ready/Production October27; protected Overview visually verified. Visible horizontal offset4.614→0.114px. No navigation-speed claim. [Release evidence](followup-20261027/CENTERING_RELEASE.json).

The latest experiment preserves subsequent main QA, selected-startup and centering changes. Historical phases overlap/supersede one another; do not cherry-pick them all. Raw SQL metadata JOIN and rejected Settings preload/handoff remain excluded.

## Five biggest confirmed or suspected bottlenecks

| Priority / confidence | Actual evidence | Source / implication |
|---|---|---|
|1 — confirmed large-list payload/work scaling|At5,000 constrained cold Applicants entry, n=10/build: p50/p95/max19,737.6/20,003.4/20,003.4→437.3/445.4/445.4ms. Warm pipeline body roughly2.99MB→7.27KB. Cold server total p50/p951,070.05/1,385.17→161.11/212.79ms; serialization245.20/273.44→0.77/1.83ms.|Candidate `actions/crm.ts:30/39`, `lib/pipeline-summary.ts:11`, `lib/pipeline-page-read.ts:17`. Bounding hydration/payload/rendering helps; metadata ranking remains O(N). Do not attribute the entire click saving exclusively to one phase.|
|2 — confirmed added small-cohort interaction waits|One applicant, constrained cold detail n=10/build:83.7/102.4/102.4→167.5/649.0/649.0ms; requests3→4, bytes908→2,772. At100, local common workflow n=6/build:1,030.4/1,060.5/1,060.5→1,145.5/1,178.8/1,178.8ms, usually9→11 requests. Voting cold107.9/131.6→141.0/173.8ms,1→2 requests.|`hooks/use-pipeline-applicant.ts:11`, `hooks/use-pipeline-page.ts:19`, `live-leader-workspace.tsx:210`, `board-decision-mode.tsx:25`. New fresh detail/page/selection reads trade initial savings for later waits; general rollout is blocked.|
|3 — confirmed production waiting; cause unresolved|One uncontrolled protected Overview refresh on main78402ee: network5,215.747ms, TTFB5,156.074ms, server5,067.30ms, identity221.36ms. Database aggregate25,290.15ms overlaps queries and is not wall time.|`utils/auth.ts`, `utils/prisma.ts`, `lib/server-phase-trace.ts`, `actions/club-overview.ts`. [Sanitized trace](followup-20261027/PRODUCTION_OVERVIEW_TRACE.json). No production distribution, paired improvement or isolated provider/pool/lock/region cause.|
|4 — confirmed historical Settings first-use cost; current fix unproven|Historical constrained Profile cold459.5/480.3ms versus warm150.3/215.3ms, n=6. Rejected Review handoff improves cold median594.6→465.0 but worsens p95611.5→1,463.2ms.|`components/club-settings-workspace.tsx`, `components/club-workspace.tsx`, `app/layout.tsx`. Historical source differs from main; rejected Phase14 preload/Phase15 handoff stay out.|
|5 — confirmed background fan-out; contribution to tail suspected|Historical constrained source median60 requests, n=6. Separate Phase13 startup pipeline snapshots90→48 and repeated-read preparations42→0 without consistent tail improvement. Later Auth diagnosis did not reproduce4.2s historical stall.|`components/shell/product-shell.tsx`, `contexts/auth-context.tsx`, `lib/workspace-read.ts`. Coalesce only genuinely identical in-flight resources inside complete current authority; preserve real refreshes/subscriptions.|

Additional confirmed baseline UI issue: expanded dock intercepted the first applicant row in mixed menu/pointer probes. Failed probes remain outside accepted timings. Primary collector retains its existing menu/keyboard path; supplementary workflow uses the real Overview CTA and fresh source document in both builds. No forced click, loading-predicate change or synthetic delay was introduced. Useful-content visibility plus two frames does not establish unrestricted pointer interaction.

## Actual latest results and samples

[Full report and all52 tables](pipeline-ready-20261027/README.md), [structured comparisons](pipeline-ready-20261027/COMPARISON.json), [implementation diff](pipeline-ready-20261027/IMPLEMENTATION.diff), [verification diff](pipeline-ready-20261027/VERIFICATION.diff), [QA](pipeline-ready-20261027/QA.json), [final decision/source record](pipeline-ready-20261027/FINAL_VERIFICATION.json).

808 measured browser outcomes plus184 excluded browser warmups; separate168 capacity requests,140 measured/28 warmup. Navigation n=10/build/group; common-workflow/voting n=6/build/group. Browser BAAB order. Nearest rank; these n=6/10 p95 values equal maxima. No statistical significance claim or cross-dataset pooling.

|Path / cohort / profile / condition|n/build|B p50/p95/max ms|A p50/p95/max ms|Median requests B→A|
|---|---:|---:|---:|---:|
|Applicants entry /1 /constrained /cold|10|324.5/359.1/359.1|333.2/469.9/469.9|5→5|
|Applicants entry /1 /constrained /warm|10|137.4/147.9/147.9|124.6/139.5/139.5|1→1|
|Applicant detail /1 /constrained /cold|10|83.7/102.4/102.4|167.5/649.0/649.0|3→4|
|Applicant detail /1 /local /warm|10|31.3/32.2/32.2|81.0/275.0/275.0|3→4|
|Applicants entry /100 /constrained /cold|10|686.1/699.2/699.2|436.4/456.5/456.5|5→5|
|Applicant detail /100 /constrained /warm|10|119.3/133.8/133.8|250.2/260.9/260.9|3→4|
|Applicants entry /1,000 /constrained /cold|10|4,126.9/4,533.7/4,533.7|435.9/443.0/443.0|5→5|
|Applicant detail /1,000 /local /warm|10|182.8/188.8/188.8|97.7/228.0/228.0|3→4|
|Applicants entry /5,000 /constrained /cold|10|19,737.6/20,003.4/20,003.4|437.3/445.4/445.4|5→5|
|Common workflow /100 /local|6|1,030.4/1,060.5/1,060.5|1,145.5/1,178.8/1,178.8|9→11|
|Common workflow /5,000 /constrained|6|30,635.4/31,891.8/31,891.8|1,394.9/1,578.0/1,578.0|11→11|

Desktop Chromium1440×1000; production Next builds; disposable loopback Auth/PostgreSQL. Constrained CDP80ms latency,200,000B/s down,93,750B/s up,CPU4×. Cold/warm means browser destination state with warm services, not hosted cold starts. The one-applicant follow-up used stable battery power; large-cohort profiles stable AC. Cohorts/profiles remain separate. Synthetic histories contain essays/experiences/two submitted reviews, not populated booking/ballot histories. One-applicant actor has three club memberships including two extra seed clubs; no production size-distribution claim.

All five accepted protocols have complete membership, valid source/tool/host controls and zero sleep events. First supplement has33 sleep events/four failed voting outcomes and is excluded whole, including successful rows. Earlier collector probes remain separate. Accepted measured rows:0 failed useful-content outcomes,0 page errors,0 HTTP errors. Aborted requests remain counted: navigation B14/A13, workflow B28/A28; source snapshots contain open streams and B14/A13 other pending reads. Successful content does not mean every background request completed.

Workflow full-byte totals are null when any constituent body size is unknown; constrained5,000 A has0/6 known totals. Known partial sums are separately named. Per-route TTFB/network/server distributions, failed/pending snapshots and byte coverage are in JSON. Source-plus-click sums actual intervals per row before quantiles. Production encoded-body size is unavailable; decoded body1,929B/total transfer1,182B are different measures.

## Database and regional findings

Candidate retains live guards and Repeatable Read. Default metadata/ranking scans the cohort and applies canonical privacy-aware JS search/sort/facets; only selected review/assignment hydration and payload/rendered page are bounded to100. Review/rating/score selectors retain full canonical fallback. Global facets/selection and anonymous/self-review parity are tested. This candidate contains no raw SQL metadata JOIN; that is a separate historical experiment.

Separate local HTTP concurrency1/2/4, five measured waves/build/cohort. At5,000/four readers, p50/p95/max2,523.81/3,351.76/3,415.07→259.73/326.44/347.34ms, n=20 correlated requests/build. Candidate database aggregate p50/p95206.73/268.04ms, observable acquisition0.53/1.82ms.25ms role-level monitoring maxima4 connections/4 active/4 idle-in-transaction/0 lock waiters at different instants. No absence-of-contention/hosted-capacity claim. Capacity B→A order is not counterbalanced. Pool8 remains per client; acquisition includes transport/BEGIN and phases overlap.

Read-only October27 hosted observations: Vercel `iad1`, Fluid Node24/1CPU/2GB; Supabase `us-west-2`, PostgreSQL17.6.1.166, healthy. Exact main78402ee observed Ready/Production after PR88. No paired regional experiment or measured regional saving. [Hosted evidence](followup-20261027/HOSTED_OBSERVATIONS.json). No production config/schema/index/region change or statistics reset. Historical mixed lock-statement statistics do not locate current critical-path waits.

Separate Auth diagnosis:160 browser visits,3,657 Auth HTTP calls/0 failures,1,540 identity traces. HTTP p50/p95/max26.30/58.52/313.84ms; identity30.35/67.04/323.12ms. The old4.2s stall did not reproduce and remains unresolved. No lock/remote-verification removal is justified. [Diagnostic evidence](followup-20261027/DIAGNOSTIC_SUMMARY.json).

## Security and source references

Mandatory: remote getUser verification; live Auth session validity/revocation; account enablement; club membership/capabilities/suspension; support restrictions; anonymous/self-review protections; voting snapshot/post-snapshot authority. Preserve private no-store/Cookie-sensitive same-origin responses, Demo isolation, mutation atomicity, dirty drafts and genuine live updates. No cross-request successful-auth cache or protected reveal before required live validation. A client epoch/cursor is never authorization.

Candidate source: `actions/crm.ts:30/35/39/51` detail/list/page/selection; `lib/pipeline-page-read.ts:17` bounded snapshot hydration; `lib/pipeline-summary.ts:11`/`lib/application-review-visibility.ts` privacy projection; `hooks/use-pipeline-page.ts:19`/`hooks/use-pipeline-applicant.ts:11` authority fences; `components/views/leader-dashboard/live-leader-workspace.tsx:210` selection continuations; `components/live-voting/board-decision-mode.tsx:25` voting handoff. Diff includes full paths. All861 frozen application/config/assets hashes rechecked after measurement. CRM mutation tail is byte-for-byte unchanged from main.

## Top ten recommended changes and implementation sequence

1. Redesign small-cohort compact/full-detail/selection policy before general rollout. Test a bounded compact response or explicit large-cohort strategy; four sizes do not justify an arbitrary threshold or weaker authorization.
2. Identify/remove avoidable detail-open dependencies while retaining required live validation; overlap only genuinely independent work.
3. Coalesce identical in-flight page/search/background reads within complete current authority and fence obsolete distinct queries. Never reuse successful authorization across requests.
4. Reduce O(N) metadata/ranking work only with canonical privacy/collation/facet/cursor/score parity in the same snapshot. No speculative DDL/raw-join adoption.
5. Fix the independently reproduced expanded-dock pointer obstruction and add the real mixed-pointer flow to acceptance coverage.
6. Collect representative protected production clicks, cohort sizes and request-correlated critical paths to distinguish round trips/provider variability/waits. Current n=1 is insufficient for infrastructure priorities.
7. Revisit background shell fan-out with evidence; preserve required Auth refresh and subscriptions.
8. Locate Settings module/data/render first-use dependencies and test a narrower change; keep rejected preload/handoff out pending full paired tail results.
9. Measure mobile/low-end CPU, populated interview/review/booking/voting histories and bounded multiple clients before capacity claims.
10. Rebuild chosen adjustments against latest main, repeat small/large cold/warm/common journeys and full Auth/draft/native/browser QA; require all hosted CI and exact deployment verification before release.

Next implementation phase:1–3 with independent UI fix5; collect6 before infrastructure decisions. Keep each fix and comparison separate. Entry savings must be assessed alongside repeated interaction costs.

## Changes that should NOT be made

No token-only identity, skipped live/session/permission checks, successful-auth caching, stale protected reveal, anonymous/self-review weakening or voting snapshot bypass. No blanket lock removal, weaker transaction isolation, unbounded concurrency/pool increase, Redis/new caching library/Edge Functions, production config/schema/index changes or database region migration. No synthetic waits, forced clicks, earlier cosmetic milestones, deleted slow rows, phase pooling or invented measurements. No deploying disposable observers/credentials/SQL values/response bodies or merging every historical phase because tests pass.

## Verification, missing information and reproduction

Candidate:1,492 ordinary cases,1,435 pass/57 gated skips/0 fail;50 live Auth/settings/runtime,16 existing navigation,16 new pipeline integration,49 native transaction and42 native recruitment/offers/communications passes; baseline38 signup/session/MFA checks. Build/types pass; lint0 errors/21 existing warnings;57 migrations/78 RLS table checks; diagnostic harness/summary10/10. Suites overlap; do not add coverage counts. No hosted candidate CI because it is not release eligible.

Still needed: acceptable small-cohort interaction design/new measured candidate; production cohort distribution/representative critical paths; historical identity-stall cause; mobile/input/populated history behavior; dock pointer fix; reviewed automated additive one-applicant seed for a one-command repeat. Recorded tiny-cohort preparation was manual; its exact private identities are deliberately not distributed.

[Reproduction commands/setup limits](pipeline-ready-20261027/REPRODUCTION.md). Read-only summarizer verifies270 sealed inputs plus protocol/plan/tool hashes, warmup membership and whole sleep exclusion. Owned services/volumes/private credentials/build snapshots removed; original checkout and21 unrelated containers unchanged. [Cleanup](pipeline-ready-20261027/CLEANUP.json). Large traces/results are linked rather than embedded. [Full audit](OUTCLASS_NAVIGATION_AUDIT.md), [roadmap](OPTIMIZATION_ROADMAP.md), [benchmark index](NAVIGATION_BENCHMARKS.json).
