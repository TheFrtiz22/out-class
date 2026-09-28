# OutClass production reconciliation plan

September 28, 2026. **Analysis only. No code, migrations, data, policies, settings or deployment configuration changed.** SQL below is proposed remediation or explicitly labeled verification; none of the remediation SQL was executed. This report is not an executable migration bundle.

## Recommendation and evidence boundary

**Reconcile the existing database in place using an installation-specific, reviewed additive script, preserve the existing migration files, and only then baseline their verified cumulative effects into Prisma's ledger.** Add new forward migrations for intentional improvements beyond that chain. Do not replay the baseline, replay the Supabase archive, use `db push`, or mark the whole chain applied before reconciliation.

Inputs inspected: `prisma/schema.prisma`; all 11 Prisma SQL migrations; `supabase/archive/20260923181745_remote_schema.sql`; [DEPLOYED_BACKEND_STATE.md](DEPLOYED_BACKEND_STATE.md); authentication, authorization, Storage and membership source; deployment documentation. Supplemental production reads used explicit read-only transactions and catalog/aggregate SELECTs. Prisma commands invoked only `migrate diff --help` and `migrate resolve --help`; neither performed a migration or diff against a database.

Target inspected: Supabase `htlgjluegmdwfjkzzwic`, Production/main. The prior report verified Vercel's public Supabase URL points here. **Vercel's secret DATABASE_URL target remains unverified. Confirm it privately before any implementation.** Provider configuration findings are from that report, not a fresh provider-settings inspection in this pass. Row counts/catalog details below were refreshed during this analysis and must be rechecked immediately before work.

The current app commit identified by the prior production inspection is `c6d1d371ad9bbdc83804609db422e2f481fe221f`. Backend schema reconciliation is a launch blocker even though the app builds and Demo Mode works.

## 1. Deployed → current schema diff

### Common rules and notation

- **E:** existing table; **M:** missing table. For M, every scalar column, PK, index, FK, check and security setting described by the model/migrations must be created. There are no deployed rows to migrate from that missing table.
- **S:** target security for all 27 application tables: RLS enabled; no browser-access policies; revoke ALL table privileges from PUBLIC, anon, authenticated. Server access continues through current application guards. Keep service/owner privileges required for the current backend; changing runtime DB roles is a separate project.
- All 14 existing tables are owned by `postgres`; FORCE RLS is false. Thirteen have RLS on with no policies; `PipelineRound` has RLS off. **All 14 differ from S** because anon/authenticated have broad table grants, including TRUNCATE, REFERENCES, TRIGGER and MAINTAIN in addition to CRUD. Missing tables have no current grants/RLS; S must be applied in the same transaction as creation.
- Existing PKs, all 10 Prisma baseline unique indexes, and all expected existing FKs were inspected and are present. FKs use UPDATE CASCADE. DELETE is CASCADE except `Application.roundId` → PipelineRound, which is RESTRICT. `InterviewSlot.clubId` → Club already exists and is validated; do not recreate it NOT VALID.
- Existing scalar types/defaults/nullability match the baseline except the absent `User.passwordHash` and the `disabledAt` mismatch below. IDs are TEXT; Prisma's `uuid()` is client-generated, so lack of a database UUID default is not drift. `@updatedAt` is also Prisma-managed, not a missing SQL trigger.
- Target means **Prisma schema plus SQL-only checks/security/triggers**, not merely generated schema-diff output. Prisma does not express every required SQL object.

### Existing tables (14)

| Prisma model / physical table | Exists; rows | Missing or incompatible columns | Constraints/indexes/FKs | Security difference |
| --- | --- | --- | --- | --- |
| User / User | E; 5 | Add nullable `passwordHash TEXT`. `disabledAt` is `timestamptz(6)`; target `timestamp(3)` without time zone. Other columns match. | PK and email unique present; no model FK to auth.users. Do not add one implicitly. | S required; owner postgres |
| StudentProfile / StudentProfile | E; 4 | Add nullable INT `actScore`, `actEnglish`, `actMath`, `actReading`, `actScience`. | PK, unique userId/computingId, cascading User FK present. Add `StudentProfile_act_check` (each non-null ACT component/composite 1–36). | S required |
| Experience / Experience | E; 0 | None | PK and cascading StudentProfile FK match; no required missing index. | S required |
| Club / Club | E; 0 | `campusKey TEXT NOT NULL DEFAULT 'uva'`; nullable `directorySource TEXT`, `claimedAt TIMESTAMP(3)`, `marketingApprovedAt TIMESTAMP(3)`; `testRequirement TEXT NOT NULL DEFAULT 'OPTIONAL'`. | PK/slug unique match. Add `Club_testRequirement_check`: OPTIONAL, SAT_OR_ACT, SAT, ACT, BOTH. | S required |
| ClubMember / ClubMember | E; 0 | `isOwner BOOL NOT NULL DEFAULT false`; permissions/groups TEXT[] with empty-array defaults; nullable cohort TEXT. See array divergence below. | PK, unique(userId,clubId), User/Club FKs match; extra clubId index retained. | S required; do not infer capabilities from legacy role at runtime |
| PipelineRound / PipelineRound | E; 0 | `anonymousReview BOOL NOT NULL DEFAULT false`; `interviewKit JSONB NOT NULL DEFAULT '[]'`; `kitVersion INT NOT NULL DEFAULT 0`. | PK/Club FK match; extra clubId index retained. Neither current model nor chain requires unique club/name or club/order. | **Enable RLS and revoke grants urgently** |
| ApplicationQuestion / ApplicationQuestion | E; 0 | None | PK/Club FK match; extra clubId index retained. | S required |
| Application / Application | E; 0 | Nullable `anonymousReviewText TEXT`. | PK, unique(studentId,clubId), User/Club CASCADE and round RESTRICT FKs match; three extra indexes retained. | S required |
| ApplicationAnswer / ApplicationAnswer | E; 0 | None | PK, unique(applicationId,questionId), both CASCADE FKs match. | S required |
| Evaluation / Evaluation | E; 0 | None | PK, unique(applicationId,interviewerId,round), Application/ClubMember CASCADE FKs match. | S required |
| Meeting / **Event** | E; 0 | `audience TEXT NOT NULL DEFAULT 'RECRUITMENT'`; nullable endDate TIMESTAMP(3); agenda/recap TEXT NOT NULL DEFAULT ''; resources JSONB NOT NULL DEFAULT '[]'; revision INT NOT NULL DEFAULT 0. | Preserve physical Event table/IDs. Add audience/isPublic consistency and endDate > date checks. Club FK/PK match; extra clubId index retained. | S required |
| EventAttendance / EventAttendance | E; 0 | None | PK, unique(eventId,studentId), Event/User CASCADE FKs match; extra studentId index retained. | S required |
| InterviewSlot / InterviewSlot | E; 0 | None | PK and **already validated** Club CASCADE FK match; extra clubId index retained. | S required |
| InterviewBooking / InterviewBooking | E; 0 | None | PK, unique(slotId,applicationId), Slot/Application CASCADE FKs match. | S required |

