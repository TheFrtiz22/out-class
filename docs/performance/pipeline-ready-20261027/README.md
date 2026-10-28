# Bounded pipeline follow-up — October 28, 2026

**Decision: preserve this candidate unmerged.** General rollout is not cleared. Large-cohort entry, rendering and bounded HTTP bursts improve, but small-cohort detail/search/voting add requests and waiting. Main remains `78402ee611f46b8764898250e46b6dcc8dab7654`; its selected-startup improvements and centered sidebar are already released. The original October 21 audit reference remains `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`.

Implementation commit: `375a00d54d95f24e7d600a56218b9bf8040a7937`, based on that exact main. [Implementation diff](IMPLEMENTATION.diff) covers 19 application files; [verification diff](VERIFICATION.diff) covers the integration runner and regression tests. The implementation branch is `codex/performance-pipeline-ready-20261027`. No candidate PR, merge or deployment was requested. Documentation is maintained separately on `codex/performance-followup-20261027`, also unmerged. Earlier releases are not rolled back.

## What changed and why

The selected Applicants workspace reads an allowlisted, freshly authorized `pipelinePage` resource instead of hydrating every applicant's full profile, essays, bookings and reviews. The default page contains at most 100 summaries. Details load on opening; filtering/page changes and complete quick-review/voting selections have explicit guarded reads. The default metadata scan/ranking is still O(N); review/rating/score selectors retain the complete canonical fallback. This is plain Prisma, with no raw metadata SQL join.

The port preserves subsequent main QA, selected-startup, synchronous authority epoch fences and centering changes. Dispatch, settlement, render, imperative selection continuations and adjacent-page handoff check the current authority. The complete CRM mutation tail is byte-for-byte unchanged. See [FINAL_VERIFICATION.json](FINAL_VERIFICATION.json) and the 861-file frozen candidate manifest.

## Evidence and method

[COMPARISON.json](COMPARISON.json) is the structured result: 52 separate build comparisons, including p50/p95/maximum/sample count, source preparation and actual per-row source-plus-click totals, requests, payload coverage, per-route network/Server-Timing distributions and error counts. Raw sanitized rows remain in the referenced directories rather than being embedded in the four top-level reports.

- 640 measured navigation outcomes: 100/1,000/5,000 cohorts plus a separate one-applicant follow-up, local and constrained; 128 excluded navigation warmups. Each path/condition/build group has n=10.
- 72 measured common workflows and 24 excluded warmups; n=6/build/cohort/profile. Actual Overview CTA → detail → close → distant search, warm browser context, freshly prepared Overview document each time. Total includes separately reported automation/close gaps; no human think-time claim.
- 96 measured local voting outcomes and 32 excluded warmups; n=6/build/path/condition/cohort. Read-only voting open/close at 100 and 5,000; no ballot/decision mutation or active-session capacity claim.
- Separate local capacity diagnostic: 140 measured requests plus 28 warmups, five measured waves each at concurrency 1/2/4, n=5/10/20 per build/cohort. Bursts share load and are correlated. Maximum HTTP concurrency 4, configured pool limit 8 per client; no pool increase.

Thus 808 measured browser outcomes plus 184 browser warmups = 992 browser outcomes, and 168 separate capacity requests. No pooling across cohorts, profiles, paths, conditions, historical phases or production. BAAB order throughout browser comparisons. Nearest-rank percentiles; n=10 and n=6 p95 equals maximum. These are small diagnostic samples, without a statistical significance claim.

Production Next builds: B `CEAI23ftOJ8ZVtWlKMONI`, A `EzkQj4yhyR7aSWuTDg8Zk`. Desktop Chromium 1440×1000, local disposable Supabase Auth/PostgreSQL and loopback app. Constrained CDP: 80ms latency, 200,000 bytes/s down, 93,750 bytes/s up, CPU4×. Cold/warm means browser destination state with warm local services, not hosted function cold starts. Main profiles used stable AC power; the separate one-applicant profiles used stable battery power, low-power mode0. Compare builds within each profile, never power/cohort runs as equivalent samples.

