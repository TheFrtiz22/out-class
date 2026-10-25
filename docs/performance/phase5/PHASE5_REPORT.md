# OutClass performance — Phase 5

**Recommendation: hold publication.** The payload improvement is real, but later pages/searches regress substantially.

Audit reference: `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Local implementation on `codex/performance-phase5-20261024`, preserving Phase 4 `dff90cf5eac1044cde8f8e908466f661192aefc9` and the prior series. No merge, push, deployment, infrastructure setting, schema or index change.

## Implemented behavior

- Explicit `pipelinePage` GET: at most 100 applicant summaries, full authorized match count, complete major/year choices, decision-group totals and Kanban lane totals.
- Search, numeric thresholds, review filters and sorting execute after the existing canonical identity/score privacy projection. A hidden identity, major or score cannot influence matches. Stable IDs break all sort ties.
- Cursors bind the club, current membership projection, round privacy metadata and normalized selection. They confer no access: every request repeats verified identity, live session/account/membership and capability checks. An unavailable anchor resets to the first page. A changed scope rejects the cursor; retry starts at the first page.
- Separate `pipelineSelection` GET supplies only IDs, round/status and quick-review eligibility when quick review or voting is opened. Both operate on the complete filtered selection. Voting snapshot creation and all mutations retain their original authority checks.
- Page-boundary drawer navigation loads one fresh page and the requested detail; drafts survive the boundary. Quick review refreshes eligibility as it advances. Each voting visit validates again before exposing the candidate pool.
- Filter edits drain one active page read and dispatch only the latest queued selection. No successful authorization is reused by a later request; the browser retains its current rendered page and pending work. The existing browser queue and local database pool bounds remain.
- Existing private `no-store`, cookie-sensitive handling, support restrictions and Demo isolation remain. Interface icons are unchanged.

## Important limit

The response and rendered page are bounded. The database query and canonical privacy projection still scan the whole authorized summary set. This is server pagination of the response, not bounded SQL/keyset pagination. It preserves JavaScript locale ordering and viewer-specific review/score rules without duplicating them in raw SQL. It does not solve database scaling or eliminate authorization round trips for later pages/searches.

## Validation

The final source passed 1,428 ordinary tests: 1,379 passed, zero failed, 49 environment-gated skips. All 50 real Auth/navigation/Settings/browser acceptance tests passed without skips, including the four new Phase 5 cases. Three native PostgreSQL concurrency tests passed. All 57 migrations applied on fresh and legacy databases; all 78 tables enforce RLS and deny browser-role CRUD. Production build and type checking passed; lint has zero errors and 22 existing warnings.

Development failures and their fixes are retained under `tests/`: component fixtures were updated for the real page/async transport; disabled review editors no longer attempt a draft flush; clearing a filter cannot restore an older cursor; boundary reads have a duplicate-click guard. The voting test selector and setup-discard handling were corrected without app changes. A development-effect lifecycle issue was then found in review, fixed, and covered by effect cleanup/setup replay. The final source was rebuilt and the full ordinary/live checks rerun. Stable selected-tab tests require one GET; page-change and drawer-boundary tests require exactly one additional GET after initial authority/bootstrap work settles. The 5,000-candidate pool was verified; this does not claim a 5,000-candidate snapshot write. The existing 2,000-candidate/session schema limit remains unchanged.

## Measurement protocol

Fresh baseline and candidate production builds use identical reserved local Auth/database credentials and independent synthetic 100/1,000/5,000 cohorts. Within each cohort, the exact same records are used for BA then AB blocks. Each block includes one warmup plus five measured cold/warm outcomes for initial list and detail navigation. Additional warm next-page and distant-search interactions use the 1,000/5,000 cohorts in the same blocks. “Cold” means the target has not been visited in that fresh browser context; “warm” means a target visit and return before the measured revisit. Server processes receive warmups, so this does not measure deployment cold starts. No app delays, request interception or retries are installed in performance runs.

The preliminary collection was stopped for the lifecycle fix: 96 exported outcomes are retained in `comparison/` and excluded entirely. Final primary-navigation claims use `comparison-final/`; final interaction claims use the complete `interaction-paint/` repeat described below. Nearest-rank p95 at ten observations is the maximum; these are descriptive local measurements, not production percentile estimates. Network-drain duration includes background work and is not wire latency. Raw server phases, request counts/bytes, TTFB and transfer observations are retained.

## Results

The accepted sets contain **384 outcomes: 320 measured and 64 warmups**, with zero failed outcomes, page errors or timed HTTP errors. Both accepted intervals have no Sleep/Wake/DarkWake events. Separately, the primary collection retains 22 HTTP-200 recruitment-cycle response abort flags (16 measured, 6 warmup), with positive captured body bytes and successful content predicates. They are not counted as HTTP errors or failed navigations; exact before/after counts are in `comparison-final/TRANSPORT_FLAGS.json`. Primary navigation uses `comparison-final/`; interaction latency uses the complete `interaction-paint/` repeat.

### Initial applicant list

Milliseconds below are p50 / p95; p95 equals maximum at n=10. Payload is the compressed selected GET body, not total journey traffic.

| Applicants | Browser condition | Before p50 / p95 | After p50 / p95 | GET bytes before → after | Timed requests before → after |
|---:|---|---:|---:|---:|---:|
| 100 | cold | 75.6 / 97.7 | 72.7 / 80.1 | 6,960 → 7,231 | 5 → 5 |
| 100 | warm | 55.2 / 69.1 | 63.9 / 71.0 | 6,960 → 7,231 | 1 → 1 |
| 1,000 | cold | 130.0 / 150.4 | 128.4 / 166.2 | 70,362 → 7,248 | 5 → 5 |
| 1,000 | warm | 110.6 / 122.1 | 110.6 / 197.2 | 70,362 → 7,248 | 1 → 1 |
| 5,000 | cold | 367.3 / 411.0 | 331.4 / 352.1 | 353,251 → 7,270 | 5 → 5 |
| 5,000 | warm | 336.4 / 402.8 | 324.2 / 359.6 | 353,251 → 7,270 | 1 → 1 |

At 5,000 applicants the body falls from 353,251 to 7,270 bytes (**97.94% less**). Cold p50 improves 35.9 ms (9.8%); warm p50 improves 12.2 ms (3.6%). Request counts do not fall. At 100 applicants the body grows by 271 bytes and warm p50 worsens by 8.7 ms. At 1,000 applicants the median does not materially improve and warm p95 worsens from 122.1 to 197.2 ms. The slowest candidate observation retains 160.6 ms server duration, 71.75 ms identity and 69.01 ms database spans; no sample is discarded. Nested phase durations are not additive.

### Later page/search interactions

These clocks start at the actual browser click/input event and end at the candidate-content predicate plus two animation frames. Driver waiting is retained separately.

| Applicants | Warm interaction | Before p50 / p95 | After p50 / p95 | Requests before → after |
|---:|---|---:|---:|---:|
| 1,000 | next-page | 30.7 / 31.5 | 130.4 / 132.9 | 0 → 1 |
| 1,000 | distant-search | 27.4 / 28.2 | 127.5 / 193.9 | 0 → 1 |
| 5,000 | next-page | 30.2 / 31.4 | 346.9 / 367.6 | 0 → 1 |
| 5,000 | distant-search | 28.1 / 29.2 | 337.1 / 406.4 | 0 → 1 |

This is a substantive regression. A resident client list previously paged/searched without a request. The new transport performs fresh authorization and repeats the whole summary scan. At 5,000 applicants, next-page server p50 is 311.82 ms and search server p50 is 299.63 ms. Coalescing protects rapid edits from queuing every intermediate query, but it cannot remove the cost of the final requested read.

### Server/network detail

Selected-list p50 timings, milliseconds:

| Applicants / condition | TTFB before → after | Server total before → after | Database spans before → after | Serialization before → after | Body transfer before → after |
|---|---:|---:|---:|---:|---:|
| 100 / cold | 36.6 → 35.9 | 35.0 → 34.2 | 8.5 → 9.5 | 0.6 → 0.6 | 0.3 → 0.3 |
| 100 / warm | 32.2 → 33.0 | 30.5 → 31.4 | 7.9 → 7.9 | 0.5 → 0.4 | 0.3 → 0.4 |
| 1,000 / cold | 86.5 → 87.0 | 85.2 → 85.1 | 51.7 → 52.9 | 4.3 → 0.5 | 0.7 → 0.3 |
| 1,000 / warm | 82.4 → 83.2 | 80.8 → 81.4 | 46.6 → 47.6 | 3.1 → 0.5 | 0.7 → 0.4 |
| 5,000 / cold | 326.9 → 292.2 | 325.4 → 290.8 | 236.6 → 232.8 | 16.9 → 0.5 | 2.3 → 0.3 |
| 5,000 / warm | 300.3 → 296.9 | 298.4 → 295.1 | 223.8 → 229.6 | 16.8 → 0.7 | 2.3 → 0.4 |

The 5,000-row serialization span falls from about 16.8–16.9 ms to 0.5–0.7 ms, while database spans remain around 224–237 ms. This supports a serialization/bandwidth improvement, not a database-scaling improvement. The sequential real-loader probes retain a median 14 SQL/control statements for list, page and selection, and one remote Auth user verification per read. At 5,000 rows the complete-selection loader alone is about 265 ms p50; quick review adds this fresh read on entry/advancement, and voting adds it on each entry. Those workflows have complete-pool acceptance coverage, not a separate end-to-end latency distribution. Single-detail reads retain median 18 statements. Occasional additional engine statements are retained in the raw probes. Acquisition spans include transaction setup/transport; they are not a pool-only wait measurement.

### Applicant detail

| Applicants | Condition | Before p50 / p95 | After p50 / p95 | Requests | Selected body bytes |
|---:|---|---:|---:|---:|---:|
| 100 | cold | 79.4 / 80.1 | 79.2 / 80.0 | 4 → 4 | 1,886 → 1,886 |
| 100 | warm | 97.6 / 114.4 | 97.5 / 102.4 | 4 → 4 | 1,886 → 1,886 |
| 1,000 | cold | 79.7 / 81.1 | 80.1 / 96.8 | 4 → 4 | 1,849 → 1,849 |
| 1,000 | warm | 97.2 / 123.3 | 96.8 / 98.2 | 4 → 4 | 1,849 → 1,849 |
| 5,000 | cold | 96.3 / 100.9 | 96.9 / 98.3 | 4 → 4 | 1,865 → 1,865 |
| 5,000 | warm | 97.0 / 105.5 | 97.4 / 112.7 | 4 → 4 | 1,865 → 1,865 |

There is no consistent profile latency win. At 5,000 applicants, warm profile p95 increases 105.5 → 112.7 ms. Its fresh detail transport, four requests and body size remain unchanged. Small median differences are not attributed to this pagination change.

### Complete traffic and preparation evidence

`comparison-final/COMPARISON.json` includes total timed request/body/script bytes, CPU/script observations, network-drain duration, source-preparation timing and source bytes for every group. These distinguish source work from measured target work; a changed chunk boundary is not treated as a payload optimization. No source HTTP errors occurred for either build. The focused payload claim above is specifically the authenticated list response. Loader probes retain uncompressed return sizes: at 5,000, legacy list 3,003,626 bytes versus page 59,257 bytes; the explicit full-selection response is 690,018 bytes and is loaded only on demand. These probe bytes exclude the HTTP envelope/compression and are not wire-byte measurements.

### Measurement correction and retained attempts

The first complete supplemental set (96 outcomes) measured driver elapsed time, including Playwright locator polling/backoff. All rows and the exact original tool are retained in `comparison-final/`, with `INTERACTION_METHOD_NOTE.json`; those values are excluded from click/input latency claims. The **entire** supplemental BA/AB set was repeated with browser event/MutationObserver/two-frame marks on the same frozen builds and records, with no app changes. Both sets show the added request and server cost; the corrected browser clock removes observer delay rather than changing product behavior. The 96 preliminary outcomes from the earlier lifecycle stop remain separately excluded in `comparison/`. No individual outcome was substituted or deleted.

## Recommendation and unresolved risks

**Hold publication of this Phase 5 branch.** It is a reviewed, locally committed implementation candidate, not a cleared navigation optimization. The bandwidth reduction and modest large-list entry gain do not justify the substantial page/search regression. Main and production remain unchanged.

For the next phase, use this page/selection contract as a test target while reducing the authorized database read itself. Profile and bound the selected candidate/review/assignment hydration, then design database-backed filtering/counts/order without letting hidden identities or scores influence results. Keep the canonical privacy parity tests, live authorization on every request, bounded concurrency, and complete quick-review/voting sets. Repeat the same initial-navigation **and** interaction measurements before recommending publication. Do not trade away the live session check to mask the added round trip.

Remaining limits: database work is O(N); new page/search reads add live Auth latency; a full quick-review/voting selection is still O(N) on demand; live edits can move records between fresh pages (there is no cross-request data snapshot); the existing 2,000-candidate voting-session cap remains; hosted latency, deployment cold starts, multi-client pool saturation and representative mobile performance are not established by this local comparison. The five-second production symptom is not reproduced by these local warmed-server measurements.

No production Supabase/Vercel configuration, region, database schema/index, security behavior, caching library, Redis or Edge Function was changed. No merge, push or deployment was performed.


## Review artifacts and cleanup

`IMPLEMENTATION.diff` contains the application, transport, test and harness changes. `TEST_RESULTS.json` and `tests/` retain verification. `BENCHMARK_RESULTS.json` identifies accepted and excluded datasets. `BASELINE_SOURCE.json`, `CANDIDATE_SOURCE.json`, protocol tool hashes and the evidence inventory identify the builds and source. Owned app/containers, private credentials and temporary build snapshots were removed; prior inactive files and unrelated stacks were preserved. The final candidate build remains ignored in this workspace for review. No production or persistent power settings changed.
