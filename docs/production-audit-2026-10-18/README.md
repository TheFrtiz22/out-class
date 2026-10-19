# OutClass production audit — diagnosis and local remediation

## Current release update

The [rollout-blocker batch](rollout-blockers/README.md) has released the compatibility application fixes and applied the additive security-invoker session-view migration in production (57 migrations). The legacy claim flow now uses an audit fingerprint and provider APIs. **1,255 default tests passed / 35 skipped; 44 real integration and 126 native checks passed.** The canonical restricted-login cutover is tested but unapplied: the hosted operator cannot delegate the session-lock UPDATE ACL. [Exact provider-owner prerequisite](rollout-blockers/provider-lock-grant.sql). Existing passwords and production connection bindings remain unchanged. Earlier local-stage notes below are historical release snapshots.


## Local remediation update

The [ordinary-session replay batch](session-revocation/README.md) reproduced an expired `not_after` session reading and updating account data with an unexpired JWT. The shared auth boundary now verifies the exact token and checks its live session/user/deadline. **37 real integration tests passed**, including captured-cookie denials and the existing restricted-role/onboarding/signup flows. This adds one SQL query per authenticated request and retains one Auth verification. Production remains unchanged; runtime session grants and a newly documented legacy student-claim incompatibility remain release/cutover gates.

The [signup privacy batch](signup-privacy/README.md) removes the explicit existing-account signup response and keeps the verification/sign-in UI uniform. **29 real integration tests passed**, including new/existing desktop/mobile journeys; the default suite passed 1,237 tests with 33 fixture-gated skips. Provider endpoint/timing enumeration remains a separate risk. No production release or setting change occurred.

The next batch stages [restricted runtime credentials and permissions](runtime-role/README.md): **25 real HTTP/Auth/SQL/Storage tests passed** with the built application connected as `outclass_production_app`, including actual write denials, session locking and forward/inverse SQL. The exact SQL is review-only; controlled live identity, hosted staging/operator compatibility, secure credential provisioning and explicit production approval remain gates. Production is unchanged.

The first implementation batch is documented in [the remediation report](remediation/REPORT.md). The account template disclosure is fixed in local HTTP and RSC with real role/tenant tests; account responses consistently use private/no-store. Next, Sharp and source-map-js are patched locally; the registry scan now has one remaining build/lint braces advisory. Communications snapshots use two database operations instead of four, with native Prisma hash/count parity. Staffing coverage now excludes declined/unconfirmed snapshots, and scheduling retains its round/week state during URL changes. The complete desktop/mobile scheduling journey passed; the default suite passes 1,235 tests with 31 fixture-gated skips, alongside 20 real onboarding/account and 65 native checks. Production has not been deployed or modified; the Stage A sections below describe the original baseline.


Read-only diagnosis and prioritized remediation plan, October 18, 2026. Source baseline: `03571d5d2275f2899373193a7cd2fbb404a3eb73`; inspected production deployment `dpl_ACP3hPuvfDeEPYQ2RBgXHDhNd73c` matched that commit. No application, dependency, database, credential, firewall or deployment change was made. Local synthetic fixtures were used for invasive tests.

The audit found a verified account-response disclosure, vulnerable dependency resolutions, broad production database privileges and significant measured frontend/API latency. It did not demonstrate a cross-student application read or establish universal correctness. Performance gains and security fixes are pending implementation and verification.

## Five reports

1. [Data correctness](01-data-correctness.md) — feature coverage, sources, multi-role fixtures, live integrity checks and gaps.
2. [Security assessment](02-security-assessment.md) — ranked findings, affected code, evidence, remedies and verification status.
3. [Performance baseline](03-performance-report.md) — production field/function metrics, database plans, local benchmarks and targets; no after-change claims.
4. [Changes implemented](04-changes-implemented.md) — audit-only additions, executed checks and unchanged production scope.
5. [Outstanding risks](05-outstanding-risks.md) — remaining tests, operational controls, approval gates and rollback requirements.

Supporting maps: [page-to-database data flow](data-flow-map.md), [live schema inventory](schema-inventory.md), [source operation inventory](evidence/source-inventory.json).

## Key evidence