All five accepted protocols have complete membership, valid host/source/tool controls and zero actual Sleep/DarkWake/Wake events. The first supplement had 33 sleep events and four failed voting outcomes: **its entire attempt, including all successful voting/capacity rows, is excluded**. It remains under `supplement/`; `supplement-attempt-2/` is a separately recorded complete valid attempt. No slow-row removal or replacement within an accepted attempt.

The one-applicant fixture is additive: one application, two rounds and61 members, separate verified synthetic actor and three actor memberships including two ordinary seed clubs. Existing submitted-review deletion protections rejected an initial preparation transaction; it rolled back. No trigger or security protection was disabled. See [SMALL_FIXTURE_MANIFEST.json](SMALL_FIXTURE_MANIFEST.json). Other cohorts have three synthetic essays, enriched biography/experiences and two submitted reviews per application, but no populated booking history. These are synthetic examples, not the production club-size distribution.

## Confirmed benefits and costs

Constrained 5,000-applicant cold entry p50/p95 improves 19,737.6/20,003.4 → 437.3/445.4ms (n=10/build). The pipeline body falls from roughly2.99MB to7.27KB on warm entry. Its cold request Server-Timing total p50/p95 falls1,070.05/1,385.17 →161.11/212.79ms; serialization245.20/273.44 →0.77/1.83ms. The request network duration falls16,270/16,576 →251/304ms, TTFB1,073.51/1,395.62 →176.55/228.22ms. Initial entry still uses one guarded pipeline read: most warm-window counts remain1→1, cold5→5. Large reductions are payload/work savings, not universal request elimination.

At one applicant, constrained cold entry is324.5/359.1 →333.2/469.9ms. Cold detail is83.7/102.4 →167.5/649.0ms; warm detail41.8/155.7 →154.3/171.7ms. Detail-window requests rise3→4 and encoded bytes908→2,772. The cold detail candidate's guarded GET has identity p95=383.76ms and total p95=461.97ms; these marginal distributions overlap and do not prove an exclusive root cause for its649ms click tail. Local warm detail is31.3/32.2 →81.0/275.0ms. The new read's median cost persists beyond that outlier.

At100 applicants, local full-workflow p50/p95 worsens1,030.4/1,060.5 →1,145.5/1,178.8ms (n=6/build), usually9→11 window requests. Constrained100 improves1,461.4/1,494.1 →1,328.2/1,427.2ms, but detail and search separately worsen. Local voting-open cold107.9/131.6 →141.0/173.8ms, requests1→2, bytes511→3,149. At5,000, voting open improves despite the complete-selection request; candidate bytes127,622 versus baseline511 in that click window because baseline paid its full applicant payload earlier. Do not compare that window as total journey payload.

At1,000 local warm detail p95 worsens188.8→228.0ms despite median improvement182.8→97.7ms. All adverse groups, including entry/source timings, remain in JSON and the full tables below. This experiment failed the general-release performance gate; it does not demonstrate a universal speedup.

## Database and bounded concurrency findings

Default ranking scans scalar metadata for all eligible applicants, applies canonical privacy-aware JS search/sort/facets, and hydrates reviews/assignments for selected IDs in the same Repeatable Read snapshot. Review/score-dependent selectors deliberately use full metadata. No production query plans, schema/index changes, region migration or configuration changes were introduced.

At5,000, concurrency4 real-HTTP p50/p95/max improves2,523.81/3,351.76/3,415.07 →259.73/326.44/347.34ms (n=20/build). Candidate database aggregate p50/p95=206.73/268.04ms, transaction acquisition0.53/1.82ms; baseline1,298.18/1,963.66 and0.81/3.34ms. Across four local monitors: at most4 same-role connections,4 active,4 idle-in-transaction and0 sampled lock waiters. Those maxima are at different instants. A25ms sampler can miss short waits; aggregate connections are not individual client pool counts or hosted capacity. Acquisition includes transport/BEGIN; lock-bearing query spans are not isolated lock waits. Nested/parallel database phases cannot be added to obtain response wall time.

