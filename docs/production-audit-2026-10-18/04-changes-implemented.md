# Changes implemented and validation

## Current release update

The [rollout-blocker report](rollout-blockers/README.md) records the now-published compatibility artifact, its exact patch/source hashes and cloud connection check. Migration `20261019175843_outclass_auth_session_view` is applied in production; no credential or connection binding changed. Canonical source separately adds the fresh inherited web-login proposal, dedicated runtime URL precedence, invoker-view session queries, atomic grant checks and strict release preflight. Role creation/grants/Storage changes remain unapplied pending the owner-only prerequisite. Validation: 1,255 default passes/35 skips, 44 real integration passes, 126 native passes, 57-migration replay, build/typecheck/lint. Earlier audit-only/local-only sections below are historical.


## Local remediation update

The [session replay batch](session-revocation/README.md) changes `utils/auth.ts`, adds `lib/auth-session.ts`, focused failure/cache tests and a real captured-cookie suite. Existing authorization/upload mocks are updated to model candidate sessions and the new query; permission assertions remain. The reserved runner includes replay checks and reapplies its candidate role after inverse testing for those checks. All 37 real integration cases, production build, typecheck and lint passed. No migration, provider policy, dependency, UI, credential or production change is included; before/after aggregates, default-suite counts and source hashes are retained with the batch.

The [signup privacy batch](signup-privacy/README.md) changes `actions/onboarding.ts` and verification copy, expands the provider-response regression matrix, and includes real signup/browser checks in the reserved runner. Twenty-nine integration tests and 1,237 default tests pass. No migration, dependency, RLS, credential or production setting change is included.

The next [runtime-role batch](runtime-role/README.md) adds review-only access/inverse SQL, a guard compatible with the old and narrowly scoped candidate Storage policy, a reserved restricted-role HTTP fixture, permission/lock/Storage/rollback regressions and a deterministic browser clock setup. It passed 25 real tests; production changes remain unapplied. Only the fixture mirrors existing public table ownership/function grants; the proposal does not transfer provider table ownership or add BYPASSRLS.

A later real browser check also reproduced overcounted interview coverage: retained availability from declined/unconfirmed participants was included in capacity lists. Both coverage projections now require confirmation, with a draft/confirm/decline regression and exact-count browser checks. Assignment validation already rejected unconfirmed participants.

Application/dependency changes have now been implemented after the read-only audit. [The remediation report](remediation/REPORT.md) lists each changed file group, rationale, regression evidence, operation-count comparison, release gates and rollback constraints. It supersedes the “unchanged application” scope for the current working tree. Production, credentials, schema, RLS, Storage and firewall remain unchanged. The sections below preserve the historical Stage A change record.


This stage added audit reports, reproducible local probes and redacted evidence only. **Application code, UI, dependencies, lockfile, migrations, production data, credentials, grants, RLS, Storage settings, firewall and deployments are unchanged.** No vulnerability is claimed fixed and no performance gain is claimed. This preserves the requested read-only diagnosis before remediation.

## Added files

| File/group | Purpose |
|---|---|
| `README.md` | Entry point and prioritized staged remediation plan |
| `01-data-correctness.md` | Feature coverage, correctness evidence and explicit gaps |
| `02-security-assessment.md` | Ranked findings, affected code, evidence and fix/verification status |
| `03-performance-report.md` | Production field/function metrics, safe plans, local benchmarks and proposed budgets |
| `04-changes-implemented.md` | Change scope and validation record |
| `05-outstanding-risks.md` | Remaining tests, access/approval gates and operational work |
| `data-flow-map.md` | Page → component → server → operation/tables → authorization map |
| `schema-inventory.md` | Live table/relationship/index/RLS inventory and migration reconciliation |
| `generate-inventory.cjs` | No-network TypeScript AST inventory, source hashes and operation/guard references |
| `scan-secrets.py` | Read-only reachable-history/current-client scan; emits locations/classes, never matches |
| `verify-account-projection.cjs` | Real HTTP/Auth/Prisma/Postgres disclosure reproduction, restricted to reserved local onboarding fixture |
| `evidence/*` | Catalog metadata, counts, plans, advisory results, metrics, build/test results and reproduction outcomes |