- **Database:** 78 application tables plus migration bookkeeping; 56 migrations present live. All application tables have RLS enabled and all public tables deny effective browser-role CRUD. Production Prisma still needs independent authorization: request-associated query statistics point to the BYPASSRLS `postgres` role. Four migration checksum differences are exactly LF/CRLF differences; none is a missing migration.
- **Confirmed disclosure:** ordinary `/api/users/me` responses include internal `Club.decisionLetterTemplates` through full relation includes. Reproduced over actual local HTTP/Auth/Prisma/PostgreSQL with two schools and overlapping memberships. Other students' applications remained excluded.
- **Dependencies:** registry scan reports 3 High and 2 Moderate advisories. Next resolves Sharp 0.35.4 even though the direct application dependency resolves patched 0.35.5. Runtime exploitability was not tested; the vulnerable resolution is verified.
- **Field performance:** seven-day club-workspace p75 LCP **7.668s**, p75 INP **648ms**; homepage p75 LCP **4.422s**. Aggregate workspace API function TTFB p95 **4.628s**. These span releases/sections and require per-operation profiling before causal claims.
- **Tests:** default suite **1,228 passed / 30 skipped**; **14 real onboarding HTTP checks passed**; **65 native publication checks passed**; all migration replays, typecheck, build and lint passed (26 lint warnings). Scheduling browser audit failed on an outdated navigation expectation; broad performance harness also fails on stale mocks. Neither failure is hidden by the passing checks.

## Prioritized remediation plan

| Order | Stage / proposed change | Required evidence before release | Production gate / rollback |
|---|---|---|---|
| 1 | **B:** patch both Sharp resolutions; update source-map-js and the compatible Next security patch | Lockfile/actual resolution, rescan, Linux build, image/PDF/auth/regression checks | Reviewed application release; retain a known patched artifact. Track unpatched build-only braces separately. |
| 2 | **B:** shared allowlisted account Club projection in RSC + account API, aligned client types | Real HTTP/RSC absence checks for student/member; allowed recruiting editor; organization switching and all existing features | Application patch; no database change needed. Revert independently while retaining redaction if a feature contract fails. |
| 3 | **B:** establish minimum runtime role separate from migration credentials | Exact required grants/auth-session/function/storage paths; native tests with intended role; pooler/TLS limits; reviewed canary | **Explicit production credential/permission approval.** Restore prior secret binding + compatible artifact if needed; no silent rotation. |
| 4 | **E prerequisite:** repair scheduling/performance audit harnesses; add native exclusive-slot race and session-replay cases | Full real scheduling journey; two independent connections; expected allow/deny and idempotent outcomes | Local/staging only until green. Do not alter UI simply to satisfy the old test. |
| 5 | **C:** investigate lock waits before indexes | Operation traces, actual wait attribution; representative populated fixtures; correctness-preserving lock design if necessary | Any production database change requires proposed SQL, measured plans/write overhead and explicit approval. Keep existing safety locks until replacements are proven. |
| 6 | **D:** narrow bootstrap/pipeline/task loads, remove verified redundant polling work, profile client bundle | Before/after same workload: query count/time, response bytes, endpoint latency, network/hydration and UI behavior | Small reversible patches; confirm field metrics only after approved deployment. No shared private-data cache. |
| 7 | **B/C:** function ACL/search_path and historical CHECK hardening; compatible bucket limits | Staging trigger/migration replay; zero violation prechecks; existing file compatibility; precise inverse changes | **Explicit production DB/RLS/Storage approval.** No destructive migrations or data deletion. |
| 8 | **B/operations:** uniform signup responses, secret scoping, leaked-password protection, targeted abuse budgets | Auth/recovery UX, provider settings, shared-campus traffic observations, log-only WAF review | No aggressive blocking without approval. Preserve immediate log/disable rollback. |
| 9 | **E:** second-university release gate and broader optional suites | Two-domain Auth/identity/club/application tests; file visibility; switching; complete regression coverage | Keep expansion gated until policy is explicit and tested. Existing live population is one school. |
| 10 | **F:** approved release and production verification | Deployment SHA; safe allow/deny smoke checks; error/queue/lock metrics; enough field samples; restore/rollback runbook | Obtain release approval after concrete patches and tests are reviewable. No deployment performed during this audit. |

Stages are ordered by demonstrated risk. They are a plan, not completed remediation. Database index advisor notices alone are insufficient to justify migrations. Security-sensitive production work must have a tested exact patch and rollback before approval is requested.

## Evidence and reproduction

The [evidence directory](evidence/) contains redacted catalog definitions, aggregate counts, query plans, advisor results, production metric summaries, test/build logs and local probe outcomes. It contains no exported student records or usable credentials. The secret scan found only a localhost placeholder URL; its scope and limitations are recorded.

Rebuild the static source inventory with `node docs/production-audit-2026-10-18/generate-inventory.cjs`. Run `python3 docs/production-audit-2026-10-18/scan-secrets.py` for the bounded, no-match-output scan. The account disclosure reproduction requires the reserved local onboarding fixture and isolated `.next-publish` artifact produced by `node scripts/run-onboarding-e2e.cjs`; its script asserts local fixture scope and never uses hosted connection configuration. It records the existing defect rather than serving as a fixed-behavior regression test.

Read [the coverage boundaries](05-outstanding-risks.md#coverage-boundaries) before using these results as a release gate. A passing build does not resolve the confirmed disclosure, dependency findings, skipped native cases or measured field performance failures.