## Errors, missing measurements and UI limitation

Accepted measured rows have0 failed useful-content outcomes,0 page errors and0 HTTP errors, including capacity requests. Navigation click windows retain14 aborted requests in B and13 in A; supplementary workflows retain28 in each. They are failed navigation/background request snapshots despite successful useful content, and are counted explicitly. Source snapshots contain open event streams and14/13 other pending requests respectively; no claim of a fully drained source network. All raw error metadata remains sanitized.

Some workflow body sizes are unavailable after navigation/abortion. Full workflow bytes are null whenever a constituent size is unknown; notably constrained5,000 A has0/6 complete byte totals. Known partial sums are separately labeled, never presented as full totals. The primary collector sums known window bodies and separately reports unknown snapshots; prefer the specific pipeline response for payload comparisons. Production encoded-body bytes also remain unavailable in the separate October27 trace. React render duration, true input latency, mobile behavior and hosted cold starts were not measured.

Initial mixed menu/pointer collector probes reproduced expanded sidebar interception over the first row in the baseline; moving the pointer alone did not resolve it. No forced click, product loading predicate or delay was added. Those probes are retained outside accepted timings. The supplementary workflow uses the actual Overview CTA and fresh source document in both builds; the primary menu/keyboard collector is unchanged. This remains an unresolved baseline pointer-usability issue, and visible-content timing does not establish unrestricted pointer interaction.

## Source and security review

References are to candidate implementation `375a00d`, not deployed main or the historical Phase15 application:

- `actions/crm.ts:30` complete detail; `:35` summary list; `:39` bounded page; `:51` complete selection; shared live authority and Repeatable Read guard.
- `app/api/workspace/route.ts:60`, `lib/workspace-api.ts`: explicit strict GET allowlist, normal same-origin transport, existing private no-store/Cookie/Demo handling. Writes remain Server Actions.
- `lib/pipeline-page-read.ts:17`, `lib/pipeline-summary.ts:11`, `lib/application-review-visibility.ts`: canonical privacy/score projection and bounded selected hydration.
- `hooks/use-pipeline-page.ts:19`, `hooks/use-pipeline-applicant.ts:11`: fresh reads, current-owner dispatch/settlement/render fences, single-use adjacent-page handoff.
- `components/views/leader-dashboard/live-leader-workspace.tsx:210`: full selection checks before/after dispatch; quick-review continuations and draft boundary behavior.
- `components/live-voting/board-decision-mode.tsx:25`: current-authority complete selection before board entry; existing snapshot/mutation guards retained.

Remote identity verification, live Auth session/revocation, account enablement, club membership/capabilities/suspension, support restrictions, anonymous/self-review protections and voting snapshot/post-snapshot authority remain mandatory. Cursor/context hashes bind selection only; they never authorize. There is no successful-authorization cache between requests or protected reveal before required fresh validation. Draft persistence, necessary live updates, private no-store/Cookie responses and Demo isolation remain regression-tested. No production infrastructure/database/security behavior was changed.

## Verification and next phase

[QA.json](QA.json): 1,492 ordinary cases:1,435 pass/57 gated skips/0 fail; baseline signup/session/MFA38; candidate Auth/settings/runtime50; existing navigation16; new real pipeline/browser integration16; native transaction49; native recruitment/offers/communications42; production build/types pass; final lint0 errors/21 existing warnings. All57 migrations and78 RLS/browser-CRUD denial table checks pass. Counts overlap with suites and must not be added as independent coverage. Initial transport-observer and synthetic-document harness failures are recorded with their fixes; no Auth assertion was removed. New diagnostic verification:10/10, including quantiles/zero/null/failed rows, sleep exclusion, bounded concurrency, no-overwrite controls and actual two-frame readiness.

