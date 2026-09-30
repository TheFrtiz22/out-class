# Repository-only database reconciliation — 2026-09-30

Status: repository changes validated; no migration or trigger SQL executed, including against a local database. Supabase remained read-only. No application data changed. No MCP permissions changed.

## Evidence and assumptions

Before modifying migration files, the user explicitly supplied and authorized reuse of the immediately preceding read-only Supabase MCP inspection for project `htlgjluegmdwfjkzzwic`:

- `supabase_migrations.schema_migrations` contains only `20260923181745 remote_schema`.
- `public._prisma_migrations` does not exist; none of the eight repository Prisma migrations is recorded as applied.
- All 14 baseline public tables exist. `User.disabledAt` exists as timestamptz; `User.passwordHash` is absent; the nine mapped indexes exist.

A read-only dashboard schema inspection during this task also showed `User.disabledAt` as timestamptz, no passwordHash, and the pre-capabilities ClubMember columns. No SQL was submitted through the dashboard. The supplied MCP results, rather than the historical schema dump, are the migration-state evidence. Absence of migration records alone does not prove absence of manually applied DDL; deployment must recheck the actual objects.

Assumptions: credentials continue to belong exclusively to Supabase Auth; required arrays default to empty (no permissions); collisions between an Auth ID and a different public ID require manual identity review, not automatic merging. Existing public-only User rows remain valid and untouched. Historical Supabase dumps/types and the applied remote_schema migration are retained as historical evidence, not treated as the current live schema.

## Files changed

| File | Change |
| --- | --- |
| `prisma/schema.prisma` | Removed User.passwordHash; disabledAt uses DateTime? @db.Timestamptz(3); mapped all nine existing indexes exactly once, including Meeting → Event; added ClubInvitation.permissions default []. |
| `actions/crm.ts` | Removed two obsolete student passwordHash omissions. |
| `actions/evaluations.ts` | Removed the interviewer User passwordHash omission. |
| `actions/platform-admin.ts` | Removed the user inspection passwordHash omission. |
| `app/api/users/me/route.ts` | Removed the current-user passwordHash omission. |
| `lib/anonymous-review.ts` | Removed the obsolete omission from the Prisma payload type. |
| `prisma/migrations/20260923000000_baseline/migration.sql` | Removed passwordHash creation, represented existing disabledAt as TIMESTAMPTZ(3), and added the nine existing index definitions for fresh installs. Never execute this baseline on the existing live tables. |
| `prisma/migrations/20260923010000_capabilities/migration.sql` | Added a catalog type guard: create disabledAt only when absent, preserve any existing timestamptz precision/values, raise on other types. ClubMember.permissions and ClubInvitation.permissions now use NOT NULL DEFAULT ARRAY[]::TEXT[]. |
| `prisma/migrations/20260924040000_member_tasks/migration.sql` | groups and requirements now use NOT NULL empty-array defaults; added BEGIN/COMMIT. |
| `prisma/migrations/20260925000000_platform_view_sessions/migration.sql` | Added BEGIN/COMMIT so failure rolls back this migration's database work. |
| `prisma/setup_auth_trigger.sql` | Explicitly rejects normalized email collisions with a different public ID; retains UVA validation, normalization, insertion using Auth ID, and same-ID email upsert. Never rewrites an ID. |
| `db_test9.js` | Retired unsafe email-based ID upsert experiment; now throws before opening any connection. |
| `db_test10.js` | Retired stale unsafe trigger installer; now throws before opening any connection and points to canonical SQL. |
| `tests/platform-admin.test.cjs` | Updated query expectations to verify authenticated ID lookup and absence of obsolete omit configuration. |
| `tests/database-reconciliation.test.cjs` | Added five database-free checks of generated User fields, mapped indexes, timestamp guard, arrays/transactions, and identity-preserving trigger SQL. |
| `docs/authorization.md` | Updated migration count and linked this database-specific deployment procedure. |
| `docs/database-reconciliation.md` | This evidence, file manifest, migration review, validation report, deployment proposal, and rollback procedure. |

Prisma Client was regenerated under ignored node_modules. The pre-existing untracked `.vscode/` directory was not modified. No replacement credential storage was introduced. The entire repository was searched for passwordHash before editing; application credential operations use Supabase signUp, signInWithPassword, resetPasswordForEmail, and updateUser. Remaining passwordHash references are historical Supabase artifacts and negative regression assertions.

## Review of all eight migrations