All paths above are within `docs/production-audit-2026-10-18/`. The starting working tree was clean; the audit creates this directory only. No database migration was proposed as an executable release artifact or applied. The report describes candidate hardening work and its rollback requirements; it must first be implemented/tested on a separate staging/local environment before production approval is requested.

## Commands and results

| Command | Result / evidence |
|---|---|
| `node --test --test-concurrency=3 tests/*.test.cjs` | 1,228 passed, 30 skipped; [tests.tap](evidence/tests.tap) |
| `npm run test:migrations` | Passed fresh + legacy replay of 56 migrations / 78 application tables; [migration-tests.txt](evidence/migration-tests.txt) |
| `npm run lint` | Exit 0; 26 pre-existing warnings; [lint.txt](evidence/lint.txt) |
| `npm run typecheck` | Exit 0; [typecheck.txt](evidence/typecheck.txt) |
| `node scripts/run-onboarding-e2e.cjs` | 14 passed; includes isolated production build; [onboarding-e2e.txt](evidence/onboarding-e2e.txt), [build.txt](evidence/build.txt) |
| `node scripts/test-decision-publication-local.cjs` | Passed additive upgrade and 65 native test cases; [native-concurrency.txt](evidence/native-concurrency.txt) |
| `node scripts/run-availability-e2e.cjs --audit` | Isolated build and initial fixture checks passed; later heading/navigation timeout; cleanup passed; [scheduling-e2e.txt](evidence/scheduling-e2e.txt) |
| `node scripts/performance-audit.cjs` | Failed on stale service mock; recorded rather than repaired during diagnosis |
| Same script `--profile-only` | Failed on `.ts`/`.tsx` loader resolution |
| Same script `--directory-only`, `--applicant-only` | Passed; isolated synthetic/mock timing, not remote latency or speedup |
| `npx --yes pnpm@10.17.1 audit --json` | Returned five advisories (3 High, 2 Moderate); no install/lockfile update |
| Three added local audit scripts | Inventory/secret scan completed; account probe reproduced M1; syntax checks recorded at final verification |
| Supabase catalog/advisor/plan/count reads | Read-only transactions with statement timeouts; no individual student records returned |
| Vercel project/firewall/metrics reads | CLI access succeeded; connector scope request was denied. No config was changed. |

Local tests created synthetic identities/records in reserved disposable projects and native fixture databases only. Native runner removed its dedicated container; Supabase runners stopped their own fixture stacks. Existing user development/announcement stacks were not operated on. The native fixture deliberately disables outbound provider mail; onboarding mail is captured locally. The account probe prints booleans and HTTP status, not fixture credentials or template contents. Some local fixture configuration/backups remain in the runners' OS temporary directories according to their existing retention behavior; these were not copied into reports.

The host runs Node 26.9.0 while Vercel uses Node 24.x. This limits environment equivalence. The Vercel production deployment was inspected, not rebuilt or redeployed. The local builds retain `.next-publish` isolation from existing `.next`/development builds. Dependency scan and Vercel commands used versioned temporary CLI invocations because pnpm/vercel were not installed as standalone commands.

## Later implementation acceptance criteria

For the account projection: prove internal Club properties absent for student/member responses and RSC bootstrap, preserve member capability/navigation fields, maintain organization switching, keep dedicated recruiting template reads authorized and functional.

For dependencies: verify both direct and Next-relative Sharp resolution, exact lockfile paths, audit result, Linux artifact build and raster/PDF/image workflows. Avoid claiming the unpatched braces advisory resolved.

For performance: record matched before/after operation traces and client payloads. A passing build alone does not establish gains; production field verification follows approved deployment.

For database/credential changes: produce an additive patch, verify all table/function/auth-session privileges with the intended runtime role, test migrations on populated fixtures and document exact rollback. No credential rotation, production SQL or aggressive WAF blocking is authorized by the existence of this report alone; the user's explicit production approval requirement still applies.