Recommendation: first design a small-cohort interaction path that avoids the added detail/search/voting wait while retaining the required live authorization policy. Consider a bounded compact response/appropriately sized hydration or a separately explicit large-cohort strategy; no arbitrary threshold or success cache is justified by these four sample sizes. Then freeze a new candidate, rerun the same cohort matrix and common journeys, and require full security/draft/concurrency QA plus hosted CI before merging. Separately fix the confirmed baseline dock obstruction. Obtain representative production click/critical-path and cohort-distribution evidence before prioritizing regional or pool changes. The historical Settings preload/handoff and raw SQL join remain excluded.

Reproduction commands and known setup limitations: [REPRODUCTION.md](REPRODUCTION.md). All private fixtures/build snapshots are disposable and are removed after evidence sealing. This is a completed investigation/release decision, not a claim that the overall optimization backlog is complete.

## Complete comparison tables

Values below are actual derived measurements. Browser values are p50/p95/max milliseconds; requests and bytes are medians for the measured click/workflow window, with missing totals left null. Full source, per-request phases, byte coverage and errors are in JSON.

### Entry and detail

| Cohort / profile | Path / condition | n B/A | B p50/p95/max ms | A p50/p95/max ms | Requests B→A | Window bytes B→A |
|---|---|---:|---:|---:|---:|---:|
| 100 / local | recruiting → applicants / cold | 10/10 | 98.2/115.9/115.9 | 66.2/82.5/82.5 | 5→5 | 92763→40132 |
| 100 / local | recruiting → applicants / warm | 10/10 | 74.7/87.4/87.4 | 64/71.8/71.8 | 1→1 | 61970→7225 |
| 100 / local | applicants → applicantDetail / cold | 10/10 | 54.6/65.6/65.6 | 80.4/130.1/130.1 | 3→4 | 902→2776 |
| 100 / local | applicants → applicantDetail / warm | 10/10 | 33.2/37.2/37.2 | 85.7/119.4/119.4 | 3→4 | 902→2776 |
| 1000 / local | recruiting → applicants / cold | 10/10 | 468.3/766.1/766.1 | 84.6/132.2/132.2 | 5→5 | 633116→40156 |
| 1000 / local | recruiting → applicants / warm | 10/10 | 448.9/505/505 | 85.9/106.6/106.6 | 1→1 | 602323→7249 |
| 1000 / local | applicants → applicantDetail / cold | 10/10 | 211.1/224.4/224.4 | 80.4/96.7/96.7 | 3→4 | 902→2753 |
| 1000 / local | applicants → applicantDetail / warm | 10/10 | 182.8/188.8/188.8 | 97.7/228/228 | 3→4 | 902→2753 |
| 5000 / local | recruiting → applicants / cold | 10/10 | 1890.1/2246.1/2246.1 | 166.4/359/359 | 5→5 | 3019817→40175 |
| 5000 / local | recruiting → applicants / warm | 10/10 | 1943.7/2228/2228 | 142.4/291.8/291.8 | 1→1 | 2989024→7268 |
| 5000 / local | applicants → applicantDetail / cold | 10/10 | 935.2/957.3/957.3 | 79.9/136.7/136.7 | 3→4 | 905→2772 |
| 5000 / local | applicants → applicantDetail / warm | 10/10 | 892.6/1016.7/1016.7 | 96.7/97.8/97.8 | 3→4 | 905→2772 |
| 100 / constrained | recruiting → applicants / cold | 10/10 | 686.1/699.2/699.2 | 436.4/456.5/456.5 | 5→5 | 92763→40132 |
| 100 / constrained | recruiting → applicants / warm | 10/10 | 500/538/538 | 220.2/226.7/226.7 | 1→1 | 61970→7225 |
| 100 / constrained | applicants → applicantDetail / cold | 10/10 | 160.7/190.4/190.4 | 265.8/302.3/302.3 | 3→4 | 902→2776 |
| 100 / constrained | applicants → applicantDetail / warm | 10/10 | 119.3/133.8/133.8 | 250.2/260.9/260.9 | 3→4 | 902→2776 |
| 1000 / constrained | recruiting → applicants / cold | 10/10 | 4126.9/4533.7/4533.7 | 435.9/443/443 | 5→5 | 633116→40156 |
| 1000 / constrained | recruiting → applicants / warm | 10/10 | 4071.9/4124.6/4124.6 | 222.6/232.1/232.1 | 1→1 | 602323→7249 |
| 1000 / constrained | applicants → applicantDetail / cold | 10/10 | 825.5/846.7/846.7 | 265.8/270.8/270.8 | 3→4 | 902→2753 |
| 1000 / constrained | applicants → applicantDetail / warm | 10/10 | 788.7/800.9/800.9 | 250.8/302.5/302.5 | 3→4 | 902→2753 |
| 5000 / constrained | recruiting → applicants / cold | 10/10 | 19737.6/20003.4/20003.4 | 437.3/445.4/445.4 | 5→5 | 3019817→40175 |
| 5000 / constrained | recruiting → applicants / warm | 10/10 | 19679.6/19848.6/19848.6 | 273.4/367/367 | 3→1 | 2989762→7268 |
| 5000 / constrained | applicants → applicantDetail / cold | 10/10 | 3887.7/4397.7/4397.7 | 265.7/277/277 | 3→4 | 905→2772 |
| 5000 / constrained | applicants → applicantDetail / warm | 10/10 | 3802/4058.5/4058.5 | 246.8/267.3/267.3 | 5→4 | 1643→2772 |
| 1 / local | recruiting → applicants / cold | 10/10 | 61.2/77.6/77.6 | 60.1/89.2/89.2 | 5→5 | 32656→33666 |
| 1 / local | recruiting → applicants / warm | 10/10 | 57.5/73.3/73.3 | 57.8/155.8/155.8 | 1→1 | 1863→759 |
| 1 / local | applicants → applicantDetail / cold | 10/10 | 34.2/45.8/45.8 | 63.3/80.6/80.6 | 3→4 | 908→2772 |
| 1 / local | applicants → applicantDetail / warm | 10/10 | 31.3/32.2/32.2 | 81/275/275 | 3→4 | 908→2772 |
| 1 / constrained | recruiting → applicants / cold | 10/10 | 324.5/359.1/359.1 | 333.2/469.9/469.9 | 5→5 | 32656→33666 |
| 1 / constrained | recruiting → applicants / warm | 10/10 | 137.4/147.9/147.9 | 124.6/139.5/139.5 | 1→1 | 1863→759 |
| 1 / constrained | applicants → applicantDetail / cold | 10/10 | 83.7/102.4/102.4 | 167.5/649/649 | 3→4 | 908→2772 |
| 1 / constrained | applicants → applicantDetail / warm | 10/10 | 41.8/155.7/155.7 | 154.3/171.7/171.7 | 3→4 | 908→2772 |

