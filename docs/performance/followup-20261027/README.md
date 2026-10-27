# Followup after the ready subset reached main

The independently ready font/logo subset is merged as `06d3e93110d09fc564de7e28cf7dc3a71f081fe4` through [PR #85](https://github.com/TheFrtiz22/out-class/pull/85). All 12 hosted PR jobs passed. Read-only Vercel inspection confirms the exact commit is **Ready / Production**, with the current custom domain. The broader Phase 2–15 branch remains separate. This followup introduces **no application change** and makes **no new speedup claim**.

The new diagnosis retains all 160 constrained browser outcomes and 3,657 Auth HTTP observations. The previous 4.2-second identity stall did **not** recur: HTTP maximum is 313.84ms and workspace identity maximum is 323.12ms. This does not explain or invalidate the original adverse row. Phase 14/15 application experiments remain rejected.

## Findings

| Observation | n | p50 / p95 / max ms |
|---|---:|---:|
| Auth HTTP create→body complete | 3,657 | 26.30 / 58.52 / 313.84 |
| HTTP create→send | 3,657 | 0.033 / 0.881 / 25.40 |
| HTTP send→headers | 3,657 | 26.09 / 57.93 / 313.61 |
| Existing gateway upstream header | 3,657 | 25 / 54 / 310 |
| Existing gateway proxy header | 3,657 | 0 / 1 / 17 |
| Separate provider log duration | 3,657 | 24.74 / 53.28 / 308.41 |
| Workspace identity, unique traced request | 1,540 | 30.35 / 67.04 / 323.12 |
| Identity minus completed Auth HTTP | 1,540 | 0.332 / 0.884 / 5.62 |
| Observed GC entry duration | 467 | 1.35 / 4.78 / 17.35 |

Most observed identity waiting aligns with gateway upstream time. The signed stage differences are descriptive gaps with different boundaries, not exclusive SDK CPU or pure network time. Provider log records have no exposed response UUID join; their duration distribution is a separate aggregate despite equal record counts. No headers or provider configuration were changed to manufacture a join. Auth HTTP failures/incomplete snapshots/missing gateway timings: **0/0/0**; provider user responses: **3,657 status 200**.

The installed Auth SDK's explicit `getUser(token)` branch calls the remote user endpoint without waiting on its session-initialization lock. `utils/auth.ts:26` already uses that branch. SSR also disables auto refresh and initialization. Removing locks or replacing remote verification cannot be justified by this evidence. The request's fresh SQL session/revocation check still follows remote identity verification.

Maximum sampled app-role connections/active/idle-in-transaction are 9/4/1; Auth-role 3/3/0. No sampled lock waiters. One app-role IO waiter was observed. The configured limit is eight per client; role aggregates include multiple clients/monitor/background activity, so nine aggregate connections do not show a limit violation. Event-loop maximum single histogram delay is 555.22ms, while the largest per-window p95 is 20.12ms and utilization 0.717. These process windows do not attribute exclusive request CPU or prove there were no brief stalls. Container maxima: Auth 71.3% CPU, DB 228.28%; memory about 38.4MB/195.5MB. None establishes production capacity.

## Browser observations — instrumented diagnosis only

Four sequential batches contain five cold and five warm visits per path: 20 per path/condition, 160 total. No application variant or before/after pair. Cold means destination-cold browser contexts with warm local Next/Auth/database services. Production build, synthetic 1,000 applicants, desktop Chromium 1440×1000, CDP 80ms latency / 200,000B/s down / 93,750B/s up / CPU 4×. Source and click waits remain separate. Instrumentation adds overhead and excludes this run from primary performance results.

| Path | Cold p50 / p95 / max ms | Warm p50 / p95 / max ms | Median click requests cold / warm |
|---|---:|---:|---:|
| Overview→Settings Profile | 461.0 / 483.7 / 490.6 | 148.3 / 156.0 / 157.2 | 9 / 1 |
| Overview→Meetings | 445.5 / 463.4 / 465.5 | 125.6 / 135.7 / 142.0 | 7 / 1 |
| Recruiting→Scheduled Decisions | 440.0 / 454.4 / 467.1 | 143.5 / 156.3 / 165.4 | 4 / 1 |
| Settings Application→Review | 596.3 / 680.0 / 727.7 | 266.2 / 282.1 / 282.3 | 8 / 4 |

All 160 useful-content outcomes completed. Full request start/end/TTFB/transfer/body bytes/server-phase distributions, error/pending snapshots, source times, and exact file/index references are in [DIAGNOSTIC_SUMMARY.json](DIAGNOSTIC_SUMMARY.json). Missing bodies remain null and aborted/pending snapshots remain included. Raw browser rows are under `diagnosis-1/batch-*`; detailed correlated Auth observations are in `AUTH_HTTP_OBSERVATIONS.json`. They are referenced rather than embedded here.

The frozen plan/source/tool hashes and unchanged fixture pass boundary checks. Host controls and actual Sleep/Wake/DarkWake audit pass for 2026-10-27 14:07:30–14:22:29 UTC. There are no background/sampler failures. No builds/tests run during collection. Temporary awake assertions do not change persistent settings. Earlier preflight requests are excluded from this population.

## Hosted evidence and next decision

[HOSTED_OBSERVATIONS.json](HOSTED_OBSERVATIONS.json) refreshes regions: this ready production deployment still uses **Vercel iad1**, and Supabase is **us-west-2**, Postgres 17.6.1.166. The displayed production workspace route window reports 1.80s average / 2.38s p95 duration and 93ms average / 156ms p95 active CPU, with 733 displayed invocations. Exact latency sample size, p50 and maximum remain null. It is a rounded, moving, mixed-commit 12-hour window; it cannot measure PR #85 or correlate one protected click to a provider cause.

Continue with an isolated current-main selected-workspace startup integration: overlap only selected public module download with its existing private GET, retain fresh server validation, and fence stale Auth epochs/results. Measure code/data dispatch and source+click tails in a separate frozen before/after protocol. Do not import pagination, resident summaries or the rejected Review changes as part of that patch. Then diagnose Settings first-use and the fresh-page interaction contract independently. The historical identity tail remains unresolved, and regional/configuration/schema changes remain out of scope.

## Tooling, security and reproduction

New scripts `navigation-followup-server-diagnostics.cjs`, `navigation-followup-provider-events.cjs`, `navigation-followup-local.cjs` and `navigation-followup-study.cjs` are opt-in and refuse endpoints outside this owned loopback project. They export only fixed categories, non-sensitive UUIDs, numeric durations/status/resource counters, and allowlisted phase logs. No SQL, query values, actors, tokens, cookies, response bodies or arbitrary headers/messages leave the private fixture. Runtime/driver hashes in the protocol correspond to collection, before later analysis-only edits.

Use a separate worktree at the recorded `b83fe21` application tree. Follow `../phase15/REPRODUCTION.md` steps 1–3 for isolated signup/Auth/TOTP, replacing `phase15` with `followup` in private snapshot/backup markers. Refuse occupied owned ports/services and preserve all unrelated work. The builds marker is mode 600 and points to an existing mode-700 directory prefixed `outclass-followup-builds-`. Snapshot baseline with the lifecycle helper; seed and enrich the fixture to 1,000 applicants using the existing scale helper. Generate/verify the source manifest and provider image pin before collection. Never copy production environment files.

```sh
node --test tests/navigation-followup-diagnostics.test.cjs tests/navigation-phase15-diagnostics.test.cjs
node scripts/navigation-followup-local.cjs build
node scripts/navigation-followup-local.cjs snapshot baseline
# Use a new diagnosis-* directory; existing evidence is refused.
caffeinate -dimsu -t 3600 node scripts/navigation-followup-study.cjs --out=docs/performance/followup-20261027/diagnosis-new
python3 docs/performance/phase15/analysis/audit-power.py docs/performance/followup-20261027/diagnosis-new
python3 docs/performance/followup-20261027/analysis/summarize.py
```

The analysis script intentionally reads the accepted `diagnosis-1`; adapt that explicit input only in a new analysis artifact for a new run, preserving prior data. Verify full population counts, host/sleep controls, immutable inputs and independently recomputed quantiles before accepting a diagnosis. Provider units come from the [pinned Auth request logger](https://github.com/supabase/auth/blob/v2.197.0/internal/observability/request-logger.go) (`elapsed.Nanoseconds()`); gateway numeric headers are milliseconds with first-header boundaries described in [Kong proxying documentation](https://developer.konghq.com/gateway/traffic-control/proxying/). These spans overlap and must not be added.

Relevant application/security source remains unchanged. Normal fixture signup/Auth/TOTP provisioning passes 38 tests; the observer/driver suite passes 10 focused tests. Broader application tests from Phase 15 and the ready release remain scoped to their actual builds; they are not claimed as a new full-application run here. Evidence validation, privacy scan and eventual owned-resource cleanup are recorded separately. This branch remains diagnostic and unmerged.