**Type conversion decision:** target the existing Prisma `DateTime?` representation, explicitly using UTC: `ALTER TABLE public."User" ALTER COLUMN "disabledAt" TYPE timestamp(3) USING ("disabledAt" AT TIME ZONE 'UTC');`. This is potentially lossy precision/time-zone normalization, not a harmless ADD COLUMN. Currently all five values are NULL, so no current value loses precision; assert this again. If non-null values appear, review instant-preservation and retain an exact before-image before approval. Do not use an implicit session-time-zone cast. Keeping timestamptz instead would require an intentional future Prisma native-type change and consistent fresh-install migrations; that is not the selected target.

### Missing tables (13)

Column lists below specify the required scalar fields; exact types, defaults and lengths remain the checked-in model plus referenced migration SQL. All receive S, a postgres-owned application-table model, and UPDATE CASCADE on declared FKs. Do not introduce extra relationships merely because a column ends in Id.

| Model/table | Required columns (all absent) | Required keys/indexes | Required FKs and SQL-only behavior |
| --- | --- | --- | --- |
| InterviewRecord | id, applicationId, interviewerId, roundId, questions, draft, anonymousReview, revision, completedAt, createdAt, updatedAt | PK id; unique(applicationId,interviewerId,roundId) | Application CASCADE; ClubMember RESTRICT; PipelineRound RESTRICT |
| PlatformAdmin | userId, active, createdAt | PK userId | User CASCADE. No rows until explicit operator designation. |
| AuditLog | id, actorId, action, targetId, clubId, reason, details, createdAt | PK id; indexes(clubId,createdAt), (actorId,createdAt) | No FKs in model. Add `outclass_audit_immutable()` and BEFORE UPDATE OR DELETE trigger; function raises exception. It is not protection against owner DDL/TRUNCATE. |
| ClubInvitation | id, clubId, email, permissions, invitedBy, expiresAt, declinedAt, acceptedAt, revokedAt, createdAt | PK id; index(email,clubId) | Club/User invitedBy CASCADE |
| ClubClaim | id, clubId, userId, explanation, status, createdAt | PK id; index(clubId,status) | Club/User CASCADE |
| ClubTask | id, clubId, title, description, assigneeId, status, dueAt, createdAt, kind, projectId, resources, requirements, audience, revision | PK id; index(clubId,status) | Club CASCADE; User assignee SET NULL; self project SET NULL. Checks kind IN TASK/PROJECT; id distinct from projectId. |
| PlatformContent | id, key, value, updatedAt | PK id; unique key | No FKs |
| MeetingCheckInToken | id, meetingId, tokenHash, expiresAt, issuedBy, createdAt | PK id; unique tokenHash; index(meetingId,expiresAt) | Event CASCADE; no issuedBy FK in model |
| TaskAssignment | id, taskId, memberId, userId, assignedAt, viewedAt, text, link, submittedAt, reviewedAt, reviewedBy, feedback, revision | PK id; unique(taskId,memberId); index(memberId) | ClubTask/User CASCADE; ClubMember SET NULL. memberId nullable; preserve SQL NULL uniqueness behavior. No new unique(taskId,userId). |
| TaskFile | id, assignmentId, name, path, size, mime, submitted, createdAt | PK id; unique path; index(assignmentId) | TaskAssignment CASCADE |
| PlatformViewSession | id, tokenHash, actorId, targetUserId, clubId, reason, createdAt, expiresAt, endedAt | PK id; unique tokenHash; index(actorId,endedAt) | No FKs in current model; don't add cascading session/audit erasure |
| RecruitingRule | roundId, minGpa, minSat, minAct, revision, updatedAt | PK roundId | PipelineRound CASCADE; threshold CHECK GPA 0–4, SAT 400–1600 divisible by 10, ACT 1–36, revision > 0; nullable thresholds |
| RecruitingRuleFlag | roundId, applicationId, ruleRevision, reasons, flaggedBy, flaggedAt | Composite PK(roundId,applicationId) | Rule/Application CASCADE; ruleRevision > 0; reasons TEXT[] NOT NULL. No automatic application-status change. |

