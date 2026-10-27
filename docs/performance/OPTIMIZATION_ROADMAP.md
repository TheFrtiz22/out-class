# OutClass optimization roadmap — review through Phase 15

Updated October 27, 2026; audit reference3017e01d5b55bc8fb38d4f8fbec4906dd93bf619; retained experiment source/evidence dd30454. This is a proposed implementation/release plan, not a statement that all changes are approved or deployed. [Handoff](CHATGPT_HANDOFF.md) contains the five ranked bottlenecks, exact measurements and constraints; [JSON](NAVIGATION_BENCHMARKS.json) contains separate historical and latest groups.

## Selected startup release — now on main

The independently tested selected-workspace patch is merged through [PR #87](https://github.com/TheFrtiz22/out-class/pull/87) as `4c27bbe77c7d783e2b84ad06ddb9b3ead7899c59`, preserving main's PR #86 QA fixes. All12 hosted jobs passed; exact-main Vercel inspection confirms **Ready / Production**. Combined QA:1,390 ordinary passes/44 gated skips,50 Auth/settings/runtime passes,16 navigation passes and3 native security suites; build/types/lint pass (21 existing warnings). The broader experimental series remains unmerged.

The separate selected-startup comparison has320 measured outcomes/64 warmups, n=10/group, against measured base06d3e93. Cold p50/p95 improve for all eight local/constrained groups; warm Members/Applicants add fresh-validation cost, Tasks warm constrained maximum grows155.4→201.5ms, and Tasks cold source+click p95 grows5,028.6→5,299.0ms. No universal latency win, exact new-main timing delta or resolved identity cause is claimed. [Release record](followup-20261027/SELECTED_RELEASE.json) links the immutable public report,32-group benchmark JSON, diff and integrated-main verification. The source references and Phase15 tables below remain scoped to their recorded retained experimental builds, not current production.

Next isolate the plain-Prisma bounded pipeline payload/page work against current main, preserving newer QA/privacy/draft behavior. The raw metadata SQL join and rejected Settings changes remain separate. A fresh production protected request returned the public landing page, so no new authenticated hosted trace was collected; the original tabs were left untouched.

## October 27 release and diagnostic followup

The independently ready subset is on main `06d3e93` through PR #85; read-only dashboard inspection confirms **Ready / Production**. Current placement remains Vercel `iad1` / Supabase `us-west-2`. A separate controlled instrumented followup completed 160 browser visits and 3,657 Auth HTTP calls, with 0 Auth failures/incomplete snapshots. HTTP p50/p95/max is 26.30/58.52/313.84ms; unique workspace identity n=1,540 is 30.35/67.04/323.12ms. The historical 4.2-second identity stall did **not** reproduce and remains unresolved. Provider/gateway stage observations narrow the observed waiting but cannot explain that old row or establish hosted causes. No application fix or before/after improvement is claimed by this diagnosis. See [the full followup](followup-20261027/README.md), [structured results](followup-20261027/DIAGNOSTIC_SUMMARY.json) and [current hosted observations](followup-20261027/HOSTED_OBSERVATIONS.json). Datasets remain separate; rejected Phase 14/15 changes remain out.

## Release boundary

The user authorizes committing independently ready changes to main, then fixing remaining issues. Fetch current remote main and preserve subsequent UI/security changes before integration. The isolated ready subset is now on main at `06d3e93` through PR #85, preserving `d031364` and its newer navigation UI; all 12 hosted PR checks and the exact-main-commit Vercel check passed. Do not merge the accumulated Phase 2–15 branch wholesale. The original checkout is on an independent UI branch and must not be reset or switched.

Phase 1 is already in main history. Later code is local retained work, with some earlier approaches superseded. Phase 14/15 experiments are reverted. A test pass does not turn an unexplained adverse benchmark into a performance win. The font/artwork subset completed that isolated verification and integration. All other candidate changes still require their own evidence and release decision.

## Level1 — immediate diagnostic and independently ready work

| Sequence | Work and evidence | Expected impact | Complexity / risk | Required gate |
|---:|---|---|---|---|
| 1 | Preserve the complete evidence and publish the four review files on a diagnostic branch. | Prevent obsolete findings/incorrect pooling from guiding release. No direct latency claim. | Low / low | Immutable input checksums, actual max/n, summary/harness tests, no protected data. |
| 2 | **DONE on main `06d3e93`:** missing-logo request elimination and unused italic preload removal, independently of list/Settings experiments. | Avoid guessed artwork404s; prior Phase 10 removes200,888 font bytes and improves constrained source p50 by1,242ms in its own cohort. | Low / low | Current-main compatibility, artwork recovery/preview tests, all font faces retained, production build and browser visual/functional checks. Re-measure combined behavior before claiming the historical delta applies to main. |
| 3 | **DONE on main4c27bbe through PR #87:** selected-workspace code/data overlap, fresh reveal and synchronous stale-epoch fences, separately integrated with main QA fixes. | Phase 2 cold medians improved79.5–83.6% in=100-applicant local cohorts; warm Members/Applicants grew34.9/29.8ms because fresh validation gates reveal. | Medium / medium | Preserve main UI; confirm no old protected content, one current read, genuine later Auth refresh, rapid switches, mobile/pointer and draft continuity. Keep tradeoff explicit. |
| 4 | Diagnose the multi-request identity stall in the constrained source→Review workload. | Potentially removes multi-second tails; saving not yet attributable or quantifiable. | Medium / low application risk for local-only instrumentation | Request-correlated Auth lifecycle + event loop/process + database observations in affected burst. No successful-authorization caching. |

Use local disposable fixtures and no persistent power/config changes. Preserve every slow row. Earlier sleep-interrupted attempts remain excluded whole with reasons; they do not become replacement pools for accepted timings.

## Level2 — changes blocked on cause or semantics

| Sequence | Proposed fix | Expected impact / evidence | Complexity / risk | Dependencies and acceptance |
|---:|---|---|---|---|
| 5 | Retry strict query-only Settings→Review handoff after the identity tail is explained. | Candidate requests8→6 cold/4→3 warm; constrained medians594.6→465.0/264.9→162.0ms, n=6. Cold p95 worsens611.5→1,463.2ms. | Low code / medium performance risk | Phase 15 rejected patch remains out until a fresh complete paired comparison has no material unexplained regression; retain modified clicks, fresh GETs, revocation and real draft-save replay tests. |
| 6 | Reduce Settings first-use dependencies while retaining Recruiting code-split benefit. | Retained constrained Profile cold459.5/480.3ms versus warm150.3/215.3ms, n=6. No exclusive React cost established. | Medium / medium | Locate module/read/render/frame stages. Phase 14 speculative preload did not improve cold timing and stays reverted. No eager background private-data fetch. |
| 7 | Bound pipeline metadata/ranking work. | Native database spans grow25.50→107.06ms at median from1,000→5,000, n=10. Page summaries are bounded; rank scan is not. | High / high privacy/correctness | Same Repeatable Read snapshot, canonical anonymous/self-review/score projection, JS collation, stable order, total/facet/cursor/review parity and native SQL fallback tests. No schema/index rollout. |
| 8 | Choose fresh-page versus resident-summary interaction contract, then optimize accordingly. | Phase 7 avoided page/search GETs but grew initial payload; Phase 8 superseded it with fresh pages. No universal winner established. | Medium / high freshness risk | Product-visible freshness and authorization requirements first; measure initial entry and repeated interactions together. No TTL-based authorization reuse. |
| 9 | Coalesce identical current-scope background reads; audit remaining pure-read Server Actions. | Current source still captures about60 requests in Settings cohort. Contribution to identity tail remains suspected. | Medium / medium | Full identity/session/member/club/privacy/support/Demo/query keys; pending-only reuse; mutation invalidation and late-result fencing; no voting snapshot consolidation or live-update suppression. |

## Level3 — scalability and hosted evidence

10. Measure populated member/invitation/task histories, then narrow or page excessive catalogs without changing totals/targeting/authority semantics. Complexity medium; benefit unmeasured.
11. Run bounded multi-client, active scheduling/voting and realistic review-history workloads. Four-reader loopback tests and25ms role snapshots do not establish saturation limits. Complexity medium; avoid unbounded concurrency or pool increases.
12. Refresh production deployment SHA, actual function region and effective Prisma pool configuration read-only. Historical iad1→us-west-2 placement is confirmed only as of October 21. Correlate one hosted click with sanitized phases before diagnosing today's regional cost. A same-region preview is a separate future authorized experiment; current production infrastructure restrictions remain.
13. Validate low-end/mobile CPU, actual paint/input behavior and large-list rendering. Use measured row/CPU costs before proposing virtualization or dependency replacement.

## Top ten changes for architectural review

The ten ranked proposals, impact, complexity and gates are the corresponding table in [CHATGPT_HANDOFF.md](CHATGPT_HANDOFF.md#top-ten-recommended-changes-ordered-implementation-sequence). Roadmap steps above expand execution/release dependencies; they are not ten more changes to apply automatically.

## Security contract and prohibited changes

Keep remotely verified identity, live Auth session/revocation/not_after, enabled account, current membership/capabilities/suspension, support restrictions, anonymous interview/self-review protections and voting snapshot/post-snapshot authority. Preserve private no-store/Cookie-sensitive transport, Demo isolation, current-scope settlement, draft continuity, mutation atomicity and required live updates. Client epochs never authorize reads.

No authorization-success caching between requests, stale private-content flash, blanket lock removal, isolation weakening, new cache library/Redis/Edge Functions, production schema/index changes, region migration, synthetic delay/readiness tricks or automatic deployment of the experimental branch. Never sum overlapping span durations or imply that a local median predicts hosted p95.

## Verification sequence before each ready-subset commit

1. Start from freshly fetched current main in a separate worktree; record base SHA and exact intended patch. Preserve original UI branch and all subsequent main changes.
2. Include only the reviewed independent app change and required focused regression tests. Inspect server/Auth/database diff explicitly.
3. Run affected unit/browser tests, type checking, lint and a production build. For transport/authority/query changes, run the selected real Auth/session/anonymous/support/voting/draft/rapid-switch suites plus dedicated native security/concurrency; rebuild disposable fixtures instead of using production data.
4. Collect before/after cold/warm data with identical fixture, final code, frozen tools, fixed sample membership and host/sleep controls when making a performance claim. Include source/preparation, counts, body bytes, errors, tails and interactions; do not run builds/tests concurrently with accepted collection.
5. Review all adverse outcomes against the declared acceptance rule. Revert failed experiments and retain their evidence.
6. Commit the passing ready subset as authorized. Record actual main integration/check status. Keep unresolved experiments separate; do not claim a deployment without deployment evidence.
7. Tackle identity stalls first, then Settings and pagination tradeoffs, and repeat the final integrated verification before declaring the full series complete.

## Reproduction and evidence

Read [CHATGPT_HANDOFF.md](CHATGPT_HANDOFF.md#tests-evidence-and-commands) and `phase15/REPRODUCTION.md` for the document-only verification commands and full disposable benchmark procedure. Current document-update results are in `review-20261027/VALIDATION.json`. Phase 15 full QA, immutable source/build manifests, failed attempts, controls, privacy and scoped cleanup remain under `phase15/`. No new latency measurements or production changes are introduced by this roadmap.
