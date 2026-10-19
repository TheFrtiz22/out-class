# Restricted runtime role — local staging, October 19, 2026

**Superseded candidate:** the [rollout-blocker report](../rollout-blockers/README.md) documents the new fresh-login/invoker-view proposal and 44-case real run. The SQL files at this path now describe that revised candidate; the older 25-case evidence below applies to its historical source hashes. Auth schema USAGE is no longer requested. Policy management is delegated through supautils; the actual remaining hosted capability is UPDATE-column delegation for the preserved session lock. The additive view migration and compatibility application release are live, but this role/grant cutover remains unapplied.


Baseline: `4dae299`. **Nothing here has been applied to production.** This is a reviewed local candidate, not an automatically deployed migration. [Exact access SQL](access-proposal.sql) and [inverse SQL](rollback.sql) are deliberately outside Prisma's migration directory.

**Subsequent compatibility gates:** the [ordinary-session batch](../session-revocation/README.md) now requires the candidate's three-column session SELECT on every authenticated request and passed all 37 real integration cases with this role. Confirm the actual runtime identity/grants before releasing that application patch. Source review also found `app/api/auth/student-claim/route.ts` querying `auth.users`/invitation-token columns, which this candidate deliberately denies. That legacy path was not covered by this fixture and must be refactored/tested through a provider-supported capability before credential cutover. Do not expand Auth-user/token grants to bypass it. The exact SQL here is unchanged and remains review-only.

## What the new evidence establishes

Read-only catalog queries against OutClass (`htlgjluegmdwfjkzzwic`) confirm that `outclass_production_app` currently has no Auth/Storage schema usage, no session column privileges and no Storage object SELECT. It has no superuser, BYPASSRLS, database/role creation or replication attribute, cannot read migration history and is not a member of postgres. `auth.sessions` has RLS, no policies and retains its `supabase_auth_admin` owner. Storage tables retain their `supabase_storage_admin` owner. See [catalog evidence](production-catalog.json).

Changing only the connection binding would therefore break administrator elevation/support session checks and club image assignment. The earlier request-associated postgres observation remains a finding; this catalog check does **not** identify the actual role of an individual deployed invocation. Older reports about a bounded release are historical and do not establish today's binding.

The candidate grants the server role:

| Capability | Limit |
|---|---|
| Read live provider sessions | Only `id`, `user_id`, `not_after`; no refresh-token keys/counters, MFA factors, IPs, user agents or Auth users/passwords |
| Lock a live session with the existing `FOR SHARE` query | UPDATE ACL only on `updated_at`; permissive USING plus a separate restrictive `WITH CHECK(false)` policy deny actual updates, including when another permissive UPDATE policy is added |
| Verify an uploaded club image | Only `bucket_id` and `name` on `storage.objects`, only `club-assets` rows; all other buckets and object writes deny |