### Preserve deployed indexes not currently represented by Prisma

Nine non-unique btree indexes exist beyond the checked-in model/chain:

- Application_clubId_idx, Application_roundId_idx, Application_studentId_idx
- ApplicationQuestion_clubId_idx
- ClubMember_clubId_idx
- Event_clubId_idx
- EventAttendance_studentId_idx
- InterviewSlot_clubId_idx
- PipelineRound_clubId_idx

**Do not drop them to make a generated diff empty.** In a future implementation PR, represent these with matching `@@index` declarations and a new forward migration whose fresh-install result creates them. Reconciliation should verify their definitions and skip creation only when exactly equivalent. A same-name index is not sufficient evidence. This makes the preserved indexes part of the owned target rather than undocumented drift.

### Array and provider-owned object differences

Historical SQL leaves ClubMember.permissions/groups, ClubInvitation.permissions and ClubTask.requirements **nullable**, despite Prisma's non-optional list representation. No affected deployed rows exist because their columns/tables are absent. Recommended explicit forward hardening: empty defaults for member permissions/groups and task requirements, normalize any NULLs after operator review, then NOT NULL on all four. Invitations should require an explicit permission array (no implicit grant); an empty array grants no capabilities. Record this as a new migration, not an edit to history. RecruitingRuleFlag.reasons is already NOT NULL in its intended SQL.

Four active enums match current names/labels; no snake_case duplicate enum families are deployed. Do not create the archive's redundant enums. The auth trigger is AFTER INSERT and has a different function body from the archive; preserve its existence but review the dangerous ID-reassignment branch separately (Stage B). Supabase auth/storage schemas are provider-owned, not Prisma application models.

## 2. Change classification and migration-by-migration disposition

Classification abbreviations: **A safe additive**, **B requires backfill**, **V requires constraint validation**, **D potentially destructive**, **S security/policy-only**, **P provider configuration rather than SQL**. “Safe” assumes reviewed dependencies, bounded locks and current preconditions; it is not authorization to execute.

| Historical migration | Required reconciliation, not replay | Class / reason |
| --- | --- | --- |
| 20260923000000_baseline | Preserve 14 tables, enum types, PKs, unique indexes and existing FKs. Add User.passwordHash only. | A. Full replay conflicts with existing CREATE statements. Recreating/dropping tables/enums would be D and is excluded. |
| 20260923010000_capabilities | Add member capability fields and 6 missing tables; immutable-audit trigger; secure application tables. Convert existing disabledAt instead of adding it. | A/S; D/V for timestamp normalization; B for legacy role mapping only if members appear. |
| 20260924000000_club_claims | Add club directory fields and invitation declinedAt; evaluate production directory seed of MII/VVF/AIF separately. | A/B; claimedAt derives only from approved ownership, not names. Seed INSERTs are data changes, not schema. |
| 20260924010000_anonymous_review_tests | Add ACT fields, testRequirement, anonymousReview and prepared text; checks. | A/V; do not fabricate scores or anonymous text. |
| 20260924020000_interview_kits | Add kit fields/InterviewRecord, indexes/FKs/security. Keep existing validated InterviewSlot FK. | A/V/S; no legacy orphan remediation currently needed. |
| 20260924030000_meetings | Alter Event in place; tokens; checks. Map audience from isPublic before validation. | A/B/V/S; never rename/drop Event or reset attendance. |
| 20260924040000_member_tasks | Add groups/cohort and full task schema, FK/index/check/security. | A/B/V/S; legacy assignment backfill has no source task rows here. File provisioning separate. |
| 20260925000000_platform_view_sessions | Create empty session table and indexes/security. | A/S; no synthetic sessions. |
| 20260925010000_marketing_participants | Add nullable consent timestamp, retain NULL absent explicit consent. | A; no inferred marketing consent. |
| 20260927000000_recruiting_rules | Create empty configuration/flag tables, keys/checks/security. | A/V/S; never reject applicants as a backfill. |
| 20260928000000_private_resume_storage | Apply reviewed targeted private-read/owner-upload policy effects standalone under Storage authority. | S; not proof other migrations ran. |
| New forward hardening | Array NOT NULL/default handling; preserve nine extra indexes in model/history; scoped default-grant hardening. | B/V/A/S; must be recorded after the immutable historical chain. |
| Auth identity trigger | Replace only unsafe email-based ID reassignment with fail-closed conflict behavior; retain AFTER timing, domain check and constrained search path. | S/B; changes signup behavior and requires separate reviewed SQL/operator signoff. No automatic account merge. |
| Auth/recovery/admin/Storage limits | Confirmation toggle, bypass env removal, token-hash email, SMTP/redirect settings, MFA enrollment and chosen bucket restrictions. | P; admin grant is an explicit privileged data change, not generic seed. |
| Delete unmatched users; overwrite IDs; drop extra indexes; recreate schemas | **Not recommended.** | D; unnecessary for schema alignment and can lose identity/data. |