| Migration | Review and eventual behavior |
| --- | --- |
| `20260923000000_baseline` | Creates 14 tables, four enums, unique indexes, nine mapped indexes and legacy FKs on an empty database. Existing target must baseline by recording it as applied, without executing its SQL. disabledAt precision is a documented exception below. |
| `20260923010000_capabilities` | Preserves existing timezone-aware disabledAt. Adds capabilities and six tables; empty defaults backfill existing members before existing role-specific permission updates. Creates immutable audit trigger; enables RLS and revokes public/browser access. Requires a trusted server connection and schema/function creation privileges. |
| `20260924000000_club_claims` | Adds campus/directory/claim metadata and invitation decline time; backfills owner claim times and conditionally inserts three directory entries under a table lock. Keeps existing IDs/profiles. This contains intended future data backfills/inserts and must be reviewed in staging. |
| `20260924010000_anonymous_review_tests` | Adds review/test configuration, nullable ACT scores and check constraints. New defaults satisfy checks; existing SAT fields are unchanged. |
| `20260924020000_interview_kits` | Adds kits/records, access restrictions and conditional NOT VALID InterviewSlot.clubId FK. Existing orphan slots remain; future writes must satisfy FK. Does not validate or delete existing orphan rows. |
| `20260924030000_meetings` | Extends Event without renaming it; backfills audience from isPublic; adds constraints and token table with restricted access. IDs/attendance preserved. |
| `20260924040000_member_tasks` | Adds member groups and task requirements with empty defaults, automatically filling existing rows during ADD COLUMN; adds assignment/file relations and legacy assignee backfill. Now transactional. |
| `20260925000000_platform_view_sessions` | Adds isolated session table/index with RLS/revokes. Now transactional. |

ClubInvitation is created with a non-null empty default, so there are no pre-existing rows to repair. The other three array columns are newly added to existing tables; ADD COLUMN ... NOT NULL DEFAULT supplies their backfill. These are unapplied definitions, not general-purpose repair scripts for partially migrated databases. Unexpected existing feature tables/columns must stop deployment rather than be silently skipped.

Each migration is atomic, but the eight-migration sequence is not one transaction. Earlier successful migrations remain committed if a later migration fails. The separate Supabase remote_schema history is neither imported into Prisma nor replayed, edited, or removed.

## Validation

- Prisma 6.19.3 format: passed.
- Prisma validate: passed using an inert localhost URL solely to satisfy schema environment parsing; no database connection needed.
- Prisma generate: passed.
- `node_modules/.bin/tsc --noEmit --incremental false`: passed.
- `node --test tests/*.test.cjs`: 158 passed, 0 failed, 0 skipped; Auth/database calls in application tests use mocks.
- `npm run lint`: attempted, blocked by `eslint: command not found`. package.json has a lint script but no ESLint dependency/configuration. No unrelated tooling installation/change was made. pnpm itself is also unavailable in this shell.
- SQL behavior was reviewed statically; SQL was not executed. In particular, `tests/authorization-migration.cjs` executes DDL via PGlite and was deliberately not run. The five new checks are repository contracts, not a PostgreSQL migration rehearsal.
- Final git diff review and whitespace check cover all tracked changes; new report/test files were also reviewed. No live database test is claimed.

## Remaining ambiguities and deployment gates

1. Existing disabledAt is known to be timestamptz, but its precision is not established by the supplied results. Prisma specifies (3); the guard deliberately preserves an existing different precision. Catalog inspection must record atttypmod/datetime_precision. Do not auto-convert it to remove diff noise.
2. Existence of named indexes is established; verify their exact column order, uniqueness, predicate, method and validity before baselining. Application.studentId's single-column index is a distinct existing index even though the composite unique index begins with studentId.
3. Recheck all baseline column types/defaults/nullability, enum labels, unique constraints and FKs. Supabase-managed grants, RLS, triggers and Auth schemas are not fully modeled by Prisma. Historical dumps still mention passwordHash and must not override live evidence.
4. InterviewSlot FK validity/orphans require separate review. The later NOT VALID constraint preserves old rows; no automatic cleanup is proposed.
5. Public-only identities and normalized-email collisions remain unchanged. Trigger collision rejection can prevent signup for such an email; manually establish identity ownership before any separate remediation. This insert trigger does not synchronize later Auth email updates.
6. Full PostgreSQL execution, Supabase role privileges and trigger behavior still require a separately authorized staging rehearsal. Local checks cannot establish that the complete live schema is drift-free.

## Proposed deployment procedure — NOT EXECUTED

These commands are a future operator runbook, not authorization to run them in this task.

1. Freeze this reviewed revision. Create an isolated staging clone/snapshot of the specific live database, including public data, Auth identities, schema, functions, triggers, grants, RLS and migration metadata. Verify the backup can restore into an isolated environment. Disable application/jobs/signup traffic to staging during migration. Keep production disconnected from all rehearsal commands. Record the snapshot ID, old app revision, source project ID and staging project ID in the deployment log.
2. Use a direct/session database connection with migration privileges, not a transaction pooler. Set `STAGING_DATABASE_URL` securely and confirm its host/project is the staging clone. Capture the following read-only queries, plus a full schema-only dump/catalog comparison against the baseline:

```sql
SELECT to_regclass('public._prisma_migrations');
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;
SELECT column_name, data_type, udt_name, is_nullable, column_default, datetime_precision
FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User';
SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' ORDER BY tablename, indexname;
SELECT conrelid::regclass, conname, convalidated, pg_get_constraintdef(oid)
FROM pg_constraint WHERE connamespace = 'public'::regnamespace;
SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure);
SELECT id FROM public."User" WHERE email <> lower(trim(email));
SELECT lower(trim(email)), count(*) FROM public."User"
GROUP BY lower(trim(email)) HAVING count(*) > 1;
SELECT count(*) AS orphan_slots FROM public."InterviewSlot" s
LEFT JOIN public."Club" c ON c.id = s."clubId" WHERE c.id IS NULL;
```

Stop if any later-migration objects already exist or any unaccounted-for baseline difference appears. Preserve disabledAt's existing precision; record that exception explicitly. Capture baseline row counts/IDs and relationship counts for post-migration comparison. Review the role-permission and directory backfills with the staging owner.

3. Only after the comparison and backup gates pass, record the baseline as applied. This creates Prisma migration bookkeeping; it does not execute the baseline SQL:

```sh
DATABASE_URL="$STAGING_DATABASE_URL" node_modules/.bin/prisma migrate resolve --applied 20260923000000_baseline
DATABASE_URL="$STAGING_DATABASE_URL" node_modules/.bin/prisma migrate status
DATABASE_URL="$STAGING_DATABASE_URL" node_modules/.bin/prisma migrate deploy
node_modules/.bin/prisma generate
```

The deploy step applies the seven later migrations in directory timestamp order. Never mark all eight applied, execute baseline CREATE statements against existing tables, run db push, or replay remote_schema. Do not use migrate reset.

4. Verify all eight Prisma records are finished with no active failure, the separate remote_schema history is unchanged, all four arrays have defaults/NOT NULL and contain no SQL NULLs, disabledAt values/precision are unchanged, passwordHash is absent and the nine indexes have not been duplicated. Compare retained IDs, relationships, answers, evaluations, bookings and attendance with the preflight snapshot. Check intended permission/claim/audience/assignment backfills and RLS/grants. Run staging application smoke tests before switching app revisions.
5. Deploy the canonical Auth trigger as a separate reviewed operation on staging, after recording the exact old function and trigger definitions. Proposed command (psql must be installed; no command below has been run):

```sh
psql "$STAGING_DATABASE_URL" -X --set=ON_ERROR_STOP=1 --single-transaction --file=prisma/setup_auth_trigger.sql
```

Using staging-only fixtures, check normalized UVA signup, invalid domain rejection, existing same-ID behavior, and different-ID/same-email rejection without modifying the public-only record or its relations. Also verify ordinary login/recovery. Never test with production credentials or real-user mutations.
6. Only after successful staging review and separate production authorization: take a new verified production snapshot, stop application/jobs/signup writes for the maintenance window, recheck live state, and repeat steps 2–5 with the explicitly verified production connection. Deploy the matching app after schema verification. No production command is authorized by this document alone.

## Exact staging failure recovery strategy — NOT EXECUTED

- Stop the migration process and keep all staging writers/signup/jobs disabled. Save the failed migration name, error, logs, read-only `_prisma_migrations` contents and current schema for diagnosis. Do not automatically retry, mark a failure applied, or run destructive down scripts.
- A failure inside BEGIN/COMMIT rolls back that migration's SQL once its connection terminates. Prisma may retain a failed bookkeeping row. Earlier successful migrations and baseline bookkeeping remain; do not mistake transaction rollback for a rollback of the whole sequence.
- The default full rollback is to provision a replacement isolated staging clone from the verified **pre-baseline snapshot** recorded in step 1. Restore the old app revision and point staging only to that replacement. Verify snapshot row counts/IDs, relationships, disabledAt values/precision, RLS/grants, original function/trigger definitions, absence of `_prisma_migrations`, and the sole remote_schema history entry. Keep the failed clone quarantined for diagnosis; do not delete any production or existing application data. No guessed provider-specific restore CLI command is supplied because the staging/snapshot IDs do not exist yet.
- If only the separately installed trigger fails in its transaction, psql's ON_ERROR_STOP/single-transaction abort preserves the prior trigger/function. If behavioral checks fail after commit, keep signup paused and restore the recorded old function/trigger SQL in one reviewed transaction, or use the full snapshot replacement. Do not restore a known unsafe identity-rewriting trigger into active service; retain the pause until corrected behavior is verified.
- Diagnose and fix on a new branch, repeat database-free validation, then rehearse from the replacement snapshot. Existing failed clone bookkeeping is not reused. This strategy avoids migrate resolve --rolled-back and manual migration-history surgery, and restores data/backfills and security state together.
