# Migration ledger reconciliation — 2026-11-09

Task `DB-RECON-1`. Diagnosis and plan only. **No shared database was changed.** Production was read with `SELECT` statements on catalogs and `_prisma_migrations`; no application rows were read. All write experiments ran on a disposable PostgreSQL in the session container, since deleted with the container.

## Summary

- **Ledger replay is clean.** All 72 migrations on `main` (`5cbaeb6`) apply from zero, on plain PostgreSQL and on a Supabase-shaped database. No failures.
- **Production is at parity with the ledger.** 72 of 72 rows, none failed, none rolled back, nothing pending. Columns, indexes, enums, constraints, triggers, functions, public RLS flags and public policies match the replay, except for the short list in Step 3. **No `prisma migrate resolve`, baseline or history edit is needed.**
- **Staging does not exist.** `docs/database-deployment.md` records the owner decision of 2026-11-09, and the account lists one project (production). Staging could not be inspected; its last recorded state is 2026-11-01 (61 rows, `20261029190000_voting_guarded_undo` pending).
- **`schema.prisma` has drifted from the ledger**: 36 foreign-key differences. The database is right; the datamodel is behind. `prisma migrate dev` or `db push` would generate SQL that drops 16 live foreign keys. This is the main finding to act on.
- **One forward-only migration is proposed**: `20261109210000_validate_interview_slot_club_fk`. It is a no-op on production and makes fresh databases match it.
- **Guardrail gap**: the Supabase MCP connection in this session is `postgres` with `transaction_read_only = off`. `CLAUDE.md` assumes a `read_only=true` server. Only `SELECT` was sent.

## Verified state at session start