Historical capability backfill gives GENERAL_MEMBER review/identify/attendance permissions. **Do not silently apply that mapping to newly appearing ordinary members.** The present membership count is zero, so its effects are vacuous if that precondition remains true. If not, stop and obtain a per-member capability/ownership mapping, preserve evidence and record any intentional deviation through forward migration/data reconciliation rather than claiming historical equivalence.

## 3. Critical security remediation specification — NOT EXECUTED

### Application grants and PipelineRound

First preserve ACL/policy definitions in the change record. In a reviewed transaction, for the explicit 14-table inventory above, enable RLS and revoke all privileges from PUBLIC, anon and authenticated. Do the same for each new table at creation. Do not grant browser SELECT back merely to repair UI: current source uses server authorization/Prisma.

Proposed exact existing-table patch:

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $patch$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'User','StudentProfile','Experience','Club','ClubMember','PipelineRound',
    'ApplicationQuestion','Application','ApplicationAnswer','Evaluation',
    'Event','EventAttendance','InterviewSlot','InterviewBooking'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated',t);
  END LOOP;
END $patch$;
COMMIT;
```

Expected: browser database access denied, including the previously exposed round table. Current server owner/service paths retain access. Verify actual runtime role before execution; do not change ownership or FORCE RLS during this pass. Lock timeout is a safe abort, not permission to repeatedly retry under load.

For **each actual application object-creator role** (`postgres` and `supabase_admin` were observed), operator-approved default privileges must stop reintroducing browser grants:

```sql
-- Proposed; repeat with FOR ROLE supabase_admin only using an authorized role.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
```

Function defaults require an extra distinction: schema-level REVOKE does not cancel PostgreSQL's global default PUBLIC EXECUTE. If adopting deny-by-default for **all future functions of a creator**, the operator must additionally review `ALTER DEFAULT PRIVILEGES FOR ROLE <creator> REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;` without IN SCHEMA. This can affect other schemas and must not be applied indiscriminately to provider-owned creation roles. Safer scoped fallback: explicitly revoke EXECUTE on every new application helper function at creation and add a deployment assertion. Do not blanket-revoke existing auth/storage/extension functions, mutate provider roles, or remove schema USAGE. Existing application helper `handle_new_user()` can have PUBLIC/anon/authenticated EXECUTE revoked after trigger-path rehearsal; retain required provider execution and ownership. Inventory non-table public objects before any additional existing-object revocation.

### Resume Storage

Use the exact reviewed SQL in `prisma/migrations/20260928000000_private_resume_storage/migration.sql` as a **standalone, Storage-owner-authorized security patch**, with a precondition that storage.objects/buckets exist. Its required effects:

1. Keep existing resumes bucket private without replacing objects.
2. Drop `resumes_select_public`.
3. Add RESTRICTIVE SELECT TO PUBLIC `USING (bucket_id <> 'resumes')` as `outclass_resumes_private_read`.
4. Add authenticated owner-prefix INSERT policy `outclass_resumes_owner_insert` and restrictive INSERT guard `outclass_resumes_insert_guard` using `split_part(name,'/',1) = auth.uid()::text`.
5. Keep RLS on storage.objects. Keep other buckets' behavior unchanged.

Do not just remove the one policy: the restrictive guard is needed because permissive policies combine with OR. Owner direct resume reads will also stop; current authorized server download routes issue five-minute service-role signed URLs. During incomplete schema reconciliation these routes may still fail; temporary fail-closed download unavailability is safer than restoring public reads. Previously downloaded copies and previously issued URLs are not revoked by policy repair alone. Preserve object bytes/path references; no storage moves/deletions.

### Email verification and recovery

- Supabase Authentication → Sign In / Providers → Email: enable Confirm email (`mailer_autoconfirm` must become false).
- Vercel: remove or set false `ALLOW_UNVERIFIED_SIGNUP` for Production and any connected production-writing environment; verify the deployed build/runtime snapshot after a controlled redeploy. The flag was absent from the inspected project list, but this is not proof about immutable runtime configuration.
- Existing autoconfirmed accounts do **not** become mailbox-verified by changing that toggle. Establish a human-approved ownership verification process before invitations/admin access; do not bulk modify auth confirmation timestamps or trust them as proof of past confirmation.
- Reset email's button and fallback link must both use `{{ .RedirectTo }}#token_hash={{ .TokenHash }}`, matching `docs/password-recovery.md`, not `{{ .ConfirmationURL }}`. Save a prior-template copy for evidence, not as an automatic insecure rollback.
- Set intended production Site URL to the operator-confirmed canonical alias (currently out-class.vercel.app); preserve exact `/auth/callback` and `/reset-password` allowlist entries. Remove broad/unused preview patterns only after checking OAuth/preview requirements and ownership. Do not guess which aliases the organization intends to retain.
- Verify Resend sender domain/credentials, SMTP delivery and provider rate limits before enabling signup confirmation for users. No new code is needed for the documented template contract.

## 4. Production data safety

