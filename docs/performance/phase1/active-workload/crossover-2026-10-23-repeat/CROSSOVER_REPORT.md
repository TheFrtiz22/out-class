# Hydration wrapper: current-HEAD crossover

October 23, 2026. Frozen source: `97db164e133809ab2852d7ebcc946b2e92ef1d4f`. Audit reference remains `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. No production application code changed in this continuation; the deliberately unfixed control existed only in a disposable private checkout.

The earlier 69% warm p95 increase **did not repeat at that magnitude** when isolating the hydration wrapper at current HEAD. Medians are effectively unchanged. A smaller warm-tail increase remains uncertain; this study does not establish performance equivalence or another speedup.

## Design and source scope

Variant A is current HEAD with the hydration correction. B uses the same immutable source with only the wrapper import and JSX changed back to the original div. All 888 tracked application files were compared during the first preparation: only `app/layout.tsx` differed. The repeat uses the same Git object, transformation and matching layout hashes. Server identity, session, account, membership, capability, suspension, support, anonymity and voting authorization statements are unchanged.

Both builds finish before collection and use the same database, four independently verified accounts, 64-member club, 100 applicants, 24 bookings, three owner-approved rooms, 96 live grants, URL and per-Prisma-client pool limit of eight. Each harness invocation signs in normally; session history grows rather than being reset. Successful authorization is never cached between requests. Fixture grant/approval checks run before reuse, and security tests finish before fixture creation.

The seed and order were saved before collection: `AB | BA | AA | BA | AB`. Every block has one fixed warm-up wave per condition, then five measured cold and five measured warm waves with four users. The four AB/BA pairs supply **320 primary observations**, 80 per variant/condition. AA supplies **80 separate same-build observations**. All **80 warm-up observations** are retained outside the primary timing distributions. Cold denotes fresh browsers with warm server/database; the readiness/paint proxy and three-request dispatch limit are unchanged.

[Protocol](PROTOCOL.json) · [registered analysis plan](ANALYSIS_PLAN.json) · [comparison](COMPARISON.json) · [evidence and tests](EVIDENCE.json) · [tooling diff](CROSSOVER.diff).

## Completed comparison

| Metric | Cold: control B → fixed A | Warm: control B → fixed A |
|---|---:|---:|
| Click to useful content p50 / p95, ms | 516.1 / 547.3 → 517.1 / 536.4 | 182.5 / 196.9 → 182.0 / 216.7 |
| Network completion p50 / p95, ms | 491.3 / 517.6 → 493.5 / 512.7 | 153.8 / 166.1 → 154.4 / 186.9 |
| Visible GET TTFB p50 / p95, ms | 99.66 / 186.68 → 103.19 / 189.33 | 81.69 / 155.01 → 84.03 / 160.72 |
| Visible GET server total p50 / p95, ms | 91.30 / 175.06 → 91.98 / 176.27 | 76.52 / 148.51 → 79.56 / 155.09 |
| Requests, median | 8 → 8 | 3 → 3 |
| Completed response-body bytes, median | 44,033 → 44,026 | 3,957 → 3,957 |
| Browser / HTTP / transport errors | 0 / 0 / 0 → 0 / 0 / 0 | 0 / 0 / 0 → 0 / 0 / 0 |

All primary observations have complete body counters and all 24 interview links. All 480 observations in the complete repeat, including AA and warm-ups, pass those content and error checks. The seven-byte cold bundle difference is not a performance claim. Request counts remain Phase 1's eight cold / three warm, compared with the original active-room audit's 15 / 10; today's experiment isolates the wrapper, not the full Phase 1 implementation.

The registered 10,000-draw hierarchical paired bootstrap resamples the four pairs and then matched wave clusters, retaining all four participants. Fixed A minus control B has descriptive 95% intervals:

| Condition | p50 difference, ms | p95 difference, ms |
|---|---:|---:|
| Cold | −12.1 to +15.9 | −28.7 to +13.4 |
| Warm | −1.4 to +1.9 | −13.3 to +46.9 |

The warm p95 point difference is +19.8 ms, about +10.1%; its interval includes zero and increases up to about 25.2%. The same A build's separate AA pair moves from 200.3 to 216.3 ms warm p95, a 16.0 ms increase with no code change. That shows ordinary variation but does not prove the A/B difference is noise. Four pairs are too few to rule out a meaningful smaller tail regression.

Full per-pair results and all server-phase distributions remain in the comparison JSON. Assigned-room warm database p95 is 91.56 ms in B versus 101.91 ms in A, and identity p95 is 69.57 versus 73.66 ms. These unchanged loaders still dominate the visible read barrier. Backend samples peak at eight connections in every block, with zero sampled lock-waiting backends. The 50 ms sampler can miss short waits and does not establish production capacity.

No other tests or builds launched by this task ran during collection. Aggregate system telemetry still shows a shared host: median CPU busy per block ranges from 25.7% to 29.9%, with varying load and free memory. These observations do not identify a causal resource bottleneck. A sanitized log watcher ran throughout the repeat; it records only fixed error-code counts, never messages, credentials, SQL, cookies or payloads.

## Incomplete first attempt and reliability

The [first attempt](../crossover-2026-10-23/PROTOCOL.json) is preserved separately. Its first six measured blocks contain 240 complete navigation observations. Two initial React 418 recoveries occur in B; A remains clean. During block seven's unmeasured warm-up, one control page did not become ready within the harness deadline. Four of eight warm-up observations were saved, and the study stopped before measured block seven. It is not presented as a completed crossover or pooled into the repeat's latency estimates.

That timeout is **unclassified**: the original snapshot did not retain request statuses or distinguish the two warm-up directions. New failure diagnostics retain only safe request names/statuses, pending-state flags, fixed DOM booleans and exact preparation stages. No application workaround was added for the timeout, and the repeat did not reproduce it.

Before the repeat, its changed warm-up failure policy was recorded: a failed fixed warm-up would be preserved without a retry; every measured block would still have to be complete. The same seed and order were reused with one fresh equivalent fixture, which remained unchanged throughout the repeat. In fact, all repeat warm-ups completed, so the revised rule admitted no failed or missing warm-up data. No busy-host samples, recovery timings or outliers were trimmed.

The two control recoveries corroborate the earlier deterministic replay regression; the clean complete repeat alone does not estimate a reduction in hydration-error rate. Keep the wrapper for its demonstrated initial-hydration correctness, without claiming a navigation speedup.

## Verification and recommendation

The existing full suite passes **1,325 tests with 37 gated skips**. Ten focused protocol, profile-guard, analyzer and diagnostic tests pass after the failure-diagnostic refinement; these include two analyzer tests added after the broad run began. Each study setup also passes all **38 real Auth/onboarding checks** against its private current-HEAD build. Both A/B production builds pass; changed-file lint reports zero errors or warnings. Prior 58-test production Auth/browser acceptance is recorded in the [hydration report](../hydration/HYDRATION_REPORT.md); this continuation changes only tooling/tests/evidence.

Both disposable projects, credentials, private checkouts and listeners were removed after their runs; unrelated local stacks were untouched. Original audit and benchmark artifacts remain intact. No dependency, production configuration, database region, schema, index, authorization behavior, merge or deployment changed.

Retain Phase 1 and its hydration correction for review. The earlier large latency increase is not reproduced in this more controlled current-HEAD study, but a smaller warm-tail cost and the first control timeout remain unresolved. Next, obtain production-like correlated traces and broader published-schedule/mobile/sustained-load coverage. The leading application optimization candidate remains scoped batching of assigned-room projections inside the existing live authorization transaction; do not replace live checks with cached authorization.

Reproduction uses the existing benchmark via `node scripts/navigation-crossover.cjs --out=<new active-workload directory>` and then `node scripts/summarize-navigation-crossover.cjs --out=<same directory>`. The saved seed can be supplied through `--seed=<32 hex characters>`. Today's plans were registered separately with `--plan` before collection; the final runner automates that same registration before building or collecting. The runner refuses occupied ports, existing reserved fixtures and output overwrites, and cleans up only its own disposable project.
