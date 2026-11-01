# Staging migration-history security remediation — November 1, 2026

## Result and scope

**Fixed on staging** `omfcozcbpmevwolshibh` (`outclass-staging`). Project identity and Active/Healthy status were verified through the Management API before writes. Current Security Advisor named exactly `public._prisma_migrations` in `rls_disabled_in_public`. All other 93 public tables already had RLS enabled. This was a current finding, not an inference from the October 17 email.

Applied only `20261101160000_private_prisma_migration_history`. The existing 60 ledger rows/checksums were verified against source and preserved; Prisma registered the actual verified SQL as the 61st entry. Staging's unrelated pending `20261029190000_voting_guarded_undo` was **not** applied. No production migration, application deployment, data reset, deletion or core credential rotation occurred.

## Confirmed access path and cause

The Prisma-created ledger had RLS disabled, no policies, and explicit ALL grants to `anon` and `authenticated`. PostgREST exposes `public,graphql_public`; both browser roles had schema USAGE and effective SELECT/INSERT/UPDATE/DELETE privileges on the ledger. An anonymous Data API `GET .../_prisma_migrations?select=id&limit=0` returned HTTP 200 with an empty array. Read-only `SET LOCAL ROLE anon` and `authenticated` SELECTs with `WHERE false` also succeeded. These deliberately returned no stored records. The effective write grants establish a configuration vulnerability; no remote pre-fix insert/update/delete was attempted to demonstrate it.

Repository security migrations protect application tables, while Prisma's separate tracking table was not covered. No earlier migration contains a ledger fix. This does **not** establish whether anybody previously accessed or changed migration history; no exploitation conclusion is made.

## Fix and compatibility

The forward-only SQL enables ledger RLS, revokes all PUBLIC/anon/authenticated table grants, and adds restrictive browser-role policies with both `USING (false)` and `WITH CHECK (false)`. The policies remain defensive if permissive policies or grants are accidentally introduced later. No application-table policy, ownership, FORCE RLS, Auth, Storage or Data API configuration changes were made. The SQL skips an absent ledger in isolated SQL-only rehearsals rather than manufacturing migration history.

The owner remains `postgres`; its existing trusted access and service-role grants are preserved. The bounded staging application role `outclass_interview_rehearsal` cannot read/write migration history, as intended. Application code uses the server Prisma connection (`utils/prisma.ts`) and does not query `_prisma_migrations`; browser club membership does not grant metadata access. Authorized members, outsiders and cross-club users are all denied this browser table path. No club-specific allow policy belongs on migration history.

Normal owner-operated Prisma migration deployment was rehearsed on disposable native PostgreSQL: Prisma created and registered this migration, then applied a later synthetic migration and repeated deployment successfully. The native cluster was stopped afterward. A NOINHERIT Supabase CLI operator must explicitly assume the owning role for SQL. For staging registration, the established exact-SQL/catalog-verification then `prisma migrate resolve --applied` procedure was used. Its bounded operator received temporary ledger grants and a role-specific temporary RLS policy for registration only; that policy and newly added grants were removed in `finally`, restoring its previous grants. Its expiring login was issued through the existing CLI mechanism; no working database password was reset. Future bounded non-owner registration helpers must similarly handle RLS, not grant browser access or disable it.

## Verification

- Current Security Advisor after the fix: **zero `rls_disabled_in_public` findings**. All **94 public tables** have RLS enabled. Other pre-existing advisor categories were preserved and are outside this fix.
- Actual restricted database contexts: `SET LOCAL ROLE anon` and `authenticated`, each denied SELECT, INSERT, UPDATE and DELETE with **permission denied**. Mutating probes used rollback-only transactions, DEFAULT VALUES without required IDs or `WHERE false`; no existing rows could be changed. An initial read-only write probe was rejected for transaction mode, correctly excluded as permission evidence, then replaced by rollback-only restricted-role probes.
- Actual anonymous Data API GET/POST/PATCH/DELETE: **HTTP 401 / SQLSTATE 42501**. GET used limit zero; update/delete targeted an impossible synthetic ID; empty insert payload cannot produce a valid ledger row. No remote synthetic migration records were inserted.
- Owner/service access retained; no FORCE RLS; bounded application ledger access denied. A read-only restricted application-role `Club` query with `WHERE false` still succeeds. This is a backend access smoke check, **not** a full staged sign-in or applicant-workflow browser test. No new independent authenticated Supabase browser sessions or cross-club UI walkthrough is claimed. The role-wide table denial is independent of JWT club membership.
- Every unrelated public table's owner, RLS flag, ACL and policies match the pre-fix snapshot. All original ledger rows checked before registration remained unchanged; registration added only the actual new migration. No application data DML was part of the migration.
- Two focused PGlite regressions pass: original exposure, browser CRUD denial, defense against restored permissive policies/grants, owner CRUD/history preservation, safe repeat and missing-ledger behavior.
- Full disposable fresh/legacy migration rehearsal: **62 migrations**, all **79 application tables** private. Native PostgreSQL actual Prisma deploy, subsequent migration and repeat pass separately.
- Repository lint passes with **zero errors / 22 existing warnings**; type checking passes. No application source or Prisma model changes; a production application build is not needed to validate this SQL-only staging change.

## Production read-only observation

Separately verified `htlgjluegmdwfjkzzwic` through the project API, then queried only this table's catalog/privileges using the read-only endpoint. Its ledger also has RLS disabled, but PUBLIC/anon/authenticated grants are already revoked; both browser roles have **no effective CRUD privilege**. It is not the same confirmed grant exposure as staging. A future separately authorized rollout can apply this reviewed migration for RLS defense and advisor compliance. No production records, settings, grants, policies or migration history were modified. No production Data API exploit probe or historical-access audit was performed.

## Recovery and retained evidence

This changes access metadata only, under a five-second lock timeout, without a data rewrite. Private pre-fix catalog/ACL and original ledger snapshots are retained. Recovery should repair the authorized migrator's role/policy narrowly or use the existing owner-operated migration path; **do not restore public grants or disable RLS**. There are no synthetic staging records to remove and no temporary registration policy left. Preserve all original history.

Sanitized receipts, exact SQL checksum, restricted-role/API results, native rehearsal and private registration logs: `C:\Users\arden\AppData\Local\OutClass-staging-verification\staging-rls-20261101`. Credentials are absent from Git and console output.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Security Advisor API](https://supabase.com/docs/reference/api/v1-get-security-advisors), [PostgREST configuration API](https://supabase.com/docs/reference/api/v1-get-postgrest-service-config).