| Item | Value |
| --- | --- |
| `origin/main` | `5cbaeb60` (merge of #167) |
| Production deploy | `dpl_GuWtLaJ3…`, READY, built from `5cbaeb60` |
| CI on `main` | "Validate Next.js production build" in progress for `5cbaeb60` at session start; previous three runs green |
| Open PRs | 19 (10 draft). Migration-related: #191 (trim EXECUTE on `handle_new_user`), #187 (register migrations workflow), #194 |
| Hosted databases | one: production `htlgjluegmdwfjkzzwic`, PostgreSQL 17.6 |
| Ledger on `main` | 72 migrations, newest `20261109120000_club_short_name` |
| Production ledger | 72 rows, newest applied 2026-11-09 17:12 UTC |

## Step 1 — Clean replay

Disposable PostgreSQL 16.x on loopback (no Docker daemon in the container, so the pinned Supabase 17 image was not used; production is 17.6). Three databases:

| Database | Shape | Result |
| --- | --- | --- |
| CI-style | roles `anon`, `authenticated`, `service_role`, `outclass_production_app`; `auth.sessions` only (as `scripts/run-disposable-postgres.cjs`) | 72/72 applied, `migrate status` current |
| Supabase-shaped | plus stub `auth.uid()`, `auth.users`, `storage.buckets/objects` and `realtime.messages/send/topic` with RLS on | 72/72 applied; storage and realtime branches ran |
| Reference | Supabase-shaped, migrated as a role named `postgres` with production's default privileges (read from `pg_default_acl`) | 72/72; used for the comparison in Step 3 |

The stubs are hand-written, not Supabase's real schemas. They prove the migrations' Supabase branches execute and in what order; they do not prove Storage API behaviour.

**Ledger vs `schema.prisma`** (`prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script`, disposable shadow database): 165 lines, foreign keys only. No table, column, index or enum difference.

| Kind | Count | Detail | Effect if someone runs `migrate dev` / `db push` |
| --- | --- | --- | --- |
| FK in ledger, no relation in datamodel | 16 | `InterviewCollaboration` (4), `InterviewInvitation` (2), `InterviewMove` (4), `InterviewPresence` (2), `VotingPassCandidate_confirmedBy`, `VotingRoomCommand_actorId`, `VotingRuleDefault` (2) | **drops the constraint** |
| FK with `ON UPDATE NO ACTION` in ledger, datamodel implies `CASCADE` | 19 | `AdminElevation*`, `Event*` (5), `InterviewAvailabilityOverride_createdBy`, `InterviewPanelAssignment_bookingId`, `InterviewRoom_panelApprovedBy`, `PlatformReport_reporterId`, `RecipientGroup*` (3), `ScheduledCommunication*` (3), `SchoolRequest_reviewedBy`, `VotingRoomCommand_sessionId` | drop and re-add with a different rule |
| FK name | 1 | `VotingSession_cycle_scope` vs default `VotingSession_cycleId_clubId_fkey` | rename |

`prisma migrate deploy` never reads the datamodel, so releases are unaffected. Prisma cannot represent check constraints, partial indexes, triggers, functions, RLS or grants; those are invisible to this diff and are covered by the catalog comparison instead.

**Supabase-side objects** (must survive any Prisma change). `supabase/migrations` does not exist and CLI replay is disabled in `supabase/config.toml`. What exists outside the Prisma ledger:

| Source | Objects |
| --- | --- |
| `supabase/archive/20260923181745_remote_schema.sql` | Historical snapshot, never replayed. Recorded once in production's `supabase_migrations.schema_migrations`. |
| `supabase/task-submissions.sql` | Bucket `task-submissions` (private, 10 MB, 7 MIME types); restrictive policy on `storage.objects`. Applied on top of the replay without error. |
| `prisma/setup_auth_trigger.sql` | `public.handle_new_user()` and trigger `on_auth_user_created` on `auth.users`. Present in production, not in the ledger. |
| Created by Prisma migrations inside Supabase schemas | 13 `outclass_*` policies on `storage.objects`/`storage.buckets`, 2 on `realtime.messages`, buckets `resumes`, `headshots`, `club-assets`, `event-flyers`, function `outclass_signal_inbox()` and 3 triggers on `UserNotification`. All present in production and identical to the replay. |
| Supabase platform | Extensions `pg_stat_statements`, `pgcrypto`, `uuid-ossp`, `supabase_vault`; default privileges of `postgres` and `supabase_admin`; schema `public` owned by `pg_database_owner`. |

Order that works: Supabase platform schemas first, then `prisma migrate deploy`, then `supabase/task-submissions.sql` and `prisma/setup_auth_trigger.sql`.

## Step 2 — Comparison method

`scripts/db/schema-fingerprint.sql` (added on this branch) is one read-only query that emits `category | object | detail` for: ledger rows, columns, relation owner and RLS flags, views, indexes, constraints, enums, policies in `public`/`storage`/`realtime`, triggers, functions (body hash, owner, settings, EXECUTE grants), table grants, schema grants, default privileges, roles and extensions. It reads catalogs only.

It was run on the reference replay and, through the Supabase MCP, on production; rows were compared by hash and every difference was read in full. To repeat by hand:

```bash
psql "$OPERATOR_URL" -X -At -F ' | ' -v ON_ERROR_STOP=1 -f scripts/db/schema-fingerprint.sql > fingerprint-prod.txt
```

## Step 3 — Drift report

### Local (disposable replay)

No drift. It is the reference.

### Staging

Not inspectable: the project is retired. Nothing to reconcile. If a staging database is created again, build it from the ledger (`pnpm run db:deploy` on an empty project), then run the fingerprint and compare; do not revive the old project without doing the same.

### Production

Identical to the replay: 852 columns except one, 427 constraints except one, all 245 indexes, all 14 enums, the view, 77 of 78 triggers, all 51 public policies, RLS on for all 86 tables, all `outclass_*` storage and realtime policies, all five buckets private.

| # | Object | Expected (ledger) | Actual | Likely cause | Category | Risk | Proposed fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 4 ledger rows: `20261005010000_public_corkboard`, `20261006010000_admin_workspace`, `20261006020000_profile_recruitment_visibility`, `20261007010000_profile_gpa_private_photos` | SHA-256 of the LF file | SHA-256 of the same file with CRLF line endings (reproduced exactly) | Applied from a Windows checkout. Already noted in `docs/production-auth-recovery.md` | Checksum mismatch | None. Simulated locally: `migrate status` and `migrate deploy` neither warn nor fail | Leave. Never rewrite the rows. Prevent recurrence with `.gitattributes` (Step 4) |
| 2 | 14 ledger rows with `applied_steps_count = 0` (baseline, `task_workflows`, `admin_workspace`, two profile migrations, `interview_self_booking`, `editor_drafts`, three `live_voting_*`, `voting_guarded_undo`, `voting_session_setup`, two `additional_observation*`) | 1 | 0 | SQL was run with `psql`, then registered with `migrate resolve --applied` (documented in `docs/post-interview-release-20261007.md`) | Registered by resolve | None for these rows: every object they create matches the replay | Leave |
| 3 | 53 tables (list below) | Owner is the migrating role | Owner `outclass_production_app` | Ownership moved by hand when the bounded runtime role was introduced; only 26 later tables are transferred by migrations | Privilege/ownership | Medium. The runtime role bypasses RLS on tables it owns and could alter or drop them. Fresh databases differ from production unless a fixture re-owns tables (the CI fixture does) | Owner decision D1 |
| 4 | `User.disabledAt` | `timestamptz(3)` | `timestamptz` (microseconds) | Column predates the ledger; `20260923010000_capabilities` deliberately keeps an existing column | Extra manual change (pre-ledger) | Low. Prisma reads and writes it the same way | Accept as a recorded exception. Changing the type is blocked by trigger `outclass_owner_account_guard` (tested), so it would mean dropping a security trigger on `User` |
| 5 | `InterviewSlot_clubId_fkey` | `NOT VALID` | Validated | Validated by hand, or the constraint predates the ledger | Extra manual change | None in production; fresh databases are weaker | Migration `20261109210000_validate_interview_slot_club_fk` |
| 6 | 7 functions: `outclass_event_revision`, `outclass_event_withdraw`, `outclass_publication_guard`, `outclass_flyer_immutable`, `outclass_rsvp_guard`, `outclass_scholar_status_valid`, `outclass_validate_changed_gpa` | Body with LF | Same body with carriage returns (identical hash once removed) | CRLF checkout, as row 1 | Extra manual change (whitespace) | None | Leave |
| 7 | 4 functions: `outclass_voting_slide_preparation_guard`, `outclass_voting_slide_lock_guard`, `outclass_voting_ballot_rule_guard`, `outclass_voting_hand_raise_guard` | Body including `--` comment lines | Same body without the comment lines (identical length and hash once removed) | The three Nov 5–6 migrations were executed by a client that strips comments, not verbatim by `prisma migrate deploy`; their ledger rows still show one step and the correct checksum | Extra manual change (comments) | None functionally. It shows a second way of applying migrations is in use | Leave. Use one path from now on (Step 4) |
| 8 | `public.handle_new_user()` and `on_auth_user_created` on `auth.users` | Absent | Present | Installed from `prisma/setup_auth_trigger.sql` | Supabase-owned object | Sign-up depends on it. PR #191 changes its EXECUTE grants | Keep as is |
| 9 | 18 legacy policies on `storage.objects`: nine `Users … own resumes/headshots/club assets`, `headshots_{select_public,insert,update,delete}_owner_only`, `resumes_{insert,update,delete}_owner_only`, `outclass_task_submissions_deny_browser` | Absent | Present | Created in the dashboard before the ledger | Supabase-owned / extra manual change | Low to medium. The restrictive `outclass_*` guards override them for resume reads and inserts, all headshot operations and all club-asset operations. There is no restrictive guard for UPDATE or DELETE in `resumes`; whether the Storage API allows an owner to do either without SELECT was not tested | Owner decision D2 |
| 10 | `storage.objects.outclass_task_files_server_only` | Present (current `supabase/task-submissions.sql`) | Absent; the same rule exists as `outclass_task_submissions_deny_browser` | The script was renamed after it was run | Supabase-owned object | None. Re-running the script would add a duplicate, equivalent policy | Keep. Do not re-run the script on production |
| 11 | `MAINTAIN` in `service_role` table grants | Absent | Present | PostgreSQL 17 privilege; local reference is 16 | Version artefact | None | None |
| 12 | `supabase_migrations.schema_migrations`: `20260923181745 remote_schema` | n/a | Present | Supabase CLI history | Supabase-owned object | None | Keep |

Tables in row 3: `AdminElevation`, `AdminElevationChallenge`, `ApplicantObservation`, `Application`, `ApplicationAnswer`, `ApplicationQuestion`, `AuditLog`, `Club`, `ClubClaim`, `ClubInvitation`, `ClubMember`, `ClubTask`, `CorkboardClub`, `Evaluation`, `Event`, `EventAttendance`, `EventFlyer`, `EventPublication`, `EventRsvp`, `Experience`, `InterviewAnnotationRevision`, `InterviewBooking`, `InterviewPanelAssignment`, `InterviewRecord`, `InterviewResumeAnnotation`, `InterviewResumeDocument`, `InterviewRoom`, `InterviewSlot`, `InvitationDelivery`, `MeetingCheckInToken`, `PipelineRound`, `PlatformAdmin`, `PlatformContent`, `PlatformReport`, `PlatformViewSession`, `RecruitingRule`, `RecruitingRuleFlag`, `RosterImport`, `RosterImportRow`, `School`, `SchoolIdentifierType`, `SchoolIdentity`, `StudentProfile`, `TaskAssignment`, `TaskFile`, `User`, `UserTutorial`, `VotingBallot`, `VotingCandidate`, `VotingParticipant`, `VotingPass`, `VotingPassCandidate`, `VotingSession`.

Production ownership in full: 79 tables owned by `outclass_production_app`, 7 by `postgres` (`_prisma_migrations`, `VotingBallotRule`, `VotingHandRaise`, `VotingObservationReference`, `VotingRuleDefault`, `VotingSlideLock`, `VotingSlidePreparation`). No postgres-owned table that the runtime role can select is missing a permissive runtime policy.

Not checked: Auth configuration, Storage API behaviour with real tokens, data content, and anything in `auth`, `storage` or `realtime` beyond policies and triggers that reference OutClass objects.

### Root cause of the past migration privilege errors

Facts read from production today:

- `postgres` is not a superuser on Supabase (`rolsuper = false`, `rolbypassrls = true`, `rolcreaterole = true`). It owns the database; schema `public` is owned by `pg_database_owner`.
- `outclass_production_app` (the runtime login) owns 79 of 86 tables, has no `CREATE` on `public`, and cannot read `_prisma_migrations`.
- `postgres` is a member of `outclass_production_app` through two grants: one from `supabase_admin` with `ADMIN` only (`INHERIT false`, `SET false`), and one it granted itself with `INHERIT` and `SET`.
- `schema.prisma` declares only `url = env("DATABASE_URL")`. There is no `directUrl`. The app prefers `POSTGRES_PRISMA_URL`, then `DATABASE_URL` (`utils/prisma.ts`). The migrations workflow maps a separate secret, `MIGRATION_DATABASE_URL`, onto `DATABASE_URL`.

What follows from them:

1. **Wrong connection.** The Prisma CLI uses whatever `DATABASE_URL` holds. With the runtime connection it logs in as `outclass_production_app`, which cannot read the ledger or create objects, so `migrate status`/`deploy` fail with permission errors. Migrations must use the operator connection.
2. **Wrong mode.** The direct endpoint is IPv6 only and was unreachable from the operator's machine; the transaction pooler does not support what `migrate` needs. The fallback (session pooler, `SET ROLE postgres`, `psql`, then `migrate resolve --applied`) is where the 14 zero-step rows come from.
3. **Ownership split.** Since PostgreSQL 16, a role created by a non-superuser gives its creator `ADMIN` but not `INHERIT`/`SET`. Until `postgres` granted itself the membership with both, any `ALTER TABLE`, `CREATE TRIGGER` or `CREATE POLICY` on a runtime-owned table failed with "must be owner of table". Transferring a table to the runtime role fails unless that role has `CREATE` on `public`, which is why those migrations grant and revoke it inside the transaction.
4. **New tables.** A table created by a migration is owned by `postgres` with RLS on. The runtime role is neither owner nor `BYPASSRLS`, so it needs explicit grants and a policy. Missing one produced the `VotingObservationReference` failure fixed by `20261103200000_additional_observation_runtime_access`.

Inferred, not verified here: which connection string each past failed run actually used.

## Step 4 — Reconciliation plan

### Production

Nothing in production needs repair. The sequence is one optional no-op migration plus decisions.

| Step | Action | Who | Needs approval |
| --- | --- | --- | --- |
| P0 | Pre-flight: confirm a restorable backup exists; save `fingerprint-prod.txt`; run the migrations workflow with `dry_run: true` from the PR branch and confirm exactly one pending migration (`20261109210000_validate_interview_slot_club_fk`) | Owner | Yes (workflow run) |
| P1 | Rehearsal: restore the latest backup into a throwaway PostgreSQL 17, run `pnpm run db:deploy` against it, run the fingerprint, confirm the only change is the new ledger row | Owner or agent with a disposable restore | Yes (backup access) |
| P2 | Apply: migrations workflow, `dry_run: false`, `ref` = the PR branch. Then merge the PR | Owner | Yes |
| P3 | Verify (queries below) | Agent, read-only | No |

`migrate resolve`: **none proposed.** Rows 1 and 2 were reproduced on a disposable database (CRLF checksums, zero step counts); `migrate status` listed only the new migration and `migrate deploy` applied it.

Verification after P2:

```sql
SELECT count(*) AS rows, count(*) FILTER (WHERE finished_at IS NULL) AS unfinished,
       count(*) FILTER (WHERE rolled_back_at IS NOT NULL) AS rolled_back
FROM public._prisma_migrations;                      -- expect 73, 0, 0
SELECT convalidated FROM pg_constraint
WHERE conname = 'InterviewSlot_clubId_fkey';         -- expect true (already true today)
```

Then re-run the fingerprint and diff against `fingerprint-prod.txt`: the only new line is the ledger row.

Rollback: the migration changes nothing in production (the constraint is already valid), so there is nothing to undo.

If the apply fails (reproduced on a disposable database with an orphaned slot): the SQL rolls back and the schema is unchanged, but Prisma records the attempt outside that transaction. The ledger keeps a row with `finished_at` NULL and every later `migrate deploy` stops with `P3009`. Recovery, **owner approval required, not to be run by an agent**: read the error, fix its cause, then

```bash
pnpm exec prisma migrate resolve --rolled-back 20261109210000_validate_interview_slot_club_fk
```

```bash
pnpm exec prisma migrate deploy
```

Justification: `--rolled-back` only marks the failed attempt so the same migration can run again; it does not claim anything was applied. In production the only realistic failure is the 3 s lock timeout on a catalog read, which a retry clears.

Locks: `VALIDATE CONSTRAINT` takes `SHARE UPDATE EXCLUSIVE` on `InterviewSlot` and `ROW SHARE` on `Club`; reads and writes continue. In production the guard finds the constraint valid and skips the statement. `lock_timeout` 3 s, `statement_timeout` 30 s.

### Staging

None exists. No action.

### Owner decisions (nothing is prepared in the ledger for these)

- **D1 — table ownership.** Either (a) record today's state: a forward-only migration that transfers the 53 tables to `outclass_production_app` when the role exists, following `20261011194930_decision_letter_runtime_access` (no-op in production, removes the fixture-only re-owning step); or (b) move toward least privilege: `postgres` owns every table and the runtime role gets explicit grants and policies, as the six newest voting tables already do. (b) is a security change on 79 tables and needs its own plan and authz review. Recommendation: decide (b) or not first; do (a) only if (b) is rejected.
- **D2 — legacy storage policies.** Test with real anon and authenticated tokens whether an owner can update or delete an object in `resumes` directly. If yes, add a restrictive guard in a forward migration. Dropping the 18 legacy policies is a separate, optional cleanup.
- **D3 — `User.disabledAt`.** Accept as a recorded exception (recommended).

### Repository changes (no database effect)

1. **Align `schema.prisma` with the ledger**: add the 16 missing relations, `onUpdate: NoAction` on 19, `map: "VotingSession_cycle_scope"` on one. Acceptance: the Step 1 diff is empty. Generated client types gain relation fields, so this needs typecheck and the full suite; separate PR.
2. **CI drift check** in the `validate` job, with a PostgreSQL service container:
   ```bash
   pnpm exec prisma migrate deploy && pnpm exec prisma migrate status
   pnpm exec prisma migrate diff --from-migrations prisma/migrations \
     --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_URL" --exit-code
   ```
   Until change 1 lands, compare the `--script` output with a committed copy of today's 165-line diff so that new drift fails and known drift does not.
3. **Production drift check**: a manual workflow next to `database-migrate.yml` that runs `scripts/db/schema-fingerprint.sql` on a ledger replay and on production (same secret, read-only transaction) and uploads the diff. Rows 1–12 above are the accepted baseline.
4. **`.gitattributes`**: `prisma/migrations/**/*.sql text eol=lf`, so a Windows checkout produces the same checksum and function bodies.
5. **One way to apply**: `prisma migrate deploy` through the migrations workflow. Keep `psql` plus `migrate resolve --applied` as a documented exception that requires owner approval each time.
6. **Supabase MCP**: reconnect it with `read_only=true` (or a read-only database role). Today it can write.

## Evidence

| Check | Result |
| --- | --- |
| Replay from zero, 72 migrations, CI-style | pass |
| Replay from zero, 72 migrations, Supabase-shaped, then `task-submissions.sql` | pass |
| New migration on a database with 72 applied | applied; constraint `NOT VALID` → valid |
| New migration repeated on a database where the constraint is valid | no-op, no error |
| Replay from zero, 73 migrations | pass |
| New migration with an orphaned slot | fails with the FK error; constraint unchanged; row kept |
| Same failure through `prisma migrate deploy` | ledger row left with `finished_at` NULL; next deploy stops with `P3009` (recovery in Step 4) |
| `test:migrations` with a new assertion that the FK is validated on legacy and fresh databases | passes with the migration, fails without it |
| Ledger with production's CRLF checksums and zero step counts | `status` lists only the new migration; `deploy` succeeds |
| Ledger vs `schema.prisma` diff before and after the new migration | identical (165 lines) |
| `User.disabledAt` type change | refused by PostgreSQL: column used by trigger `outclass_owner_account_guard` |

Gate results are in `validation-report.md`.
