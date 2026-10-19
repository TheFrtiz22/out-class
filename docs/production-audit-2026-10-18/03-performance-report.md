# Performance report

## Local remediation update

Communications snapshot base operations are reduced from **four to two per tick**, preserving notification counts, revision hashes, legacy conversation authorization and disabled-account rejection. Both migrated SQL fixtures and actual native Prisma checks verify the new helper. This is a 50% operation-count reduction for that helper, with no page-load, cost or production latency improvement claimed. The complete synthetic performance harness also runs after repairing stale mocks. [Before/after scope and current checks](remediation/REPORT.md) distinguish these local results from the unchanged production field baseline below.


Stage A baseline, 2026-10-18. **No performance improvement is claimed.** There is no deployed or local application optimization in this stage, so “after” is not measured. Historical production metrics span multiple deployments and may include staff/QA traffic. They establish a problem worth profiling, not its sole cause.

## Production baseline

Vercel CLI 64.5.0 queried production metrics for a seven-day window, rounded by the service to 2026-10-11 20:00 UTC through 2026-10-19 00:00 UTC (October 11 at 4 p.m. through October 18 at 8 p.m. Eastern). Summary percentiles come from Vercel's summary, not an average of time-bucket percentiles. Source schemas, queries, summaries and time series are preserved in [evidence](evidence/). The current Ready production deployment inspected during the audit matches commit `03571d5d2275f2899373193a7cd2fbb404a3eb73`; the seven-day aggregate is not restricted to that deployment.

| Route | LCP p75 | LCP observations | INP p75 | CLS p75 | Function duration p95 | After |
|---|---:|---:|---:|---:|---:|---|
| `/` (public and personal views share this route) | 4,422 ms | 237 | 72 ms | 0.0005 | 3,254 ms | Not measured |
| `/club/[clubId]/workspace` (many sections combined) | 7,668 ms | 136 | 648 ms | 0.0400 | 3,860 ms | Not measured |
| `/login` | 3,352 ms | 44 | 128 ms | 0.0013 | 2,680 ms | Not measured |
| `/signup` | 14,924 ms | 16 | 256 ms | 0 | 2,226 ms | Not measured |
| `/platform` | 3,788 ms | 38 | 40 ms | 0 | 2,851 ms | Not measured |
| `/settings/availability` | 3,712 ms | 1 | 56 ms | 0.0014 | 2,445 ms | Not measured |
| `/api/workspace` | — | — | — | — | 4,594 ms | Not measured |

LCP observations are not INP sample counts. Rare-route percentiles, especially the settings row, are weak evidence. No per-user, organization or raw request-path identifiers were exported. More routes are available in [lcp.json](evidence/lcp.json), [inp.json](evidence/inp.json), [cls.json](evidence/cls.json), [vital-samples.json](evidence/vital-samples.json), [function-duration.json](evidence/function-duration.json) and [function-ttfb.json](evidence/function-ttfb.json).

The broad workspace read endpoint's function TTFB p95 is 4,628 ms; club-workspace TTFB p95 is 3,860 ms. These combine action/read types and auth/provider/database latency. Add low-cardinality operation labels before concluding that a particular feature such as applicants or dashboard takes that long.

Communications SSE has p95 function duration 47,912 ms and p95 TTFB 913 ms. The long duration is largely intentional: the stream lives around 45 seconds, then reconnects. It is not a 48-second response-to-first-content metric. The seven-day aggregate records 10,796 SSE invocations, 15,121 workspace reads and 19,007 club-workspace function invocations. These are invocations, not unique students. Status aggregation includes 204 HTTP 500 and one HTTP 503; route/error/time correlation remains outstanding. See [http-status-counts.json](evidence/http-status-counts.json).

Four safe unauthenticated spot checks returned expected status codes: homepage 200, account 401, dashboard workspace read 401, unauthenticated notification worker 401. Measured end-to-end wall times from this machine were 195.86–393.48 ms. These single warm requests cannot substitute for p95 production traffic or authenticated page timing; see [safe-production-http.json](evidence/safe-production-http.json).

## Database evidence

Safe read-only EXPLAIN ANALYZE/BUFFERS queries used catalog-selected club/user IDs without exporting them. These are base-query equivalents, not the full Prisma relation/auth cost. Each is a single observation on a small current population; some selected clubs had no matching rows.

| Query pattern | Execution | Planning | Rows returned | Observation | After |
|---|---:|---:|---:|---|---|
| Notification list, limit 51 | 3.150 ms | 11.462 ms | 12 | User index + bitmap heap + small in-memory sort | Not measured |
| Non-draft club applicant base | 3.206 ms | 13.750 ms | 0 | Sequential scan removed 22 rows; not evidence of a missing-index bottleneck | Not measured |
| Member directory base | 0.259 ms | 7.038 ms | 0 | Small sequential scan/sort; 29 filtered rows | Not measured |
| Due scheduled communications, limit 20 | 0.255 ms | 7.520 ms | 0 | Existing status/scheduledAt index used in both OR branches | Not measured |

Plans and exact safe SQL: [query-plans.json](evidence/query-plans.json). No writes, ANALYZE maintenance, indexes or statistics resets were performed.

Lifetime pg_stat_statements is more suggestive of lock/round-trip amplification than large scans in these samples:

- An advisory-lock query shape accumulated approximately 4,634 seconds over 17,883 calls (259 ms mean); relation locks include Club shapes with up to 8.26 and 10.48 seconds maximum. These are historical, mixed-role/traffic measurements, not an active-lock proof or a known association of that advisory query to one exact call site.
- Conversation revision reads appeared about 223,760 times, with ~0.06 ms mean database execution. Related inbox aggregate/count shapes have comparable call counts and ~0.05 ms mean execution. Their individual CPU cost is small; network/function/pool amplification can still be substantial.
- Live database counters showed 18 connections and zero recorded deadlocks at capture. Cumulative temp bytes and rollbacks have no route attribution and must not be labeled application defects without correlation.