### Common workflow

| Cohort / profile | Path / condition | n B/A | B p50/p95/max ms | A p50/p95/max ms | Requests B→A | Window bytes B→A |
|---|---|---:|---:|---:|---:|---:|
| 100 / local | Overview CTA → detail → close → distant search / warm_browser_context_fresh_source | 6/6 | 1030.4/1060.5/1060.5 | 1145.5/1178.8/1178.8 | 9→11 | 63520→11408 |
| 1000 / local | Overview CTA → detail → close → distant search / warm_browser_context_fresh_source | 6/6 | 1560.8/1629.4/1629.4 | 1147.2/1178.3/1178.3 | 9→11 | 603875→11414 |
| 5000 / local | Overview CTA → detail → close → distant search / warm_browser_context_fresh_source | 6/6 | 5093.4/5503.9/5503.9 | 1177.4/1264.1/1264.1 | 9→11 | 2990578→11451 |
| 100 / constrained | Overview CTA → detail → close → distant search / warm_browser_context_fresh_source | 6/6 | 1461.4/1494.1/1494.1 | 1328.2/1427.2/1427.2 | 9→11 | 63521→11407 |
| 1000 / constrained | Overview CTA → detail → close → distant search / warm_browser_context_fresh_source | 6/6 | 6785.4/6976.3/6976.3 | 1295.1/1328.1/1328.1 | 9→11 | 603875→11414 |
| 5000 / constrained | Overview CTA → detail → close → distant search / warm_browser_context_fresh_source | 6/6 | 30635.4/31891.8/31891.8 | 1394.9/1578/1578 | 11→11 | 2991316→null |

