# Outstanding risks and operating plan

## Local remediation update

The [restricted-role candidate](runtime-role/README.md) passed 25 real Auth/HTTP/SQL/Storage tests and exact rollback/reapply. H2 remains open in production. The next gates are controlled deployment identity, hosted preview/provider/operator compatibility, remaining support/worker/scheduling smoke coverage, approved secret provisioning/binding and explicit production approval. Local `supabase_admin` success does not establish live postgres DDL authority over provider-owned Auth/Storage tables.

The account disclosure and patched dependency findings have local fixes and regression evidence; they await an approved application release. Account API cache/error handling is hardened. Communications polling is batched without removing legacy behavior. The full scheduling browser journey now passes, including fixes for confirmed-only coverage and round/week state. See [current remediation results](remediation/REPORT.md). Broad production database privileges, the unpatched build/lint braces advisory, second-domain policy, ordinary-session replay, optional/native coverage, field performance and operational controls remain unresolved. The table below retains the original Stage A priorities; use the remediation report for current local status.


The audit establishes concrete findings and a baseline; OutClass cannot yet be certified correct, fast or secure across every role/university. No remediation was deployed. See the [ranked assessment](02-security-assessment.md), [correctness coverage](01-data-correctness.md) and [measured performance](03-performance-report.md).

| Priority | Outstanding item | Closure evidence / gate |
|---|---|---|
| P0 remediation | Runtime Sharp 0.35.4 under Next; H1 | Targeted dependency patch; direct and nested resolution on Linux; advisory rescan; build/image/workflow tests; reviewed deployment/rollback |
| P0 remediation | Internal Club decision-template property disclosure; M1 | Shared allowlisted account projection + client type contract; absent fields in actual HTTP/RSC for unauthorized roles; authorized template editor still works |
| P0 operational | Broad runtime postgres role; H2 | Identify actual active runtime/migration URLs without exporting values; stage minimum role grants; full Auth/admin/support/storage/cron tests; explicit production credential/permission approval |
| P1 regression assurance | Scheduling browser audit fails before full scheduling flow | Repair old `tool=interviews` URL to select current `interviewTab=schedule` contract and update any changed expectations; rerun all dependent scheduling checks. Investigate any remaining failures as product defects. |
| P1 performance | Workspace p75 LCP 7.668s / INP 648ms; aggregate API p95 TTFB 4.628s | Per-operation trace/payload/client profile, first-load bundle attribution, then small independent patches with matched measurements |
| P1 integrity | Native simultaneous exclusive-slot and cross-club appointment races unverified | Two independent database connections; competing students, reschedules, revoked grants, overlapping memberships/panel commitments; exactly one eligible exclusive-slot winner; retry/idempotency checks |
| P1 access model | Second-university end-to-end isolation incomplete | Domain-aware sign-in/verified identity policy, club-school application rules, discovery policy, two-domain multi-role E2E. Live database currently has one school; do not infer cross-campus correctness from it. |
| P1 security | Additional dependency advisories; account enumeration; abuse coverage | Targeted patches where available; uniform signup outcomes; log-first rate budgets informed by traffic; no aggressive production blocking without approval |
| P2 database | Two historical checks NOT VALID; 41 mutable search_path notices; unnecessary trigger-function EXECUTE | Approved additive hardening, zero violation prechecks, staging replay and exact rollback scripts; re-run live advisors afterwards |
| P2 storage | Direct owner uploads lack bucket MIME/size limits; signed capability revocation window | Inventory existing formats/sizes without copying user content; stage compatible bucket limits; direct-provider negative tests and TTL policy |
| P2 sessions/caches | Ordinary captured-JWT replay; uniform no-store errors; complete cache invalidation matrix | Local logout/recovery/disable/role-revocation replay tests; response-header assertions for all branches; private cache multi-user tests |
| P2 operations | Backups/PITR, restore, rollback credential compatibility not established | Confirm plan/retention/encryption/ownership; restore into isolated environment; test data consistency and document measured recovery time; approved rollback rehearsal |
| P2 visibility | Mixed production HTTP 500s and missing request-level query/client attribution | Privacy-safe trace correlations by deployment/operation/status; classify auth denials vs outages; actionable alerts and response owner |

## Additional local observation

One fresh scheduling run emitted minified React 418 (HTML hydration mismatch) after its functional assertions. The next full fresh run and 27 focused desktop/mobile/time-zone hydrations were clean. The source remains unisolated, and the harness now logs page URL and stack while retaining its runtime-error assertion. See [the incident record](remediation/hydration-incident.json). Investigate in preview before treating rendering stability as fully established.