See [query-statistics.json](evidence/query-statistics.json) and [database-diagnostics.json](evidence/database-diagnostics.json). Stats reset/collection periods differ from the seven-day Vercel window. Query text, bind values and student data were not exported.

The advisor reports 59 foreign keys without covering indexes and 25 unused-index notices. These are candidates for workload review, not a migration list. Keep indexes supporting integrity, infrequent administrative actions and upcoming semester peaks until representative query plans and write costs justify changes.

## Application and frontend findings

**P1 — Broad bootstrap plus heavy client workspace.** `app/layout.tsx` loads the populated account; `app/page.tsx` also loads dashboard applications/meetings and then profile/launch data. `getCurrentUser` and the account API duplicate full application/membership/Club loading. This has a verified disclosure defect as well as avoidable payload potential. The current local production build reports 499 kB First Load JS for club workspace, 382 kB signup, 341 kB profile settings, 334 kB login and 226 kB homepage, with 105 kB shared. These are Next build estimates, not measured browser execution/hydration time. The inspected Vercel workspace function bundle is 84.72 MB. Root output tracing includes PDF assets on every route; measure cold-start/bundle attribution before narrowing it.

**P2 — Global scheduling serialization.** `utils/panel-publication.ts:6` takes one fixed advisory lock across the platform. Room booking, legacy booking and publication use it to preserve cross-club scheduling safety. Historical lock waits warrant profiling, but blindly removing/sharding this lock can reintroduce overlapping appointments. Measure waits, then design ordered per-user/round locks with native simultaneous cross-club tests if justified. Preserve correctness over speculative concurrency.

**P3 — Polling does work even for retired messaging.** `app/api/communications/stream/route.ts:35` polls every two seconds; `lib/communications-snapshot.ts` executes four operations per tick, including historical conversation revision despite direct messaging actions being disabled. One connected tab therefore schedules about 120 base operations/minute before reconnection/auth overhead, assuming steady 2-second ticks; actual rate is slower by query duration. Measure visible/hidden-tab behavior, connection duplication and poll count, then batch lightweight inbox state and remove only verified obsolete revision dependencies. Keep notification latency and revocation behavior as explicit acceptance tests.

**P4 — Unbounded relation loads and notification enrichment.** `crm.getClubPipeline`, organization directory and task workspaces load full club datasets/relations; `getStudentDashboardData` loads all visible meetings and answers/bookings. Add stable pagination and select narrower fields only after confirming features relying on complete counts and grouping. Notification list page size is bounded at 50, but per-item live context enrichments can still amplify queries (some assignment contexts are memoized). Instrument actual query counts rather than counting one Prisma include as one SQL statement.

**P5 — Existing performance harness is stale.** Full `scripts/performance-audit.cjs` fails on unmocked `@/utils/revoke-club-invitations`; profile-only mode fails resolving a TSX component as `.ts`. Current working subsets measured directory grouping with 250 synthetic clubs/5,000 events (median 3.083 ms, p95 3.815 ms) and applicant display under injected 5 ms query latency (median 11.475 ms, p95 16.620 ms, one member read). These are controlled local CPU/mock measurements, not production speedups. Repair the harness before relying on its broader claims.

**P6 — Middleware/Auth/provider costs need traces.** Most page requests refresh provider user in middleware and then resolve identity again in RSC; request-scoped React cache avoids some repeats inside rendering but does not unify middleware and RSC. Workspace GET and Server Action middleware shortcuts already delegate auth to their handlers. Profile provider/DB spans before expanding shortcuts; never trust a client-supplied identity header.

## Targets and verification contract

Core Web Vitals release targets: LCP ≤2,500 ms, INP ≤200 ms, CLS ≤0.1 at p75. Separate mobile/desktop and public/authenticated views; require enough samples and preserve cold/slow network cohorts. Current workspace LCP/INP miss the targets; CLS meets the target in the observed aggregate.

Provisional authenticated data targets, measured end-to-end at p95 with declared fixture sizes and auth included:

| Feature | Baseline availability | Initial target |
|---|---|---|
| Dashboard initial data | Combined `/` + workspace metrics only | ≤1,500 ms |
| Club discovery | Current mock grouping only; production not separately labeled | ≤1,000 ms |
| Applicant list | Combined workspace API only | ≤1,500 ms for a 50-record page; counts accurate across all records |
| Application details | No isolated production span | ≤1,000 ms |
| Interview scheduling read | Combined workspace API; browser audit currently blocked | ≤2,000 ms; generation/publication separately budgeted |
| Settings reads | Sparse route samples | ≤1,000 ms |
| Common private workspace GET | Observed aggregate TTFB p95 4,628 ms | ≤1,500 ms warm p95, with cold-start cohort tracked |

These are proposed acceptance budgets, not measured feature-level baselines or promises about current behavior. Validate them against real fixture volume, pool capacity, network location and semester-peak usage. Capture query count/duration, response bytes, request count, CPU/hydration and time-to-useful-content for each operation before making an optimization claim. No client hydration/CPU, per-route network waterfall, mobile lab LCP or INP attribution was captured in this stage; those remain explicit profiling work.

For each later patch: pin deployment SHA and workload; take before/after under the same configuration; run isolation/regression tests; compare p50/p95 database and endpoint latency plus payload/query count; re-check field metrics after approved deployment. Roll back if authorization, correctness, error rate or tail latency regresses. Do not report production gains from the mock benchmark or from comparing different seven-day deployment mixes.
