# Assigned-room batching — October 23, 2026

The assigned-room navigation reader now batches personal grants, current approving-owner checks, minimal personal record fields and enabled colleague names in sequential groups of at most 128 bookings. The original authorization transaction, locks, live identity/session checks, membership/capability/suspension checks, anonymous projections and exact interview-opening guards remain in place. There is no successful-authorization cache, additional database concurrency, dependency, schema/index change or production configuration change.

The corrected real Auth/database audit confirms **170 → 32 total database statements per read**, an 81.2% reduction, with identical serialized room projections. The controlled local comparison supports a lower warm median. It does **not** establish a reliable tail-latency improvement or production capacity. Keep this change reviewable and undeployed until broader, more stable workload verification.

## Source and security

The audit reference remains `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. This continuation compares frozen current HEAD `a3c36e0e8a3c50ab6be02a0080e66e0a9c597904` against that same HEAD with only `actions/interview-entry.ts` and `utils/interview-collaboration.ts` overlaid. All subsequent committed application changes are preserved. Physical comparison of 887 application/configuration/assets files confirms those two differences; the hydration wrapper is identical in both builds. Source hashes and build IDs are in [PROTOCOL.json](PROTOCOL.json).

The bulk and single-booking approval functions share the same scope validation. A published slot still requires the matching version ID, club and round and a currently active, enabled approving owner; it never falls back to legacy room approval. Legacy panels still use the intersection of approved and current room members. Every batch queries exact application/round pairs for the current member and club. Record reads select only IDs, completion and anonymity fields, rather than private draft/question bodies. Colleague names remain restricted to that booking's panel, active/enabled members and identified openable entries. All maps live only within the current transaction.

Mutations, exact URL validation and voting authority are unchanged. The existing GET handler, private `no-store`, Cookie-sensitive response handling, Demo separation, support-session restrictions and remotely verified live-session checks remain the authority. Native tests verify a list read queued behind a grant revocation sees the revocation after the club lock is released. A database-backed published-panel regression verifies that removing legacy approval does not remove published authority, while revoking the personal grant removes the candidate immediately.

## Navigation experiment

The existing harness uses one unchanged fixture: 64 club members, 100 applicants, three owner-attested rooms, 24 sequential booked candidates, four independently verified reviewers and 96 live grants. Each application Prisma client has a local connection limit of eight. These are legacy owner-attested room panels; published-panel behavior is covered separately by database tests, not by this performance cohort.

Both production builds and all other tests launched by this task finish before collection. The predeclared randomized order is **AB | BA | AA | AB | BA**: A is batching, B is unchanged HEAD. Each block has one fixed warm-up wave per condition and five measured waves, each with four clients. There are 320 primary observations, 80 separate same-build-control observations and 80 warm-ups. Cold means a fresh browser with an already running server/database. No failed warm-up retries, load-based exclusions or outlier trimming occurred. The [analysis plan](ANALYSIS_PLAN.json) was registered before collection.

All **480 navigations** render all 24 authorized interview links with zero browser, HTTP or transport errors. Every observation has complete body counters. The table uses the 80 primary observations per build/condition. Latencies are p50 / p95 in milliseconds; counts and bytes are medians.

| Metric | Before B | After A |
|---|---:|---:|
| Cold click to useful content | 593.5 / 713.2 | 513.5 / 631.2 |
| Warm click to useful content | 283.8 / 973.5 | 175.9 / 584.2 |
| Cold network completion | 566.1 / 693.0 | 490.9 / 605.9 |
| Warm network completion | 262.5 / 940.7 | 149.1 / 559.7 |
| Cold browser requests | 8 | 8 |
| Warm browser requests | 3 | 3 |
| Cold encoded body bytes | 44,027 | 44,021 |
| Warm encoded body bytes | 3,960 | 3,960 |
| Cold assigned-room database phase | 110.11 / 174.44 | 43.37 / 76.69 |
| Warm assigned-room database phase | 122.53 / 282.79 | 35.95 / 165.65 |
| Cold assigned-room total server time | 229.87 / 321.65 | 155.27 / 270.74 |
| Warm assigned-room total server time | 240.79 / 633.95 | 127.44 / 482.33 |

Cold request count p95 is eight and maximum nine in both builds; warm is always three. The six-byte cold bundle difference is not an optimization claim. The read returns the same content, so batching does not reduce HTTP requests or warm payload size. These results add to the historical Phase 1 request reduction rather than replacing its audit-reference comparison.

The registered 10,000-draw hierarchical paired bootstrap resamples the four AB/BA pairs, then matched wave clusters, retaining four participants per wave. A minus B descriptive 95% intervals are:

| Condition | p50 difference | p95 difference |
|---|---:|---:|
| Cold | −154.9 to +8.9 ms | −166.6 to +33.0 ms |
| Warm | −209.8 to −1.0 ms | −1048.5 to +228.6 ms |

The warm median improves in each of the four pairs, but the p95 worsens in two. The last pair also has a higher cold median after batching (578.3 versus 551.4 ms). The separate same-build AA warm p95 moves from 297.1 to 162.3 ms with no application change. Median CPU busy by measured block ranges from 35.88% to 65.15%, with peaks reaching 100%. No other tests/builds from this task ran during collection, but the host is shared. These observations limit causal attribution; they do not justify dropping slow samples or attributing every tail change to host load. Full distributions and per-pair results are retained in [COMPARISON.json](COMPARISON.json).

Identity verification remains a substantial unchanged cost: warm assigned-room identity p50/p95 is 83.08/262.14 ms before and 82.70/318.51 ms after. Transaction acquisition is 1.28/8.06 versus 1.30/9.14 ms; it includes transport/BEGIN and is not an exact pool-queue measurement. No acquisition improvement is claimed. Serialization is 0.44/1.61 versus 0.48/0.93 ms; this change targets repeated reads, not serialization.

The same-role backend sampler peaks at nine in every block, including the idle Prisma client left by the initial query audit. Eight is the application limit **per client**, not a global database cap. There are zero sampled lock waits and zero retained fixed-code counts for P2024, P2028 or ETIMEDOUT. Sampling can miss short waits and does not establish absence of saturation at a larger workload. [POOL_SUMMARY.json](POOL_SUMMARY.json) and [DIAGNOSTICS.json](DIAGNOSTICS.json) contain sanitized aggregates only.

## Query accounting correction

The initial [query audit](QUERY_AUDIT.json) recorded 168 before and 30 after statements for the action's Prisma client, with identical serialized room projections on every call. Real Auth still ran, including one remote identity verification per call. Its relative `./prisma` import created a separate real client, so the event listener missed its live-session and account SQL. Those initial counts are retained unchanged and are **not total request SQL counts**. The accounting gap and extra idle connection are documented in [QUERY_AUDIT_SCOPE_CORRECTION.json](QUERY_AUDIT_SCOPE_CORRECTION.json).

A separate [fresh-fixture query-only follow-up](../assigned-room-batch-2026-10-23-query-correction/QUERY_AUDIT.json) uses the same application hashes and redirects both Prisma import forms to one real observed client. It runs after navigation collection, so it cannot change those timings. Across twenty measured calls per build, total statement count is always **170 before / 32 after**, including live-session/account SQL and BEGIN/COMMIT. Every call remotely verifies identity once and returns an identical serialized projection within that fixture, at 17,137 bytes. Sequential outside-Next p50/p95 is 66.65/92.01 ms before versus 30.31/41.41 ms after; these are descriptive query-audit timings, not an independent browser-latency experiment. No SQL, parameters, credentials or room payloads are exported; only statement type/table, durations, byte counts and projection digests are retained. Its 58 real Auth/browser checks pass again; its private fixture is also removed.

## Verification and next phase

The ordinary suite passes **1,332 tests**, with 37 gated skips. The three separately executed native security/concurrency suites pass. All 57 existing migrations pass fresh/legacy checks, with RLS and browser-role denial on all 78 application tables. Both production builds pass. The real production-build Auth/browser run passes **58 tests**: 38 Auth/onboarding, 17 GET/navigation/settings and three active-reviewer/revocation checks. The final focused run passes 11 batching/protocol/analyzer tests, including the additional anonymous-completion authority case added after the broad run. Type checking passes; changed-file lint is clean and full lint has 22 existing warnings. See [TEST_RESULTS.json](TEST_RESULTS.json) and [TEST_RESULTS.log](TEST_RESULTS.log).

Initial regression development exposed gaps in synthetic test fixtures: missing membership suspension fields and missing SQL-adapter relation/empty-OR/array-membership support. These fixture errors were corrected and all affected tests pass. No application authorization rule was relaxed to make tests pass. The initial query-accounting limitation is preserved explicitly above.

The implementation provides a concrete reduction in repeated database work and supports a lower local warm median. HTTP count, payload size, identity latency and acquisition latency did not improve materially from batching; no such improvement is claimed. Tail latency remains uncertain, and four concurrent reviewers with 24 legacy bookings do not represent a sustained production workload.

Recommend retaining the bounded batching for review, then verifying published schedules, mixed rounds/completed/anonymous records, larger cohorts, sustained concurrency and mobile/slow-network navigation on a more stable test host. Obtain correlated production traces before selecting another bottleneck or considering an infrastructure experiment. Preserve live verification throughout. The earlier unclassified control warm-up timeout remains a historical unresolved risk; it did not recur in this study. No automatic merge or deployment is authorized or performed.

The [two-file implementation diff](BATCHING_IMPLEMENTATION.diff), [complete supporting code/test diff](FOLLOWUP.diff) and [hashed evidence manifest](EVIDENCE.json) are available for review. Both studies' private applications, test containers, credential files and archived checkouts were removed. Unrelated local stacks remain untouched.

Reproduce the navigation comparison with `node scripts/navigation-crossover.cjs --assigned-room-batch --out=<new active-workload directory>` and then `node scripts/summarize-navigation-crossover.cjs --out=<same directory>`. The corrected standalone query check adds `--query-audit-only` and uses a separate new output directory. All runners reject occupied reserved ports, existing fixtures and evidence overwrites and remove only their own disposable resources. The final reusable runner includes the query-accounting correction; the original study's uncaptured Auth-client counts and extra idle connection remain documented rather than silently rewritten.