Fresh counts: User **5**, StudentProfile **4**. Every other existing application table is **0**: Club, ClubMember, PipelineRound, ApplicationQuestion, Application, ApplicationAnswer, Evaluation, Event, EventAttendance, Experience, InterviewSlot, InterviewBooking. Thirteen new tables do not exist. Prior inspection counted one resume Storage object. Supplemental reads found three Auth users and one saved profile resume reference. The unmatched-user profile has no saved resume reference, and no Storage object uses either unmatched user ID as its first path segment; this does not prove there are no external file dependencies. Auth identities and Storage bytes are not disposable even though recruitment tables are empty.

Low-data-risk operations: adding club/round/meeting columns, creating all missing tables, constraints/indexes on empty tables, and skipping nonexistent legacy assignments. These still require locking/concurrency precautions and a write freeze or equivalent controlled maintenance window. A new signup can populate User/StudentProfile during work; a manager/seed can invalidate empty-table assumptions.

Special care:

- Preserve all five User IDs/emails/roles/createdAt and four profile IDs, ownership links, academic data and file references. Add nullable ACT/passwordHash without manufacturing values.
- Two User rows lack matching auth.users IDs. **One has a StudentProfile; neither is disabled.** Do not publish their identifiers, delete them, rekey them by email or create replacement Auth users automatically. Privately inventory their profile/file dependencies, source and ownership. The current trigger's email-based ID reassignment makes an unattended signup a risk; reviewed fail-closed trigger behavior should precede reopening signup.
- All disabledAt values are NULL at inspection. Reassert this before the explicit UTC type conversion and retain original type metadata for rollback.
- Current enums and FK/index objects should remain; the archive's extra enums are not a target. No schema/table drop is needed.
- Directory migration contains **production seed data** for MII/VVF/AIF. With Club empty, those inserts would add three records. Operator must approve those basic directory records or deliberately separate/override the seed in the future migration ownership design. Never insert Demo IDs, fake scores, marketing consent, club owners or admin grants to make live views look populated.

Before schema/data work: take a fresh recoverable database backup/schema+ACL/function export, independently protect Storage object bytes and a reference manifest, and rehearse restoring them to an isolated project. Existing daily backups exclude object bytes; PITR was not enabled. Set recovery point/time objectives and an operator contact. Capture before/after ID sets and counts privately. For any post-commit restoration, stop writes, account for intervening legitimate writes and restore into an isolated copy before cutover; do not blindly overwrite production. Prefer leaving additive objects in place and rolling forward over dropping tables that may now contain data.

## 5. Migration ownership and baseline strategy

| Approach | Benefits | Problems here | Decision |
| --- | --- | --- | --- |
| Reconcile actual schema/data effects, then mark existing chain satisfied | Keeps tested fresh-install history/checksums; no invented new history; supports environments already using it | Requires an effect-by-effect checklist, including seed/backfills/security beyond Prisma's schema | **Recommended** |
| Apply selected historical migrations after a minimal baseline | Can reuse intact reviewed files after verified prerequisites | Baseline lacks passwordHash; capabilities collides on disabledAt; partial DDL and provider drift; member_tasks has no explicit enclosing transaction | Only selectively reuse SQL fragments inside the reviewed plan; do not run unqualified migrate deploy |
| New squashed baseline plus separate production reconciliation delta | Simpler future chain if all environments are coordinated | Replaces history across clones; easy to omit checks/RLS/triggers/seeds; a delta is not a fresh-install baseline; unknown other ledgers | Defer unless operator inventory proves a coordinated reset of migration ownership is appropriate |

Implementation proposal for later approval:

1. Freeze historical migration contents and record SHA-256 checksums. Inventory every deployed database's ledger before changing migration ownership anywhere.
2. Prepare a separate installation-specific reconciliation SQL/runbook with explicit assertions, staged transactions and SQL extracted/adapted from the historical files. It must fail on unexpected catalog definitions; `IF NOT EXISTS` alone is not verification.
3. Prepare new forward migration(s) for array hardening, preserved index declarations and owned security additions. Use pinned installed Prisma 6.19 tooling; do not upgrade tools as part of recovery. Update source schema only in that future reviewed implementation, not this analysis.
4. Rehearse the full historical chain plus new forward changes on a disposable fresh database, and the installation-specific delta on an isolated production restore. Compare the final models, custom SQL objects and data effects. Neither shadow nor test database may be production.
5. Apply reviewed stages A–F later under operator control. Do **not** enable automatic migration deploy while ledger is absent.
6. Only after signed effect verification, use Prisma 6's `migrate resolve --applied <exact migration directory>` once per satisfied historical migration, in order. This is an intentional database/ledger write, not a dry run; commands are not executed in this task. Resolve records equivalence, not proof those historical scripts ran verbatim.
7. For new forward migrations whose exact effects were applied manually, mark them only after their own checksum/effect verification; otherwise let reviewed migrate deploy apply them once. Never both apply SQL and accidentally replay it.
8. Verify ledger checksums, finished/rollback states and order; then allow one controlled Prisma deployment path for future migrations. Preserve Supabase history as provenance; never edit/delete its entry. Keep archived SQL excluded from execution.

A directory seed or backfill cannot be silently omitted and then certified as satisfied. If the operator rejects a historical data effect, document an approved forward transformation and prove the final cumulative result, or choose a coordinated new baseline after reassessing all environments. Schema-diff success alone does not verify seed, RLS, trigger, grant or Storage effects.

