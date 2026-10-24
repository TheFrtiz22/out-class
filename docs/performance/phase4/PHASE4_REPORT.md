# Phase 4 — remove missing-artwork requests and narrow pipeline database reads

October 24, 2026. Branch: `codex/performance-phase4-20261024`. Parent: Phase 3 `ca6899c80689e14bea6ecf8f969b21afdc4fb939`; audit reference `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Phase 2 and Phase 3 work is preserved. This phase is local and unpublished.

The final comparison shows a modest large-list improvement and eliminates the guessed-logo requests. It also identifies a measurement-environment problem: macOS sleep interrupts the local browser, app and database together. **Server cursor pagination is not implemented in Phase 4.** The current list still reads every authorized applicant; this phase reduces row width and request waste while preserving complete selection behavior.

## Implementation

- `ClubLogo` immediately renders its existing accessible monogram when there is no configured or known bundled artwork. It no longer invents `/logos/<database-id>.png` paths. Known checked-in legacy artwork uses an explicit PNG/WebP map; uploaded/protected sources, preview handling, broken-source fallback and replacement-image recovery are preserved. Prototype-inherited object keys are rejected. Directory and interface-icon systems are unchanged.
- The list-only Prisma branch omits eight unconsumed columns: manager-reviewed anonymous text plus biography, LinkedIn, résumé, headshot, scholar-status, high-school and pronoun fields. Inert values are normalized internally before the same canonical privacy projector and explicit list DTO run. The original full detail reader is unchanged. Live identity/session/account/membership/capability/suspension/support checks, transaction isolation, anonymous/reviewer rules, `no-store`, cookie handling, Demo boundaries and voting snapshot authority remain intact.
- Add sanitized source-readiness and local HTTP diagnostics, source/transfer accounting and a fixed comparison runner. SQL text, parameters, headers, cookies, credentials and protected response bodies are not exported. The loader probe exports only allowlisted column names and statement timing metadata.

[IMPLEMENTATION.diff](IMPLEMENTATION.diff) contains code, tools and tests against Phase 3. Apply with `git apply --unidiff-zero`. [BASELINE_SOURCE.json](BASELINE_SOURCE.json) and [CANDIDATE_SOURCE.json](CANDIDATE_SOURCE.json) identify frozen outputs and source hashes. Three code files and the bundled-logo README differ; all 904 captured source/asset/configuration hashes match their recorded final build.

## Why the first comparison is not accepted for latency claims

The first `comparison/` retains all 288 planned outcomes: 240 measured attempts and 48 warmups. It contains two candidate readiness timeouts, one during source preparation and one after the timed navigation. In the latter, the pipeline root and successful HTTP-200 list response were present when the timeout diagnostic ran; a timed-out content predicate alone does not establish a failed authorization or server response.

The host monitor has 44–453 second gaps, and the macOS power log records overlapping Sleep, Maintenance Sleep and DarkWake events. One background request's database-await span crosses roughly 43.8 seconds of the interrupted interval. That span cannot be interpreted as 43.8 seconds of PostgreSQL execution or lock contention. See [POWER_EVENTS.json](POWER_EVENTS.json), [comparison/SYSTEM.json](comparison/SYSTEM.json) and the retained outcomes.

**The whole first comparison is excluded from accepted performance claims. No individual outlier is removed or replaced.** Both exact frozen builds and all three unchanged cohort fixtures were then rerun under a temporary, process-scoped keep-awake assertion. The read-only [power audit](comparison-awake/POWER_AUDIT.json) records no Sleep events during that entire collection. Application loading behavior and security checks were not changed to suppress the timeouts. This explains the observed local interruption risk; it does not establish that every earlier Phase 3 timeout or a hosted failure has the same cause. Earlier Phase 3 evidence remains unchanged.

## Accepted cold/warm comparison

Baseline build `Yw7wq85L6rD1hngirqnqg`; candidate `WWr8d2B70LK55qBEJMcj6`. One desktop Chromium client, reserved loopback Auth/PostgreSQL stack, pool limit eight, separate rich 100/1,000/5,000-applicant cohorts, identical rows within each build pair. Each applicant has the Phase 3 synthetic essays, biography, experience and review history. There are no active bookings or interview assignments. The BA/AB order, five measured samples and one fixed warmup per path/condition/build/block are retained. No builds or tests run during collection.

The accepted collection contains **288/288 successful planned outcomes: 240 measured attempts and 48 fixed warmups**, zero readiness timeouts, zero page exceptions and zero HTTP errors on the timed navigation paths. The source pages have **240 baseline missing-logo HTTP 404 responses versus zero candidate 404 responses** across the 120 measured source contexts per build: two unnecessary requests removed per context. Warmup source requests are retained separately.

Milliseconds, p50 / p95. Every cell below has ten successful measured observations.

| Applicants · path · condition | Before | After |
|---|---:|---:|
| 100 · list · cold | 66.8 / 76.4 | 64.8 / 83.5 |
| 100 · list · warm | 58.4 / 67.8 | 55.3 / 71.6 |
| 100 · profile · cold | 79.2 / 80.8 | 80.3 / 81.8 |
| 100 · profile · warm | 81.8 / 97.4 | 82.8 / 96.9 |
| 1,000 · list · cold | 129.1 / 167.6 | 118.5 / 128.2 |
| 1,000 · list · warm | 113.1 / 122.2 | 108 / 122.1 |
| 1,000 · profile · cold | 80 / 95.7 | 79.6 / 81.3 |
| 1,000 · profile · warm | 95.8 / 97.7 | 84.5 / 101.2 |
| 5,000 · list · cold | 383.1 / 414.2 | 339.8 / 384 |
| 5,000 · list · warm | 374.2 / 429.5 | 326.5 / 355.7 |
| 5,000 · profile · cold | 93.4 / 97.2 | 81 / 97.9 |
| 5,000 · profile · warm | 82.8 / 96.8 | 83.7 / 98.8 |

At 5,000 applicants, list p50 improves **11.3% cold** and **12.7% warm**. List p95 improves **414.2 → 384 ms cold** and **429.5 → 355.7 ms warm**. Browser-correlated database-await p50 falls **257.6 → 220.6 ms cold** and **248.6 → 218.6 ms warm**. No independent database-pool or production-concurrency improvement is established by this single-client study.

The 100-applicant list p95 worsens **76.4 → 83.5 ms cold** and **67.8 → 71.6 ms warm**, despite slightly better medians. Profile timing is generally similar and has mixed tails. The full profile path is unchanged, so its small fluctuations do not support an independent optimization claim. The results are consistent with row-width reduction helping larger cohorts more; a cause for the small-club tail changes is not established. The earlier Phase 3 tradeoff—an additional freshly authorized detail read instead of resident full-profile bytes—still exists. This phase does not prove that tradeoff acceptable for every hosted workflow.

Nearest-rank p95 at n=10 equals the maximum. These are descriptive local measurements, not confidence intervals, production latency promises or mobile performance distributions. Cold means a fresh browser context with a warm server/database. List activation uses the keyboard; profiles use the pointer. Click readiness uses real applicant/response content followed by two animation frames. No fixed loading delay or animation mask is added.

## Requests and payload bytes

The list's selected GET body is byte-identical within each cohort: **6,933 / 71,187 / 353,412 compressed bytes** at 100 / 1,000 / 5,000 applicants, before and after. List HTTP counts remain **5 → 5 cold** and **1 → 1 warm**; ordinary profile openings remain **4 → 4**. SQL/control counts remain **14 → 14** for lists and 18 for full/detail reads, including live Auth/session checks. This phase removes database column overfetch; it does not shrink the Phase 3 wire contract or reduce its SQL round trips.

The loader probes confirm unchanged ordinary list JSON sizes (58,726 / 599,626 / 3,003,626 bytes), one provider identity verification per read and no omitted detail columns in final list SELECTs. Full/detail reads retain their detail columns. Probe timings are separate from Next HTTP measurements; the early baseline probes and final probes use separately seeded but structurally equivalent cohorts and different overall database populations. Their timing distributions are descriptive, not a matched causal comparison. Statement shape and byte counts remain useful checks.

Fresh source-page observations for the cold condition, n=10 each. Source content time is the existing visible DOM predicate, before background-request drain; it is not the click-to-content paint proxy above. Bytes include received response bodies, not HTTP headers, and are reported only where non-SSE byte counters are complete.

| Applicants · initial page | Source content p50/p95 before → after | Source request median | Source body-byte median |
|---|---:|---:|---:|
| 100 · Recruiting | 249 / 270 → 248 / 280 | 60 → 58 | 1,061,818 → 1,035,397 |
| 100 · Applicants | 216 / 229 → 210 / 223 | 64 → 62 | 1,118,674 → 1,073,095 |
| 1,000 · Recruiting | 257 / 289 → 254 / 268 | 60 → 58 | 1,061,819 → 1,035,398 |
| 1,000 · Applicants | 291 / 321 → 271 / 321 | 64 → 62 | 1,163,705 → 1,137,348 |
| 5,000 · Recruiting | 261 / 274 → 254 / 329 | 60 → 58 | 1,061,859 → 1,035,394 |
| 5,000 · Applicants | 529 / 570 → 475 / 547 | 64 → 62 | 1,445,996 → 1,419,570 |

The removal of two failed artwork requests is consistent, but it does **not** produce a consistent standalone navigation-latency improvement in small clubs. Initial script bytes and full source/request details remain in the raw outcomes, so pre-click work is visible. [NETWORK_AND_SERVER.md](NETWORK_AND_SERVER.md) includes the network/phase distributions.

## Intermediate changes and verification

The baseline and logo-only diagnostic runs each retain five samples per path/condition at 5,000 applicants; the 100-applicant baseline pilot is also retained. All 60 pilot outcomes completed, but their ordering, tracing and uncontrolled host power make them exploratory. They are not pooled into the accepted comparison. The logo-only change has a demonstrated request/error reduction, not a supported independent click-latency claim. Its legacy-key lookup was subsequently hardened; the synthetic fixture's UUID/absent-artwork behavior is identical. The two final changes are covered together by the matched awake comparison.

The final ordinary suite passes **1,368 tests, zero failures, 45 environment-gated skips** (1,413 total). The final frozen-build Auth/navigation/Settings/Admin batch passes **46 tests with no skips**. Native security/interview concurrency tests pass (three tests), and all 57 migrations apply to fresh/legacy databases with RLS/browser-role denial checks on 78 tables. Build/type checking pass; lint has zero errors and 22 existing warnings. The initial baseline bootstrap also passed its 38 onboarding/account/session/privacy/student-claim cases. See [TEST_RESULTS.json](TEST_RESULTS.json) and retained [test outputs](test-runs/README.md).

New tests cover absent/legacy/protected logo sources, inherited-key rejection, accessible monograms without image requests, broken-image replacement and source-metric/failure-denominator correctness. Existing canonical list/detail parity, revoked/disabled/changed-capability reads, anonymous masks, late-response fencing, actual review draft continuity, 5,000-applicant pages/search/focus, single-preview reads, rapid tab switching, scheduler drafts, concurrent Interview Rooms and voting authority coverage remain active in the corresponding suites. Not every legacy environment-gated browser harness is activated; the broad publication-selector limitation documented earlier remains.

## Recommendation and remaining risks

Keep these changes for review. They remove real failed requests and modestly reduce large-list server work. **No push, merge or deployment is performed; overall release clearance remains unestablished.** Hosted latency, the Phase 3 small-club profile tradeoff, active interview/voting histories, concurrent campus traffic and low-end/mobile performance still need evidence.

Phase 5 should implement server filtering, stable cursor ordering and consistent filtered counts with an explicit complete-selection contract for quick review and voting. Preserve canonical anonymous/reviewer score visibility before filtering or ordering. The current omission list reduces width but still reads every row and can miss future wide columns; a narrow explicit database projection belongs with that contract. Directory/task boundaries remain later work. A separate hosted trace is needed before proposing any region, pool or infrastructure change.

Use the awake protocol for future local comparisons and retain every attempt, including power-confounded collections. The original problem is not resolved by merely increasing request timeouts or attributing wall-clock spans to the database. [EVIDENCE.json](EVIDENCE.json) inventories the delivered files; [CLEANUP.json](CLEANUP.json) records scoped teardown of the owned stack and private build/credential files.
