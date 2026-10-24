# Phase 3 — pipeline list and detail performance

October 24, 2026. Implementation branch: `codex/performance-phase3-20261023`, based on unreleased Phase 2 commit `583b231f4a6e7eed9222ac983c9e6634483be6e9`. Audit reference: `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Published main remains `145fed90e046fe11577c86654c5f29ff6964f177`. **No push, merge or deployment was performed.**

The implementation materially improves list navigation, especially at 1,000 and 5,000 applicants. It also has a measured small-club profile-opening regression and unresolved initial-page preparation failures. **Keep it for review; the evidence does not establish release clearance or a hosted p95 guarantee.**

## Implementation

[IMPLEMENTATION.diff](IMPLEMENTATION.diff) contains the code, tools and tests against Phase 2. Apply with `git apply --unidiff-zero`. [CANDIDATE_SOURCE.json](CANDIDATE_SOURCE.json) identifies the ten changed application files; every other captured application/configuration/asset source matches the baseline manifest.

- Add an explicit, strict `pipelineList` GET allowlist entry. Its read uses the same remotely verified identity, live session/account/member/capability checks, historical suspension policy and canonical anonymous/reviewer projection as the original full pipeline. Private `no-store`, `Vary: Cookie`, wire encoding, compression and trace correlation remain in the existing response path.
- Return only list/filter/sort/review-summary fields. Omit experience, answer/question and booking collections from the list SQL. The full single-applicant contract remains available through the original guarded reader. No authorizing result is cached between requests.
- Open a candidate with a fresh, single-applicant read. An owner keyed by identity snapshot, browser authority epoch, support state, club, applicant, revision/retry and Demo state fences late responses. Single-candidate previews use that one read directly, without an extra list lookup. Failed/retried reads do not reveal an earlier projection.
- Display 100 applicants per page. Search, academic/review filters, sorting, counts, quick-review queues and voting candidate selection retain the complete authorized selection. Kanban lane totals stay global. Page changes issue no request; filtering retains search focus and candidate navigation selects the appropriate display page.
- Retain Phase 2's selected code/data overlap, the existing request concurrency cap of three, mutations as Server Actions, Demo adapters and scheduler/draft/live-update behavior. No dependency, schema/index, production configuration or infrastructure changes were made. Voting snapshot/release authority code is unchanged.

This is **display pagination**, not server pagination. The complete compact list is still fetched and filtered in the browser. Scalar student/profile database reads also remain broader than the list wire DTO.

## Study and error accounting

Frozen local production outputs: baseline `bJzuxddYtxuN7DUyKkjHM`; candidate `ZF31McrfqLY3OLGDzGh-T`. Both use the same reserved loopback Auth/PostgreSQL fixture, a local pool limit of eight and one desktop Chromium client. Each cohort has a fixed BA/AB order, five measured samples and one fixed warmup per path/condition/block. Cold means a fresh browser context with a warm server/database; warm means a revisit. Code loading remains included. List activation uses the keyboard; profile selection uses the pointer. Older protocol summaries and some raw profile input-method labels inherited “keyboard”; the actual profile action was a pointer click in both builds. Timing observations remain unchanged.

Each applicant has three synthetic 1,024-character essays, a 1,050-character biography, two added experiences and two submitted evaluations across two rounds. The original 100 also retain their seeded experience. There are no active bookings or panel assignments in this performance fixture. Synthetic prose compresses well; these bytes are not a production payload forecast.

The final evidence covers **288 planned outcomes: 240 measured attempts and 48 fixed warmups**. The 100/1,000 comparison has 160/160 measured successes. The 5,000 stress collection records all 80 measured attempts: 76 successes and **four source-page preparation failures**, before a timed profile click (baseline three, candidate one). All 48 warmups succeeded. No failed attempt is replaced or assigned an invented navigation duration.

Every timed list navigation succeeded. Successful timed observations have zero page exceptions and zero HTTP errors. Failed source attempts include five observed missing-logo HTTP 404 requests; this is a diagnostic count within those failed contexts, not an overall asset-error rate. Their snapshots show the requested Applicants URL but no pipeline root. The cause of these intermittent initial-load failures is unresolved. They are not evidence of a database pool, Auth or region bottleneck.

The smaller-cohort data also retain **19 successful HTTP-200 recruitment-cycle Flight cancellations**, including warmups. These are separately counted only when the cycle UI has no error and received bytes are observed. All other cancellation/error classes remain visible. See [comparison-paged/COMPARISON.json](comparison-paged/COMPARISON.json), [stress-5000/COMPARISON.json](stress-5000/COMPARISON.json), their raw outcomes and protocols. The first stopped strict attempt and split-only prototype remain separate; none is pooled into these results.

Percentiles use the existing nearest-rank calculation. At n=10, p95 is the maximum. These are descriptive local results with two matched blocks, not robust production percentile estimates. Profile rows with fewer than ten successes are explicitly conditional; their full-cohort p95 is not established.

## Click to useful list content

Milliseconds, p50 / p95. Every cell has ten successful measured observations.

| Applicants / condition | Before | After | Median reduction |
|---|---:|---:|---:|
| 100 · cold | 85.4 / 97 | 68.8 / 82.2 | 19.4% |
| 100 · warm | 72.1 / 77 | 55.7 / 69 | 22.7% |
| 1,000 · cold | 444 / 515.4 | 132.4 / 149.8 | 70.2% |
| 1,000 · warm | 419.4 / 468.8 | 112.3 / 153 | 73.2% |
| 5,000 · cold | 1,751.3 / 1,831.4 | 382.7 / 458.7 | 78.1% |
| 5,000 · warm | 1,807.4 / 1,873.1 | 376.8 / 408.1 | 79.2% |

Readiness requires actual applicant content followed by two animation frames. It is a DOM/paint proxy, not a screenshot or React profiler measurement. No loading delay or animation mask was added. Interaction readiness, script/task work and long tasks are retained in the raw results; production React render durations remain unavailable.

## Opening a profile: tradeoffs and reliability

Milliseconds, p50 / p95, with successful / planned observations. Failures here occurred during the starting-page preparation, before the measured click.

| Applicants / condition | Before | After | Preparation failures before → after |
|---|---:|---:|---:|
| 100 · cold | 48.3 / 52.1 (10/10) | 79.8 / 96 (10/10) | 0 → 0 |
| 100 · warm | 33.2 / 35.9 (10/10) | 97.1 / 97.6 (10/10) | 0 → 0 |
| 1,000 · cold | 203.2 / 210.6 (10/10) | 80.8 / 84.8 (10/10) | 0 → 0 |
| 1,000 · warm | 180 / 187 (10/10) | 87.7 / 386.6 (10/10) | 0 → 0 |
| 5,000 · cold | 903.6 / 932.6 (9/10) | 96.2 / 112.8 (10/10) | 1 → 0 |
| 5,000 · warm | 858.9 / 870.2 (8/10) | 96.4 / 97.2 (9/10) | 2 → 1 |

At 100 applicants, profile opening is **31.5 ms slower at the cold median and 63.9 ms slower at the warm median**. The old list already contained every profile; the new path pays for its fresh detail read. This is a real workflow regression, not a hidden warm-cache comparison. A normal profile opening has **3 → 4 requests**, adding one 1,864-byte compressed detail body. Single-candidate dashboard previews retain one read directly.

At 1,000 applicants, warm profile p50 improves but p95 worsens **187 → 386.6 ms**. The retained slow observation includes two browser long tasks (147 and 167 ms); its detail GET server duration is about 40 ms. This does not establish the cause of the tail, and no outlier was removed. At 5,000 applicants, profile timing improves among successful preparations, but failures in both builds prevent a full-cohort reliability or p95 claim.

## Requests, payloads and server work

Median compressed body bytes for the selected list GET and all requests after the list click:

| Applicants | Selected GET body before → after | Total cold click bytes before → after | HTTP request count |
|---|---:|---:|---:|
| 100 | 61,082 → 6,945 | 91,875 → 38,688 | 5 → 5 cold; 1 → 1 warm |
| 1,000 | 598,782 → 70,387 | 629,575 → 102,130 | 5 → 5 cold; 1 → 1 warm |
| 5,000 | 2,985,711 → 352,349 | 3,016,504 → 384,092 | 5 → 5 cold; 1 → 1 warm |

The selected list body falls by approximately **88%** at all three sizes. Ordinary JSON bytes in the separate real-loader probe are 862,616 → 58,726 at 100; 8,485,616 → 599,626 at 1,000; and 42,365,616 → 3,003,626 at 5,000. SQL/control statements fall **18 → 14**, including unchanged authentication/session checks. The single-applicant detail remains 8,957 ordinary JSON bytes and 18 statements in this fixture.

There is **no list HTTP request-count reduction**. Source-page script body bytes also rise: 540,385 → 540,432 for cold list navigation and 570,361 → 571,358 after the warm visit. Next's displayed workspace first-load figure remains 522 kB. The gain is not obtained by secretly moving large work before the timed click.

Selected list network/server timings, in milliseconds. TTFB and server totals show p50 / p95; database and serialization show p50.

| Applicants / condition | TTFB before → after | Server total before → after | Database before → after | Serialization before → after |
|---|---:|---:|---:|---:|
| 100 · cold | 48.9 / 52.9 → 37.1 / 41.4 | 47.4 / 51 → 35.6 / 39.9 | 18.1 → 9.1 | 4.7 → 0.5 |
| 100 · warm | 45.6 / 49.8 → 32.4 / 34.6 | 44.2 / 48.5 → 30.9 / 32.7 | 16.1 → 8.6 | 4.6 → 0.4 |
| 1,000 · cold | 226.1 / 280.1 → 94.5 / 115.8 | 224.5 / 278.1 → 93.1 / 114 | 119 → 58.3 | 69.3 → 4 |
| 1,000 · warm | 208.8 / 246.2 → 85.2 / 114.9 | 206.8 / 244.4 → 83.8 / 113.1 | 120.4 → 51.6 | 48.9 → 3 |
| 5,000 · cold | 864.6 / 928.4 → 344.1 / 411.6 | 863 / 926.8 → 342.8 / 409.9 | 577.9 → 267.8 | 215.2 → 17.9 |
| 5,000 · warm | 928.8 / 956.5 → 344.4 / 373.3 | 927.3 / 954.8 → 342.7 / 371.9 | 582.3 → 268.2 | 267.7 → 17.8 |

[NETWORK_AND_SERVER.md](NETWORK_AND_SERVER.md) includes the additional phase/transfer figures. Identity timings do not show a supported optimization claim; that path is unchanged. Transaction acquisition includes callback acquisition plus BEGIN/transport, not pure pool wait. Nested phases must not be summed as independent elapsed time.

The harness also exports an observed non-SSE request-drain proxy. It has multi-second tails in both builds (including 10.97 s baseline and 8.09 s candidate for the 1,000-applicant warm profile path). Those event timestamps can include background work and observer scheduling; they are not equivalent to wire transfer or database duration. The raw browser request TTFB/transfer and correlated server phases are retained separately. There is no claim that every profile subpanel or background request is ready at the first useful-profile predicate.

## Verification and unsuccessful approaches

The final ordinary suite passes **1,363 tests, zero failures, 45 environment-gated skips** (1,408 total). The frozen production build's 35-case live Auth/navigation batch passes, including all four new Phase 3 browser cases at 5,000 applicants. Onboarding, student-claim and Settings/Admin groups add 31 distinct passing Node test counts across the documented batches, for 66 distinct Auth/navigation counts. Native security/concurrency suites pass, as do all 57 migrations on fresh/legacy databases and browser-role denial/RLS checks for 78 tables. Production builds, type checking and lint pass; lint retains 22 existing warnings. See [TEST_RESULTS.json](TEST_RESULTS.json), [VERIFICATION.log](VERIFICATION.log) and retained [test outputs](test-runs/README.md).

New coverage includes the compact allowlist, original-projection parity, strict transport arguments and private responses, revoked/disabled/capability-loss reads, anonymous masks, owner/late-result fencing, page bounds and whole-list search/counts, page changes without reads, search focus, actual review draft continuity, and single-candidate previews without a duplicate list request. Existing scheduler draft, rapid-switch, concurrent Interview Rooms and voting authority regressions remain in the suite. Not every legacy environment-gated harness was activated; the previously documented broad publication-selector limitation remains.

Zero-result relation filters were an unsuccessful intermediate query approach: Prisma still issued the relation statements (18 → 17 only). The final query omits those relations entirely (18 → 14). The split-only prototype reduced bytes and list latency but retained large rendering work and warm-flow timeouts at 5,000; [SPLIT_ONLY_RESULTS.json](SPLIT_ONLY_RESULTS.json) retains all observed results. Display pages improve rendering but do **not** prove the initial-source failures are fixed. Earlier readiness/test-adapter errors, the unchanged local Admin throttle, and the rejected/rolled-back fixture-shrink attempt are documented rather than erased. A fresh independent fixture was used without bypassing a database guard.

## Recommendation and remaining risks

Keep the compact contract and bounded display implementation for review, with the small-club profile penalty and warm-tail regression explicit. **Do not automatically publish this branch.** First correlate the intermittent starting-page failure with initial-document/account/Auth/hydration traces, and measure hosted list-plus-profile workflows with realistic club sizes. The local reduction does not prove that an added remotely verified detail round trip is acceptable in production.

Next implementation work should move filtering, stable sort/cursor pagination and consistent filtered counts to the server, with an explicit authorized complete-selection contract for quick review and voting. Then narrow directory and task contracts. The current compact response still grows with applicant count; scalar profile reads, large voting/setup histories, concurrent campus traffic and low-end/mobile performance remain unbounded or unmeasured. Mobile coverage here is functional, not a performance distribution. No cache, region change, speculative index or infrastructure move is justified by these measurements alone.

The four per-attempt plan snapshots were reconstructed during packaging and match the SHA-256 recorded in each original protocol; see [PLAN_VERIFICATION.json](PLAN_VERIFICATION.json). Future collection tools now copy the plan at startup. [EVIDENCE.json](EVIDENCE.json) inventories the delivered evidence and implementation hashes.

For reproduction, use a fresh reserved local onboarding fixture, seed the navigation actor, build/snapshot the Phase 2 baseline and this candidate, and record new source/build manifests. Use new output directories with the pipeline study and stress tools. Do not reuse seed JSON against another database, overwrite frozen evidence, or shrink historical fixtures by bypassing guards. The tools leave the private stack for explicit scoped cleanup; [CLEANUP.json](CLEANUP.json) records this run's teardown.
