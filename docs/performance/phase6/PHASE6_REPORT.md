# OutClass performance — Phase 6

**Phase 6 improves large applicant reads; hold publication of the accumulated pagination branch.**

Audit reference: `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Baseline: Phase 5 `3e3b81c040671c32c188215d04ab780560e97ed0`. Implementation is isolated on `codex/performance-phase6-20261024` in the existing managed worktree. All prior phases and the primary checkout are preserved. No production configuration, schema/index, dependency, merge, push or deployment change.

## Change

The list, page and complete-selection reads now use a database field allowlist. They read only the application identifiers/status, round anonymity, list profile fields, submitted review metadata and active assignment capability fields. They no longer hydrate offers, full rounds, full user/member records, unused profile fields or private review drafts. Detail reads retain their complete authorized content.

Both paths share the existing review-visibility rules: self-review exclusion, current assignment, the assigned reviewer's submission barrier, closing-review office restrictions, historical review visibility and the active reviewers used in provisional score counts. Identified and anonymous list fields share their canonical profile helpers. The common read context retains the same live authorization, gender visibility guard, club/draft/round predicates, Repeatable Read transaction and sanitized failure diagnostics.

Filtering, JavaScript locale ordering, missing-value behavior, cursor ownership, complete facets/counts, quick review and voting selection contracts are unchanged. There are no UI, request-count, queue, authorization-cache or concurrency-policy changes. Every GET still verifies identity and live session/account/membership authority; responses retain private `no-store` and cookie-sensitive handling. Voting writes and snapshot authority remain unchanged.

This reduces hydration work; it does **not** bound SQL rows or make deep pages constant-time. The complete authorized metadata scan remains O(N). It does not add an index, raw SQL privacy implementation or successful-authorization cache.

## Verification

The ordinary suite passed 1,381 tests with zero failures and 50 environment-gated skips (1,431 total). All 51 selected real Auth/navigation/Settings/browser tests passed without skips. Three native PostgreSQL concurrency tests passed. All 57 migrations applied to fresh and legacy databases; all 78 tables enforce RLS and deny browser-role CRUD. The production build and final type check passed. Lint reports zero errors and 22 existing warnings.

New checks compare narrow summaries with canonical full reads across 96 viewer/profile/anonymity/submission combinations, verify the database field allowlist and independently assert the submission barrier, inactive-assignment treatment, historical visibility and self exclusion. The real HTTP test covers five fresh authority/assignment/privacy states, all eight sorts and search/review/rating/major/year filters against the canonical full projection. Existing tests cover strict GET inputs, no-store behavior, revocation, Demo isolation, complete selection, duplicate elimination, draft continuity and rapid switching.

Development failures are retained in `tests/`: the initial transaction callback type did not match the app's extended Prisma client, then was corrected to the existing `AppTransactionClient` type. The new live fixture initially tried to update/delete immutable submitted reviews. It was corrected to publish once and retain history until disposable fixture teardown; membership/round state was restored. Neither fix bypassed a security/database rule. The final live suite passed on the frozen candidate build.

## Measurement

Fresh baseline and candidate production builds share the same reserved local Auth/database credentials and independent synthetic 100/1,000/5,000 cohorts. Within a cohort the same records are measured in BA then AB blocks, with one warmup and five measured observations per build/path/condition/block. Initial list/detail navigation uses cold and warm browser conditions. Additional warm next-page and distant-search interactions use the 1,000/5,000 cohorts. All planned outcomes and errors are retained; there are no retries, synthetic product delays or request gates in performance runs.

Cold means first target visit in a fresh browser context, not a deployment cold start. Servers receive warmups. Content clocks use browser observations and two animation frames; the supplemental clock begins at the actual click/input event, with driver elapsed time retained separately. At n=10, nearest-rank p95 is the maximum; these are descriptive local observations, not production percentile estimates. Server phases can nest and are not additive. Database spans include awaiting the ORM; transaction acquisition includes setup/transport and is not an isolated connection-pool wait measurement.

Real-loader probes compare the baseline's committed TypeScript source with the candidate on the same local records, using the existing adapted Next cookie/support context and actual Auth/PostgreSQL. Each case has two warmups and 20 retained samples. These probes are separate from HTTP/browser latency, and retain sanitized statement metadata, return JSON sizes and Auth verification counts rather than query values or applicant payloads.

## Results

**384 accepted browser outcomes: 320 measured and 64 warmups.** Zero failed outcomes, page errors or timed/source HTTP errors. The full interval has no actual Sleep/Wake/DarkWake events. All rows are retained. Separately there are 22 timed recruitment-cycle HTTP-200 abort flags with positive captured body bytes and successful content predicates: measured B10/A6, warmup B2/A4. No source or interaction transport flags occurred. These flags are retained separately in `comparison/TRANSPORT_FLAGS.json`, rather than counted as HTTP errors or silently omitted.

Builds: baseline `FRwn8Sm2LWVT0ljRgVk1x`; candidate `-QrsvxQPKeDo79kHAoieb`.

### Initial list

Milliseconds are p50 / p95. Bytes are the compressed selected GET body.

| Applicants | Condition | Before | After | GET bytes before → after | Timed requests before → after |
|---:|---|---:|---:|---:|---:|
| 100 | cold | 71.4 / 101.5 | 68.9 / 137.2 | 7,243 → 7,243 | 5 → 5 |
| 100 | warm | 57.8 / 70.6 | 57.4 / 67.1 | 7,243 → 7,243 | 1 → 1 |
| 1,000 | cold | 129.2 / 143.7 | 99.6 / 115.7 | 7,245 → 7,245 | 5 → 5 |
| 1,000 | warm | 110.1 / 183.2 | 92.4 / 95.5 | 7,245 → 7,245 | 1 → 1 |
| 5,000 | cold | 340.8 / 370.5 | 219.9 / 228.5 | 7,255 → 7,255 | 5 → 5 |
| 5,000 | warm | 336.7 / 356.1 | 216.1 / 245.4 | 7,255 → 7,255 | 1 → 1 |

At 5,000 applicants, cold p50 improves 120.9 ms (35.5%) and warm p50 improves 120.6 ms (35.8%). The page body and request count are unchanged. The 100-row warm median is effectively unchanged (57.8 → 57.4 ms), while cold p95 regresses 101.5 → 137.2 ms. That retained candidate observation has 89.34 ms server duration, including 64.73 ms identity and 18.49 ms database spans, with no sleep interruption. The larger tail is reported as a regression; it is not removed or used to claim a small-cohort win.

### Later pages and global search

| Applicants | Warm interaction | Before p50 / p95 | After p50 / p95 | Timed requests before → after |
|---:|---|---:|---:|---:|
| 1,000 | next-page | 129.9 / 146.3 | 96.5 / 113.4 | 1 → 1 |
| 1,000 | distant-search | 110.9 / 127.8 | 94.8 / 111.5 | 1 → 1 |
| 5,000 | next-page | 353.7 / 420.6 | 229.7 / 233.2 | 1 → 1 |
| 5,000 | distant-search | 353.9 / 441.6 | 227 / 227.4 | 1 → 1 |

At 5,000, next-page p50 improves 35.1% and distant-search p50 improves 35.9%. This recovers part of Phase 5’s regression. Each interaction still performs one live GET. The earlier Phase 5 report measured its Phase 4 resident-list reference at roughly 28–31 ms with zero interaction requests; that is historical context, not a new matched three-build comparison. The current 227–230 ms interactions do not restore that behavior.

### Server and network

Selected list p50, milliseconds. Nested spans are not additive.

| Applicants / condition | TTFB before → after | Server total | Database spans | Acquisition | Serialization | Body transfer |
|---|---:|---:|---:|---:|---:|---:|
| 100 / cold | 34.6 → 33.1 | 33.2 → 31.6 | 9.6 → 6.3 | 0.4 → 0.4 | 0.6 → 0.5 | 0.3 → 0.3 |
| 100 / warm | 31.6 → 30.4 | 30.2 → 29.1 | 7.9 → 6.8 | 0.4 → 0.4 | 0.4 → 0.4 | 0.3 → 0.3 |
| 1,000 / cold | 85.5 → 61.0 | 82.5 → 59.6 | 48.6 → 29.5 | 0.5 → 0.4 | 0.5 → 0.5 | 0.3 → 0.3 |
| 1,000 / warm | 80.8 → 58.4 | 79.4 → 57.0 | 47.7 → 29.9 | 0.4 → 0.4 | 0.5 → 1.1 | 0.4 → 0.4 |
| 5,000 / cold | 304.0 → 181.5 | 302.6 → 179.5 | 239.4 → 133.0 | 0.5 → 0.4 | 0.7 → 0.5 | 0.3 → 0.3 |
| 5,000 / warm | 302.9 → 185.8 | 301.2 → 183.5 | 228.0 → 137.9 | 0.4 → 0.4 | 0.7 → 0.5 | 0.4 → 0.4 |

The 5,000-row warm server median falls 301.24 → 183.52 ms (39.1%); database spans fall 227.96 → 137.94 ms. Identity remains about 22 ms and acquisition about 0.4 ms. This supports reduced database/ORM hydration work, rather than avoided authorization or a transfer/response-size improvement. Serialization at 1,000 warm rises 0.46 → 1.05 ms; Phase 6 does not establish a universal serialization gain.

### Detail

| Applicants | Condition | Before p50 / p95 | After p50 / p95 | Timed requests | GET body bytes before → after |
|---:|---|---:|---:|---:|---:|
| 100 | cold | 80 / 95.7 | 80 / 81 | 4 → 4 | 1,871 → 1,871 |
| 100 | warm | 96.7 / 97.8 | 81.5 / 97.7 | 4 → 4 | 1,871 → 1,871 |
| 1,000 | cold | 79.6 / 80.4 | 80 / 93.1 | 4 → 4 | 1,861 → 1,861 |
| 1,000 | warm | 97.3 / 102.9 | 96.6 / 98.1 | 4 → 4 | 1,861 → 1,861 |
| 5,000 | cold | 96.3 / 113.4 | 84 / 97.7 | 4 → 4 | 1,869 → 1,869 |
| 5,000 | warm | 97.2 / 104.1 | 97.2 / 103.3 | 4 → 4 | 1,869 → 1,869 |

Detail has no designed optimization and no consistent gain. The 1,000-row cold p95 regresses 80.4 → 93.1 ms; its slowest candidate row has 27.7 ms before the selected request and 31.32 ms server duration, including 23.81 ms identity. The 5,000-row warm median is identical at 97.2 ms. Favorable cold/detail differences are not attributed to narrowing the list query. Every observation remains in the comparison.

### Real-loader probes

At 5,000 applicants, outside Next HTTP:

| Read | Before p50 / p95, ms | After p50 / p95, ms | Median SQL/control statements | Auth user verifications per read |
|---|---:|---:|---:|---:|
| pipeline | 611.6 / 655.7 | 607.7 / 654.9 | 18 → 18 | 1 → 1 |
| pipelineList | 263.2 / 280.2 | 154.2 / 165.7 | 14 → 13 | 1 → 1 |
| pipelinePage | 264.1 / 268.9 | 153.0 / 163.9 | 14 → 13 | 1 → 1 |
| pipelineSelection | 260.7 / 273.2 | 152.6 / 183.7 | 14 → 13 | 1 → 1 |
| pipelineDetail | 21.8 / 23.2 | 22.6 / 26.5 | 18 → 18 | 1 → 1 |

The 5,000-row page loader falls 264.06 → 152.99 ms p50 (42.1%). The missing statement is the unused offer relation read. The wire-independent return JSON sizes are identical: full list 3,003,626 bytes, page 59,257 bytes and full selection 690,018 bytes. These are uncompressed loader return sizes, not network bytes. Full detail/all-applicant reads retain median 18 statements; occasional extra engine statements are preserved. All three summary paths continue to omit the eight detail columns checked by the probe. Full selection benefits from the narrower read, but quick-review and voting end-to-end latency distributions were not separately measured.

`comparison/COMPARISON.json` includes complete timed/source request and body/script bytes, TTFB, CPU/script observations, drain duration and paired-block medians for every group. Source preparation has zero HTTP errors. The selected payload figures above are not total journey bytes; a changed script chunk is not counted as a payload optimization. `REGRESSION_OBSERVATIONS.json` records the retained small-cohort/detail peaks.

## Recommendation and limits

**Keep the narrow projection; hold publication of the accumulated pagination branch.** Phase 6 produces a clear large-cohort improvement over Phase 5 without removing live validation, but the page/search interaction cost remains materially above the earlier resident-list behavior. Small-cohort and detail tails also do not uniformly improve. Main and production remain unchanged.

For the next phase, compare this narrower complete-summary transport with the paged transport using the same initial-navigation and interaction protocol. That tests whether retaining already released summaries in the existing workspace state is the better latency/bandwidth tradeoff. In parallel design work, investigate database filtering/order/counts only with explicit parity for anonymous identities, hidden scores, academic-year ordering and JavaScript collation. Do not call the current scan bounded SQL or remove a live session check to mask its cost. A future hosted comparison and representative concurrent-client test should precede a release recommendation.

The metadata scan and explicit complete-selection read remain O(N). New page/search reads still incur live Auth and database latency. Fresh requests do not form a cross-request data snapshot; live edits can move records between pages. The 2,000-candidate voting-session write limit is unchanged. Hosted latency, deployment cold starts, representative mobile performance and multi-client pool saturation are not established by this local comparison.

`IMPLEMENTATION.diff`, `TEST_RESULTS.json`, `BENCHMARK_RESULTS.json`, raw `comparison/` observations, source/build manifests and the evidence hash inventory provide the review trail. Owned local services, credentials and temporary build snapshots are cleaned up after collection; the final ignored candidate build is retained for review. No production or persistent power-management setting changes.