PostgreSQL applies UPDATE policies to SELECT FOR SHARE and requires UPDATE permission. A SELECT-only grant cannot preserve the existing revocation lock. The false write check is evaluated for updates, while the USING expression allows locking. See [PostgreSQL 17 CREATE POLICY](https://www.postgresql.org/docs/17/sql-createpolicy.html). A real concurrent operator DELETE timed out behind the runtime shared lock; every tested runtime session mutation failed and the row stayed identical. No lock was removed or replaced with a stale read.

The Storage restrictive guard remains TO PUBLIC, with one exception for the exact database `CURRENT_USER` `outclass_production_app`. Column ACLs and a separate SELECT policy still constrain that role. Browser roles retain the original denial; provider-owned tables, existing browser grants, bucket privacy, other bucket policies and service-role behavior remain unchanged. The application accepts the exact old or candidate guard expression so a reviewed release can precede SQL and remain compatible with rollback. It still requires the matching restrictive bucket policy and enabled RLS.

No SECURITY DEFINER function, table ownership transfer, BYPASSRLS, broad Auth SELECT, session write capability, browser access or secret is added by the proposal. Application tables remain owned by the server role and bypass their unforced RLS as before: this is runtime/operator separation, **not per-student RLS isolation**. Application permission checks and the separately privileged Supabase service key remain security boundaries.

## Verification

`npx --yes --package=node@24 -- node scripts/run-onboarding-e2e.cjs --runtime-role`

This provisions only the reserved local project on ports 3107 / 55321–55327. Migrations and fixture setup use the local operator; all four application DB variables use the generated bounded role URL for the actual Next production build/server. Test configuration stays in a mode-0600 temporary file. The mode removes its stack/backup and temporary credential/key files after completion. The normal development and announcement stacks are untouched.

**25 tests passed, zero failed/skipped** in the final real run ([output](e2e.txt)):

- Existing complete onboarding: signup/confirmation/resend, actual TOTP elevation, claiming, roster import, invitations, direct action permission denials, recovery and session revocation.
- Account HTTP/RSC isolation, dedicated template-reader authorization and native notification snapshot parity.
- Actual runtime identity/role attributes; migration history, schema creation, Auth users/secrets and unselected columns denied.
- Session shared-lock concurrency; INSERT/UPDATE/DELETE denied, including an attempted `updated_at` update and an added permissive UPDATE policy.
- Private upload/assignment/read through real Next actions and Supabase Storage; foreign/anonymous preview and browser insert/update/delete denied; a real unrelated headshot object hidden from SQL runtime.
- Exact inverse SQL, baseline grants/guard restoration, reapplication and second inverse; application checker compatibility with the original policy.

The local bootstrap mirrors already-existing production public-table ownership and 16 runtime function EXECUTE grants. These are **fixture setup only**, not additions in access-proposal.sql. Initially the restored fixture lacked those conditional grants and carried an incompatible old Storage index definition; a failed first run is retained as [setup diagnostics](initial-run.txt). A fresh reserved stack used the Storage service's matching C-collated current-version index, and all scenarios passed. No provider index repair is proposed for production. An initial inverse attempt also exposed a harness revision mismatch while the candidate policy list was being completed; final forward/inverse SQL were tested together unchanged.

The first broad regression run exposed an existing browser-clock race (`pauseAt` attempted to rewind time under scheduler delay). The test now pauses at a future point **before** the editor mounts, preserving the exact debounce assertions. The focused rerun passed. See [validation manifest](validation.json) for the final broad suite and other checks.

The final default suite passed **1,236 tests, 32 fixture-gated skips, zero failures**. The new SQL-backed Storage readiness test accepts the exact old/candidate predicates and rejects broadened predicates, mismatched WITH CHECK, changed roles and disabled RLS. Typecheck passed; lint retained 26 existing warnings and zero errors. The Next production build and the separate 25-case real run are distinct from the default-suite skips.

One inspected CLI startup log emitted disposable local credentials. It was redacted; no such log/configuration is included here. The reserved stack/backup and temporary credential/TLS-key files were removed. No production credential was read into output or rotated.

## Production rollout proposal and remaining gates

The user's audit brief requires explicit approval before production database/RLS/credential changes. This local run is not that approval. Before requesting execution approval, finish these gates:

1. Identify the exact active deployment and effective application DB binding using `utils/prisma.ts` precedence (`POSTGRES_PRISMA_URL` before `DATABASE_URL`), without exporting values. Capture controlled connection identity. Preserve pooler mode/host/TLS/connection budgets; do not infer credentials from query statistics.
2. Replay the forward/inverse SQL and application on an approved hosted preview/staging database with the production provider versions and operator permissions. Local setup used `supabase_admin`; the live MCP operator is postgres, non-superuser, without inherited Auth/Storage owner privileges. Provider-specific DDL authority has **not** been demonstrated. Do not transfer provider table ownership or grant elevated role membership to make SQL run. Stop and use an approved provider-supported operator path if needed.
3. Confirm a secure usable credential for the existing runtime role. Its password was neither retrieved nor changed. If unavailable, propose a separate explicit credential provisioning/rotation action. Preserve the previous working binding securely for rollback.
4. Review the application artifact, then explicitly approve the narrowly scoped SQL, target environment/binding changes and canary deployment. Production cutover changes the application's effective runtime URL(s); migration commands continue receiving a separate operator DATABASE_URL from their approved secret context. Never bind an operator secret into the web runtime merely for migrations. The local fixture overrides all DB aliases defensively; that is not a directive to replace every production variable indiscriminately.

After those gates and explicit approval, the sequence is:

1. Deploy the compatible application guard first, using the current working binding. Verify safe account headers and private image flows.
2. Re-read catalog preconditions, verify all application tables/functions remain usable by the intended runtime and browser roles cannot assume it; apply the exact forward SQL in its bounded transaction. Its baseline checks abort on differing grants/policies instead of overwriting an unknown state. Verify catalog/negative cases safely.
3. Bind the tested runtime credential for a reviewed canary, then run authenticated account, elevated Admin/support, image, publication/worker and scheduling smoke checks. No production test records or outbound email are authorized by this document; use approved fixtures or safe read-only observations.
4. Observe authentication/permission errors, worker outcomes, pool contention and latency before promotion. This test adds no measured page-speed improvement and does not prove full worker/scheduling coverage under this new provider policy configuration; those are staging/canary gates.

Rollback order: restore the previous working secret binding and compatible artifact first, verify it, then execute the exact inverse transaction. The inverse revokes only the new grants and restores the original Storage predicate. Both directions were exercised locally; no data deletion or password change is involved. Do not revoke the old credential during the observation window. Re-run privilege/write-denial checks after provider upgrades because this proposal introduces custom Auth policies.

Sources reviewed: [Supabase custom Prisma connection guidance](https://supabase.com/docs/guides/database/prisma), [RLS behavior](https://supabase.com/docs/guides/database/postgres/row-level-security), [current Postgres upgrade notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes), [HTTP TLS notice](https://supabase.com/changelog/cbc-tls-ciphers-deprecated). The generic Prisma guide's BYPASSRLS/CREATEDB example was not applied. Production is 17.6; the local fixture uses 17.11. No production database upgrade is included.

## Source scope

Application change: `utils/club-asset-storage.ts` only. Fixture/check changes: `scripts/run-onboarding-e2e.cjs`, `tests/helpers/onboarding-e2e.cjs`, `tests/helpers/runtime-role-fixture.cjs`, `tests/runtime-role-e2e.test.cjs`, `tests/club-assets.test.cjs`, `tests/autosave-browser.test.cjs`. Audit reports/evidence are updated separately. Concurrent workspace/breadcrumb/settings edits present in the shared workspace were left untouched and are not attributed to this batch. No package, lockfile, interface icon, application table or Prisma migration change is included.