## Observability and alerts

Existing strengths: immutable audit records; structured admin failure codes/support identifiers; scheduler summaries/failure codes; durable notification/invitation intent with retry/lease fields; Vercel Analytics and Speed Insights installed in deployed layouts. Live worker snapshot showed zero scheduled intents overdue by five minutes and zero stale PROCESSING rows; one invitation delivery was queued and 16 notification deliveries were SENT. A queued row alone is not evidence of a stuck worker. See [worker-snapshot.json](evidence/worker-snapshot.json).

Remaining work: common account/asset handlers still log raw Error objects, and development Prisma query logging is enabled. Verify log sinks/retention and redact query/bind/request context before enabling detailed diagnostics. Do not log OTPs, passwords, cookies, bearer tokens, reset fragments, template contents, resume paths or unnecessary student identifiers. Keep public report data to route labels and counts.

Proposed low-cardinality telemetry: deployment SHA, opaque request/correlation ID, fixed operation name, status/failure class, duration, query count/time, response bytes and queue delay. Reuse existing admin support IDs rather than introducing incompatible identifiers. Avoid organization IDs/emails as metric labels. Use sampling and separate privileged audit from diagnostic logs.

Proposed initial alert set, tune after baseline collection:

- Unexpected 5xx rate above 1% for 10 minutes with at least 100 requests, or repeated critical loader/worker failures; exclude expected authorization denials and retain a low-volume critical-path alert.
- Due scheduled work older than five minutes, expired processing leases repeatedly unrecovered, delivery uncertainty/exhausted retries, or missed cron execution. Separate provider receipt reconciliation from safe automatic retry to avoid duplicate email.
- Sustained auth/elevation denial anomalies and invalid bearer requests; distinguish campus-NAT bursts from malicious actors before blocking.
- Authenticated API p95 above its operation budget and DB lock/pool wait growth; public field LCP/INP thresholds only once sample counts support interpretation.

These alerts were not configured. Each needs an owner, a dashboard/runbook, a recovery action and a notification destination authorized by the user.

## Production change and rollback requirements

No production approval is needed to read this report or implement/review local application patches. The requested approval gates apply before security-sensitive database/RLS/credential/migration changes reach production, before aggressive blocking rules, and before a separately authorized deployment.

For runtime credentials: preserve the currently working secret version in the approved secret store, add a separate tested runtime value, verify intended role/pooler/TLS/pool parameters and deploy a reviewed canary/preview. On regression, restore the prior binding and compatible application artifact; do not revoke the old credential until observation is complete. Never paste either value into a report or shell argument. Table-owner bypass remains part of this server-only design unless separately redesigned/tested.

For CHECK validation: precheck both violations again, set lock/statement budgets, validate each constraint separately, observe locks and abandon safely on timeout. Rollback of validation state, if required, is an approved transaction replacing the same CHECK expression as NOT VALID; do not delete rows or weaken the expression. For function ACL/path hardening: snapshot existing ACL/proconfig, change only enumerated functions and retain exact inverse ALTER/GRANT statements. Verify triggers, auth signup, storage/runtime-role access and migration replay first.

For dependencies/account projection: keep a tested prior artifact, but do not automatically roll back to a known vulnerable artifact. Revert the projection patch independently if a feature breaks while preserving redaction; roll back credentials only together with a compatible artifact. For WAF limits: log-only first, bounded by method/path; inspect shared-campus traffic, then approve enforcement and retain an immediate disable/log rollback.

## Coverage boundaries

The 30 default-suite skips remain visible. Separate runs exercised onboarding plus five publication-native groups; remaining optional suites include native full-interview/evaluation/collaboration, dedicated Admin/session workspace, private asset/event Storage, complete settings navigation, resume-import HTTP, recruitment/offer-native and scheduler release/polling combinations. A failing scheduling browser run does not become a pass because unit tests are green.

No authenticated production student session was used, no production mutation/concurrency/load test ran, no backups were restored, and no malicious payload/credential testing against production was performed. Current local client artifact scanning is not proof of all deployed bundles. Seven-day field metrics mix releases and may include QA; per-feature query/CPU/hydration/network measurements remain incomplete. PostgREST's full exposed-schema configuration, Auth rate-limit settings, session expiry configuration, backup retention and provider credential scopes were not independently retrieved. These are explicit follow-up items rather than assumed safe defaults.