### Voting open/close

| Cohort / profile | Path / condition | n B/A | B p50/p95/max ms | A p50/p95/max ms | Requests B→A | Window bytes B→A |
|---|---|---:|---:|---:|---:|---:|
| 100 / local | applicants → voting / cold | 6/6 | 107.9/131.6/131.6 | 141/173.8/173.8 | 1→2 | 511→3149 |
| 100 / local | applicants → voting / warm | 6/6 | 115.8/313.8/313.8 | 147.8/212.9/212.9 | 1→2 | 511→3149 |
| 100 / local | voting → applicants / cold | 6/6 | 32.1/33.1/33.1 | 31.3/33.2/33.2 | 0→0 | 0→0 |
| 100 / local | voting → applicants / warm | 6/6 | 32.3/33.2/33.2 | 32.2/32.5/32.5 | 0→0 | 0→0 |
| 5000 / local | applicants → voting / cold | 6/6 | 1183/1293/1293 | 284/296.8/296.8 | 1→2 | 511→127622 |
| 5000 / local | applicants → voting / warm | 6/6 | 1149.5/1663.5/1663.5 | 336.6/422.5/422.5 | 1→2 | 511→127622 |
| 5000 / local | voting → applicants / cold | 6/6 | 150.6/165.4/165.4 | 32.6/33.1/33.1 | 0→0 | 0→0 |
| 5000 / local | voting → applicants / warm | 6/6 | 150.2/155.3/155.3 | 33/33.2/33.2 | 0→0 | 0→0 |

### Bounded local HTTP

| Cohort / profile | Path / condition | n B/A | B p50/p95/max ms | A p50/p95/max ms | Requests B→A | Window bytes B→A |
|---|---|---:|---:|---:|---:|---:|
| 1000 / local | HTTP initial applicant read / concurrency-1 | 5/5 | 220.08/233.31/233.31 | 45.75/61.55/61.55 | 1/read | 602309→7236 |
| 1000 / local | HTTP initial applicant read / concurrency-2 | 10/10 | 700.15/1301.99/1301.99 | 68.64/101.03/101.03 | 1/read | 602309→7236 |
| 1000 / local | HTTP initial applicant read / concurrency-4 | 20/20 | 672.92/1104.44/1120.45 | 79.57/109.15/117.22 | 1/read | 602309→7236 |
| 5000 / local | HTTP initial applicant read / concurrency-1 | 5/5 | 1449.42/1807.17/1807.17 | 121.67/209.01/209.01 | 1/read | 2989009→7255 |
| 5000 / local | HTTP initial applicant read / concurrency-2 | 10/10 | 1537.92/2212.91/2212.91 | 221.26/251.12/251.12 | 1/read | 2989009→7255 |
| 5000 / local | HTTP initial applicant read / concurrency-4 | 20/20 | 2523.81/3351.76/3415.07 | 259.73/326.44/347.34 | 1/read | 2989009→7255 |