Prisma documents baselining via marking already-existing effects and supports squashing workflows; the installed v6 CLI help was checked for the applicable `migrate resolve` semantics. [Prisma migration squashing documentation](https://docs.prisma.io/docs/orm/prisma-migrate/workflows/squashing-migrations). Do not substitute newer Prisma migration commands for this repository's pinned toolchain.

## 6. Ordered staged deployment plan — future work only

### Preflight gate (before A)

Confirm secret production DB target/role, current commit, all counts and catalog fingerprints; obtain backup/Storage recovery evidence, maintenance window and operator signoff. Securely capture current grants/default grants/policies/function definitions/provider configuration. Rehearse on restore before normal schema work. Emergency security can be approved independently; capture ACLs first and do not delay urgent exposure closure for a full schema redesign. Use a direct/session-compatible administrative connection for later DDL, not an unverified transaction-pooler migration session. No automatic production reset or shadow database.

### Stage A — emergency security

**Exact changes:** apply the 14-table RLS/revoke patch; apply the private-resume migration's effects standalone; change scoped table/sequence default grants for approved creator roles; apply scoped helper EXECUTE controls after inventory. No data deletion, ownership transfer or new browser grants.

**Expected impact:** closes round direct writes and resume reads. Browser Data API calls will be denied; direct owner resume reads stop. Server functions remain authorized through existing paths once schema is available.

**Rollback:** transaction abort if assertions/locks fail. After commit, fix forward; never restore public resume access or broad table grants as a routine rollback. If a legitimate dependency breaks, keep it unavailable until a narrowly authorized server path is repaired. Preserve previous ACLs for diagnosis.

**Verification:** Q1–Q3 below; anon/authenticated resume visibility must be zero without object disclosure. Test authorized signing in a restored environment first. Existence of a restrictive policy plus grant inspection is required, not just bucket.public=false.

### Stage B — auth/storage configuration

**Exact changes:** enable email confirmation and disable bypass environment; fix both recovery links; verify canonical Site URL and exact redirects/SMTP. Provision private `task-submissions` using reviewed `supabase/task-submissions.sql` (10 MiB, PDF/plain text/PNG/JPEG/DOCX/PPTX/XLSX MIME list, restrictive browser ALL guard). Keep existing resumes/headshots/club-assets bytes and public-image behavior; bucket-specific MIME/size tightening beyond current requirements needs an explicit product/operator choice, not invented limits. Review/replace only `handle_new_user` ID-reassignment branch with rejection on a conflicting normalized email; retain domain normalization, AFTER INSERT and empty search path. No automatic orphan merge.

**Expected impact:** new email signups require mailbox confirmation; valid token-hash recovery reaches the current app flow. Conflicting orphan-email signups fail closed pending operator resolution. Task bucket becomes available once task schema exists. Existing unverified provenance remains unresolved until reviewed.

**Rollback:** keep verification enabled; disable affected signup/recovery entry operationally if necessary rather than re-enable bypass. Retain old template/function definitions but do not automatically restore unsafe behavior. Bucket provisioning is additive; do not delete uploaded files on rollback. Configuration rollback must account for links already sent and sessions already issued.

**Verification:** Q3/Q4 plus GET Auth settings `mailer_autoconfirm=false`; inspect rendered template hrefs and URL config. In a separately authorized staging test, verify email delivery, link expiry/reuse, exact reset redirect and conflicting-email rejection. SQL cannot prove SMTP delivery or Vercel env state.

### Stage C — missing schema

**Exact changes:** add all fields/create all tables in section 1 using original types/defaults and SQL-only behavior. Order: User/Profile fields; Club/ClubMember/PipelineRound/Application/Event fields; independent admin/audit/content/claim/invitation/view-session tables; ClubTask; TaskAssignment; TaskFile; InterviewRecord; MeetingCheckInToken; RecruitingRule; RecruitingRuleFlag. Create PKs and S immediately. Reconcile disabledAt explicitly. Do not rename Meeting's Event table. Recheck zero-member/task/Event assumptions; backfill Event audience from isPublic if any appear. Approve and apply only real directory seed effects. Leave rules, admins, sessions, consents and anonymous content empty/null by default.

**Expected impact:** current Prisma queries gain required columns and persistence. No decision changes, membership creation by acceptance, grants by legacy global role or fake announcements.

**Rollback:** abort each failed transaction; after commit preserve additive schema and any new writes, prefer roll-forward repair or app maintenance. UTC timestamp reverse conversion requires before-image review; do not drop new tables to roll back a now-active app.

**Verification:** Q5 counts/column catalog, compare all 27 models, preserve original IDs/profile values; inspect defaults and json/list types. Run server integration checks only against restored staging until F.

### Stage D — constraints/indexes

**Exact changes:** add all missing-table indexes/FKs and the checks in section 1, validate existing/new FKs, and enforce reviewed non-null array normalization in new forward history. Preserve the nine extra indexes and represent them in Prisma/forward migration. For populated tables, add eligible CHECK/FK constraints NOT VALID, validate, then finalize; do not leave validation incomplete. NOT VALID is not available for unique indexes/NOT NULL: preflight duplicates/nulls separately. Existing validated InterviewSlot FK is untouched. New empty tables can receive full validated constraints at creation during C.

**Expected impact:** enforces intended relations and supported ranges without changing valid data. No extra round-name/order uniqueness or cross-club compound FK is introduced beyond current contract; server guards still enforce cross-club semantics.

**Rollback:** transaction abort before commit. After commit, drop/revise only a newly incorrect constraint with explicit review; do not drop preexisting keys or clear data to pass validation. For large tables use separately reviewed concurrent-index phases outside transactions; current counts do not justify that complexity.

**Verification:** Q6; zero unexpected unvalidated constraints, exact index definitions; ACT/test/audience/task/rule checks, null arrays and cross-club anomalies. Do not test invalid production writes as a verification technique.

### Stage E — platform admin

**Exact changes:** after ownership review, designated real operator enrolls and verifies TOTP; create a narrowly reviewed active PlatformAdmin row for the verified Auth/User ID and add the same ID to Vercel `OUTCLASS_PLATFORM_ADMIN_IDS`. Verify deployed env propagation. No demo identity, global CLUB_ADMIN role or club ownership is a substitute. Audit bootstrap through an operator change record and application AuditLog where feasible; maintain emergency break-glass custody separately. Enrollment and grant assignment are manual security-sensitive steps, not schema seed.

**Expected impact:** only the independently allowlisted, persisted, active admin with AAL2 can enter protected admin functionality; ordinary users remain excluded.

**Rollback:** remove allowlist entry and deactivate the specific grant using approved processes, ending privileged access without deleting the user or audit trail. Account/session revocation implications require operator review; do not delete MFA factors casually.

**Verification:** Q7 aggregate active grants/verified factors, private allowlist comparison, separately authorized AAL1 denial/AAL2 success and impersonation expiry checks. Source guard alone is insufficient evidence.

### Stage F — validation

**Exact changes:** no additional feature/schema changes. Run full lint/typecheck/tests/build and migration tests on disposable fresh/production-restored databases. Exercise real staging student/member/limited manager/reviewer/broad manager/admin personas; direct browser grants denied, anonymous projection/attachments protected, signed resume/task access, QR expiry, stale writes, interview revision/completion and recovery. Demo remains isolated. Restore test required. After approved rollout, production smoke tests should be read-only unless specific test writes/accounts are authorized; normal requireAuth can upsert User, so even GET routes are not assumed read-only.

**Expected impact:** evidence of compatibility and preservation, not just compilation. Measure migration locks/time on the restored dataset.

**Rollback:** stop rollout/write access on a failed gate; retain new data and fix forward. If recovery requires restore, follow preapproved cutover/write-reconciliation contingency; no blind rollback to an insecure earlier deployment.

**Verification:** Q1–Q7, exact private before/after ID manifests and original field values, current permissions, actual provider settings. Record test identity scope and distinguish staging evidence from production evidence.

### Stage G — migration baseline

**Exact changes:** after F, write only verified migration ledger records through pinned Prisma migrate resolve as described in section 5, then controlled deployment of any genuinely pending reviewed forward migration. Preserve historical checksums and archive; update future CI/deployment runbook in the later implementation PR. Do not use migrate dev/reset in production. Baseline package and forward files must already be reviewed before stages begin, even though ledger establishment happens last.

**Expected impact:** one authoritative Prisma path for future application changes. Baseline does not run legacy DDL again and does not turn provider dashboard settings into SQL-managed resources.

**Rollback:** ledger writes are not schema rollback. If an entry was recorded wrongly, stop automation and have an operator reconcile history using supported recovery procedures; do not manually delete ledger rows or change SQL checksums to conceal drift.

**Verification:** Q8; pinned migrate status; schema diff against the approved target using a disposable shadow/reference environment only. Independently compare RLS/grants/checks/functions/policies and data effects. New blank-install and restored-production paths must converge, with provider settings separately documented.

## Verification query set (read-only; proposed for stage gates)

Run each applicable set inside `BEGIN READ ONLY; ... ROLLBACK;`. Missing-table references intentionally fail until that stage has created them. Results containing personal identifiers must stay in restricted operator records, not this report.

**Q1 — table security and effective browser privileges**

```sql
SELECT c.relname,pg_get_userbyid(c.relowner) owner,c.relrowsecurity,c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' ORDER BY 1;
SELECT r.rolname,c.relname,p.privilege
FROM pg_roles r CROSS JOIN pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(privilege)
WHERE r.rolname IN ('anon','authenticated') AND n.nspname='public' AND c.relkind='r'
AND has_table_privilege(r.oid,c.oid,p.privilege);
SELECT * FROM pg_policies WHERE schemaname='public';
```

Expected: all 27 app tables RLS=true, no browser effective grants and no public app policies. Ledger is separate infrastructure; inspect it too after G.

**Q2 — default grants**

```sql
SELECT pg_get_userbyid(defaclrole) creator,defaclnamespace::regnamespace,
       defaclobjtype,defaclacl FROM pg_default_acl;
```

Review both global and public-schema entries for actual creator roles; an empty schema-level function ACL is not proof global PUBLIC EXECUTE disappeared.

**Q3 — Storage protection**

```sql
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets;
SELECT policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='storage' AND tablename='objects';
-- Separate read-only transaction; no user identity or file path output:
SET LOCAL ROLE anon;
SELECT count(*) FROM storage.objects WHERE bucket_id IN ('resumes','task-submissions');
```

Expected zero visible private rows; restrictive policy catalog checks remain necessary even if buckets have no objects. Global 50 MB is a provider setting, not this table's NULL per-bucket value.

**Q4 — trigger definition**

```sql
SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure);
SELECT tgname,tgenabled,pg_get_triggerdef(oid) FROM pg_trigger
WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal;
```

Expected AFTER INSERT, enabled, reviewed domain normalization and fail-closed conflicting-email behavior; no public.User ID reassignment by email.

**Q5 — columns and orphan identity counts**

```sql
SELECT table_name,column_name,udt_name,is_nullable,column_default,datetime_precision
FROM information_schema.columns WHERE table_schema='public' ORDER BY 1,ordinal_position;
SELECT count(*) AS unmatched_public_users FROM public."User" u
LEFT JOIN auth.users a ON a.id::text=u.id WHERE a.id IS NULL;
SELECT count(*) AS unmatched_profiles FROM public."StudentProfile" p
JOIN public."User" u ON u.id=p."userId"
LEFT JOIN auth.users a ON a.id::text=u.id WHERE a.id IS NULL;
```

Unmatched rows should remain preserved pending explicit ownership resolution, not mysteriously disappear. Compare table counts and private ID manifests to the frozen preflight snapshot; counts alone are insufficient.

**Q6 — keys, checks and nullable arrays**

```sql
SELECT c.relname,x.conname,x.convalidated,pg_get_constraintdef(x.oid)
FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public';
SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public';
SELECT count(*) FROM "ClubMember" WHERE permissions IS NULL OR groups IS NULL;
SELECT count(*) FROM "ClubInvitation" WHERE permissions IS NULL;
SELECT count(*) FROM "ClubTask" WHERE requirements IS NULL;
SELECT count(*) FROM "InterviewSlot" s LEFT JOIN "Club" c ON c.id=s."clubId" WHERE c.id IS NULL;
SELECT "clubId",name,count(*) FROM "PipelineRound" GROUP BY 1,2 HAVING count(*)>1;
SELECT "clubId","order",count(*) FROM "PipelineRound" GROUP BY 1,2 HAVING count(*)>1;
SELECT count(*) FROM "Application" a JOIN "PipelineRound" r ON r.id=a."roundId" WHERE a."clubId"<>r."clubId";
```

The duplicate queries are diagnostic; no new unique rule is implied. Add the prior report's answer/question and booking/slot club consistency checks to the implementation gate.

**Q7 — admin enrollment**

```sql
SELECT count(*) AS active_admins FROM "PlatformAdmin" WHERE active;
SELECT count(*) AS admins_without_verified_factor FROM "PlatformAdmin" p
WHERE p.active AND NOT EXISTS (
 SELECT 1 FROM auth.mfa_factors f WHERE f.user_id::text=p."userId" AND f.status='verified'
);
```

Require the approved count, zero missing verified factors, privately matching Auth accounts and env allowlist; actual AAL2 session behavior requires a separately authorized account test.

**Q8 — ledger**

```sql
SELECT migration_name,started_at,finished_at,rolled_back_at,applied_steps_count,checksum
FROM public._prisma_migrations ORDER BY started_at,id;
```

All recorded effects/checksums must match approved files and evidence. A migration resolved as applied need not have executed-step counts identical to one actually executed; preserve that provenance.

## 7. Required human actions and future deliverables

| Owner / channel | Work to prepare or approve later |
| --- | --- |
| Codex can prepare in a later implementation task | Installation-specific asserted SQL, security patch package, forward hardening migrations, matching index declarations, fresh/restore migration tests, catalog comparison scripts, backup verification/runbook and stage gate checklist. No such code/SQL files were created here. |
| Supabase dashboard/operator | Confirm project/environment; backups and restore copy; Storage-owner privileges; email confirmation, SMTP sender/credential validation, reset template, canonical redirects, private task bucket and chosen limits; MFA enrollment. Do not expose service keys in reports. |
| Vercel operator | Privately verify DATABASE_URL project/role and actual environment snapshot; disable unverified-signup bypass; verify public Supabase URL/key consistency; add only approved admin IDs; controlled redeploy/maintenance and later single migration pipeline. |
| Manual identity/security approval | Resolve provenance of two unmatched users and existing autoconfirmed accounts; approve no-auto-merge trigger behavior, directory seeds, capabilities if counts change, actual admins, recovery objectives and break-glass custody. Preserve profiles/files until individually authorized resolution. |
| Deployment operator | Authorize emergency patch separately if needed; own maintenance window, backups and direct DDL access; confirm no competing writers; sign off each gate; execute later approved SQL/config changes and ledger resolution; stop on unexpected drift. |

## Acceptance and unresolved decisions

Ready to proceed to implementation only when the production secret DB target, backup restore contingency, orphan-identity handling, creator-role authority, directory seed decision and admin identities are confirmed. Runtime DB least-privilege separation, additional compound integrity constraints, malware scanning, retention automation and unrelated backend features are not part of this schema reconciliation. Retention/cleanup gaps remain as documented in the deployed report.

The intended result is preserved users/profiles/files, current schema and SQL-only protections, no browser access to application/private-file data, working verified auth/recovery, explicitly provisioned AAL2 admins, and a truthful Prisma migration ledger. **Nothing in this plan has been applied.**
