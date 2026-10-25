# OutClass performance — Phase 9

RESULTS_PENDING

Baseline Phase 8 `febb9cfd40b29d8e175a8d7c0c10fc6245f57dbe`; audit reference `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. Local branch `codex/performance-phase9-20261025` reuses the attached managed worktree. No production infrastructure, schema/index, dependency, security policy or publication change.

## Implemented experiment

A parameterized metadata JOIN replaces the recognized scalar application/round/user/profile relation fan-out. It selects the same explicit scalar allowlist, preserves missing profiles with a left join, and maps native PostgreSQL types back to the original metadata shape. The complete guarded predicate must match a strict schema: club, non-draft status, optional application/round, anonymous-round restriction and authorized gender selection. Any unknown/nested/additional predicate uses the exact original Prisma reader; SQL failures propagate rather than retry with a different scope.

The new query runs inside the existing freshly guarded Repeatable Read transaction. Page planning, canonical privacy projection, JavaScript locale filtering/order, facets, cursor binding and bounded selected-applicant review/assignment hydration are unchanged. Review/score-dependent queries retain the complete canonical fallback. Ranking remains O(N); a join is not SQL keyset paging. Per-applicant child collections and global facets can grow.

Every actual GET retains remote identity verification, live session/revocation, account enablement, current membership/capabilities, suspension/support restrictions, anonymous review and voting snapshot protections. Private no-store/Cookie handling and Demo isolation remain. Query values are parameters, never SQL fragments. There is no successful authorization cache, new client cache, additional speculative GET or change in source authority rotation.

The query shape follows the installed Prisma 6 API, rather than adopting the current default v7 examples. [Prisma 6 raw-query guidance](https://www.prisma.io/docs/orm/v6/prisma-client/using-raw-sql/raw-queries) documents bound template values and PostgreSQL type mapping. The current Supabase changelog was checked; the November TLS cipher removal does not affect this loopback HTTP experiment. No provider settings changed.

## Verification

TESTS_PENDING

New regressions verify complete predicate recognition, bound injection-shaped values, unknown-scope fallback, optional-profile/null mapping and error propagation without a second read. The native comparison runs against both clubs, anonymous/non-anonymous and archived/non-archived round metadata, draft/submitted applications, profiles/missing profiles, gender predicates, foreign IDs and nested fallback scopes. Synthetic native cases roll back; test failure diagnostics do not dump returned application bodies. The existing concurrent-update test now intercepts the metadata JOIN and still proves one Repeatable Read snapshot plus freshness on the subsequent HTTP request.

The initial test loader compared duplicate selector objects by identity; it now compares their structure. The CRM fixture also lacked PostgreSQL's explicit nullable score fields; it now models actual null values. The native fixture initially used a gender value rejected by the existing database constraint; the fixture was corrected without changing the constraint. Sanitized failure logs are retained separately from final verification. No application or authorization behavior was changed to satisfy them.

## Measurement protocol

The direct baseline is Phase 8, not the Phase 7 resident-list design. Cold means first target visit in a fresh browser context with a warmed server. Initial/detail primary groups retain BA/AB blocks, one warmup and five measured outcomes per path/condition/build/block (n=10, nearest-rank p95=max). Separate constrained initial groups use one warmup and three measured outcomes per block (n=6, p95=max). Warm page/search groups retain one warmup and five measured outcomes per block (n=10).

Constrained CDP conditions are 80ms request latency, 200,000B/s download, 93,750B/s upload and 4× browser CPU slowdown. The HTTP supplement retains 1/2/4-reader bursts, one warmup and five measured waves per build/block/level, with a nominal 25ms aggregate same-role PostgreSQL sampler. The per-client pool limit stays eight. These local desktop/loopback conditions do not establish hosted or mobile performance, multi-user saturation safety or isolated pool-only wait.

Source preparation and all timed traffic, failed/pending transports, script/task/heap observations and every planned warmup/outcome remain separate. No forced garbage collection or product loading delay is used. Complete accepted intervals require a passing read-only power audit with temporary awake assertions; interrupted sets are retained/excluded whole. Loader timings are separate from HTTP/browser latency. Pilot loader results are excluded from accepted comparisons.

## Results

TABLES_PENDING

## Recommendation and remaining risks

RECOMMENDATION_PENDING
