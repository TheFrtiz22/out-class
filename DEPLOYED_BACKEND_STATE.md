# OutClass deployed backend state

Verified September 28, 2026, approximately 12:55–13:08 UTC. **Read-only inspection; no remediation performed.**

## Scope and evidence

The inspected Supabase project is **OutClass / main / Production**, project `htlgjluegmdwfjkzzwic`. Vercel's Production `NEXT_PUBLIC_SUPABASE_URL` visibly points to this project. The local database connection also identifies this project in its pooler username and connects as `postgres` to database `postgres` through `aws-0-us-west-2.pooler.supabase.com:6543`.

**Important boundary:** Vercel's secret `DATABASE_URL` was not revealed. Its exact runtime destination is **UNKNOWN**. Database findings below are verified for the production-labeled Supabase project used by the production Auth/Storage URL; a human must confirm the server's secret database URL points to the same project. Current project environment settings are not a complete immutable environment snapshot of a running deployment.

Evidence sources:

- **DB:** successful direct catalog and aggregate SELECT queries, each inside a transaction with `SET TRANSACTION READ ONLY`. Role visibility checks used transaction-local `SET LOCAL ROLE anon/authenticated`; no persistent grants or roles were changed. No application records, object names, resume contents, credentials, or personal identities are reproduced.
- **API:** GET `/auth/v1/settings`, GET `/storage/v1/bucket`, and an unauthenticated GET `/rest/v1/PipelineRound?select=id&limit=0` against the identified project. Credentials stayed in process memory and were not printed.
- **Provider UI:** authenticated, read-only Supabase and Vercel dashboard inspection. No Save, Restore, deploy, migration, signup, password reset, email send, or policy mutation was performed.
- **Source:** current repository commit `c6d1d371ad9bbdc83804609db422e2f481fe221f`, also identified by Vercel as its current production source. Repository intent is distinguished from provider state.

Only this report was written. Tests/build/migrations were not run: this task is deployed-state inspection, not code validation. Provider access logging may naturally record reads.

## Key findings

1. **High risk:** `PipelineRound` has RLS disabled and effective SELECT/INSERT/UPDATE/DELETE privileges for `anon` and `authenticated`.
2. **High risk:** `resumes` is a private bucket, but `resumes_select_public` grants public SELECT. An `anon` read-only SQL query could see the one existing resume object's metadata. The restrictive private-resume patch is absent.
3. **Major deployment drift:** no Prisma migration ledger exists; 13 current application tables and numerous required columns are missing.
4. **Email ownership is not enforced at signup:** the deployed Auth API reports `mailer_autoconfirm: true`.
5. **Recovery mismatch:** the deployed custom recovery email uses `{{ .ConfirmationURL }}`, rather than the token-hash fragment required by the current application.
6. **Admin setup is incomplete:** zero MFA factors, no `PlatformAdmin` table, and no visible production admin allowlist variable.

## 1. Applied Prisma migrations and order

**CURRENT DEPLOYED STATE:** No `_prisma_migrations` relation exists in any schema. There is therefore **no recorded Prisma application order**, and none of the repository's 11 migrations can be certified as applied through Prisma. This does not prove that nobody manually executed individual statements; actual schema inspection demonstrates only partial/legacy equivalents.

**EVIDENCE:** `to_regclass('public._prisma_migrations')` returned NULL. A `pg_class`/`pg_namespace` search for `_prisma_migrations` returned zero rows. The database has 14 public application tables, versus 27 models in the current generated Prisma schema.

Repository sequence, **not deployed history**:

1. `20260923000000_baseline`
2. `20260923010000_capabilities`
3. `20260924000000_club_claims`
4. `20260924010000_anonymous_review_tests`
5. `20260924020000_interview_kits`
6. `20260924030000_meetings`
7. `20260924040000_member_tasks`
8. `20260925000000_platform_view_sessions`
9. `20260925010000_marketing_participants`
10. `20260927000000_recruiting_rules`
11. `20260928000000_private_resume_storage`

**RISK:** Current server code expects schema absent from this database. Successful builds and Demo Mode cannot establish working live persistence. Blindly deploying this chain against existing tables would be unsafe.

**HUMAN VERIFICATION STEP:** Confirm Vercel's production `DATABASE_URL` project/host privately. Against that exact target, repeat the ledger/catalog queries in the appendix and compare a read-only schema export against [the authoritative deployment guide](docs/database-deployment.md). Historical manual execution order is UNKNOWN; obtain operator/CI records. Do not baseline or run migrations as part of verification.

## 2. Applied Supabase migrations/schema changes

**CURRENT DEPLOYED STATE:** Exactly one tracked Supabase migration:

| Order | Version | Name | Dashboard inserted-at UTC |
| --- | --- | --- | --- |
| 1 | `20260923181745` | `remote_schema` | September 23, 2026, 18:17:45 |

The current catalog is not interchangeable with the archived snapshot: for example, `handle_new_user` is the active definition in section 5, `User.disabledAt` exists, and `InterviewSlot_clubId_fkey` is present and validated. These observations do not establish who changed them or when.

**EVIDENCE:** `SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version`; [Supabase migration dashboard](https://supabase.com/dashboard/project/htlgjluegmdwfjkzzwic/database/migrations); direct column/function/constraint inspection. The repository archives `supabase/archive/20260923181745_remote_schema.sql`; current `supabase/config.toml` disables migration replay.

**RISK:** A single history entry does not certify equivalence with the Prisma baseline or later capabilities. Untracked change chronology is UNKNOWN.

**HUMAN VERIFICATION STEP:** Read the migration's stored statements and provider/operator change logs; compare actual schema, constraints, functions and Storage policies to the archived snapshot and current Prisma files. Do not replay either history to discover differences.

## 3. Effective table grants, RLS, ownership and roles

**CURRENT DEPLOYED STATE:** All 14 public tables are owned by `postgres`. None use FORCE ROW LEVEL SECURITY. There are **zero policies in the public schema**.

| Tables | RLS | Browser-role row access |
| --- | --- | --- |
| `PipelineRound` | Disabled | Grants permit SELECT/INSERT/UPDATE/DELETE without a row policy |
| `Application`, `ApplicationAnswer`, `ApplicationQuestion`, `Club`, `ClubMember`, `Evaluation`, `Event`, `EventAttendance`, `Experience`, `InterviewBooking`, `InterviewSlot`, `StudentProfile`, `User` | Enabled | Default-deny for ordinary row operations because no policies exist |

On **every** listed table, `anon`, `authenticated` and `service_role` have effective SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER privileges. ACLs also contain PostgreSQL's MAINTAIN privilege (`m`). All three have public-schema USAGE, but not CREATE. `postgres` has the same table ACL privileges and ownership.

| Role | Login | Inherit | Superuser | BYPASSRLS | Create role/database |
| --- | --- | --- | --- | --- | --- |
| `anon` | No | Yes | No | No | No / No |
| `authenticated` | No | Yes | No | No | No / No |
| `authenticator` | Yes | No | No | No | No / No |
| `service_role` | No | Yes | No | Yes | No / No |
| `postgres` | Yes | Yes | No | Yes | Yes / Yes |
| `supabase_admin` | Yes | Yes | Yes | Yes | Yes / Yes |

`authenticator` can SET ROLE to `anon`, `authenticated`, and `service_role`, with no inherited membership privileges. `postgres` has inherited/admin-option memberships in those browser/service roles and other operational roles. Additional catalog BYPASSRLS roles are `supabase_etl_admin` and `supabase_read_only_user`; the latter has read-all-data/monitor memberships. `supabase_storage_admin` owns Storage tables, is not a superuser, and does not have BYPASSRLS.

Default privileges for new public tables created by `postgres` or `supabase_admin` also grant broad access to `anon`, `authenticated` and `service_role`. Their public function defaults grant EXECUTE to those roles; sequence defaults grant SELECT/UPDATE/USAGE.

**EVIDENCE:** `pg_class`, `pg_policies`, `pg_roles`, `pg_auth_members`, `pg_default_acl`, `has_schema_privilege`, and `has_table_privilege`. The unauthenticated PipelineRound REST GET returned HTTP 200 and `[]` (the table is empty). No write was attempted.

**RISK:** Pipeline mutation exposure bypasses application permission checks. RLS does not protect whole-table operations such as TRUNCATE; this SQL privilege is excessive even though this audit did not establish an exposed API that invokes it. Owner/service-role connections bypass RLS, so server authorization remains essential. Broad default grants can expose future tables if RLS is omitted.

**HUMAN VERIFICATION STEP:** Catalog findings are confirmed. For complete runtime reachability, inspect Supabase Data API exposed schemas/RPCs and Vercel's actual database role. Do not test production INSERT/UPDATE/DELETE/TRUNCATE to prove exposure; use catalog evidence or a restored isolated copy.

## 4. Public resume read access

**CURRENT DEPLOYED STATE:** **YES at the Storage SELECT-policy layer**, despite `storage.buckets.public = false`.

Active policy:

```sql
CREATE POLICY resumes_select_public ON storage.objects
FOR SELECT TO PUBLIC USING (bucket_id = 'resumes');
```

It is PERMISSIVE. No restrictive SELECT policy overrides it. The additional `Users read own resumes` policy does not narrow access: permissive policies are alternatives. Owner-prefix INSERT/UPDATE/DELETE policies also exist in two naming families.

`storage.objects` has RLS enabled, FORCE disabled, and SELECT grants for `anon`/`authenticated`. A read-only transaction with `SET LOCAL ROLE anon` could count **1** resume object; `authenticated` without user JWT claims also counted **1**. No name or bytes were retrieved.

**EVIDENCE:** bucket API; full `pg_policies` results; Storage ACL/catalog inspection; role-scoped aggregate SELECT. The repository's restrictive private-resume guard is absent.

**RISK:** The private bucket flag alone does not enforce the intended authorized-download-only boundary. The SELECT policy permits browser-role reads through policy-authorized Storage operations. Exact HTTP byte-download behavior was not exercised; no existing private document was downloaded. No conclusion is made about previous access or cached copies.

**HUMAN VERIFICATION STEP:** Inspect [Storage policies](https://supabase.com/dashboard/project/htlgjluegmdwfjkzzwic/storage/files/policies), including PUBLIC and restrictive policies. If HTTP evidence is required, use an explicitly authorized non-sensitive existing fixture and anonymous credentials; compare direct reads with the signed-download route. No new object/upload/signing operation was performed here.

## 5. Active `handle_new_user` and trigger timing

**CURRENT DEPLOYED STATE:** `public.handle_new_user()` is a PL/pgSQL SECURITY DEFINER trigger function, owner `postgres`, with an empty search path. The enabled `on_auth_user_created` trigger is **AFTER INSERT**, per row, on `auth.users` (`tgenabled = O`).

The exact active definition is reproduced in Appendix B. It normalizes email, restricts the address to `@virginia.edu`, and inserts/upserts `public.User`. Its special “Test/dev reconciliation” branch updates an existing public user's primary key to the new auth UUID when the normalized email matches another ID.

**EVIDENCE:** `pg_get_functiondef` and `pg_get_triggerdef`, not repository inference.

**RISK:** A privileged trigger performs identity reconciliation during signup. In combination with email autoconfirm, an address-format check does not prove mailbox ownership. Existing user IDs and cascading relationships could be reassigned by this branch; this is a risk assessment, not a tested exploit. Two public users currently have no corresponding auth row (section 10).

**HUMAN VERIFICATION STEP:** Definition/timing confirmed. Review the branch's intended ownership semantics and incoming foreign-key update behavior on a restored database; obtain change provenance from operator records. Do not create production users to test it during this read-only pass.

## 6. Email confirmation and unverified-signup bypass

**CURRENT DEPLOYED STATE:** Production Supabase email signup is enabled, signup is not disabled, and `mailer_autoconfirm = true`. **Email confirmation is therefore not required by this Auth project.** Anonymous-user login is disabled; Azure and email providers are enabled.

The Vercel project variable list did **not** contain `ALLOW_UNVERIFIED_SIGNUP`; its Shared tab said “No shared variables linked.” The local `.env` has this flag set to `true`, which is **local evidence only**. The immutable deployment's effective value is UNKNOWN. Independently of that flag, the confirmed provider autoconfirm setting permits signup without confirmation.

**EVIDENCE:** HTTP 200 Auth settings response; Vercel Project/Shared environment tabs; `actions/onboarding.ts`. The code's explicit secret-key bypass requires the flag and marks `email_verification_skipped`; its fallback also accepts provider autoconfirm. No signup was attempted.

**RISK:** UVA-shaped email addresses are not verified mailbox ownership. Flows relying only on `email_confirmed_at` may treat provider-autoconfirmed accounts as verified.

**HUMAN VERIFICATION STEP:** Read Supabase Authentication → Sign In / Providers → Email → Confirm email. Inspect the current deployment's build/runtime environment privately for `ALLOW_UNVERIFIED_SIGNUP`, including external build-time injection. No provider toggles should be changed merely to verify them.

## 7. Platform-admin MFA and AAL2

**CURRENT DEPLOYED STATE:** TOTP MFA is enabled, maximum 10 factors/user; SMS MFA is disabled. “Limit duration of AAL1 sessions” is enabled (dashboard says 15 minutes). However, **`auth.mfa_factors` contains zero rows**. No account in this project has an enrolled factor.

`public.PlatformAdmin` does not exist. `OUTCLASS_PLATFORM_ADMIN_IDS` was not present in the inspected Vercel Project variable list, and no Shared variables are linked. Thus the current intended platform-admin setup is not provisioned in this database.

**EVIDENCE:** [MFA settings](https://supabase.com/dashboard/project/htlgjluegmdwfjkzzwic/auth/mfa), aggregate factor query and table inventory. Production source commit matches local `utils/platform-admin.ts`, which requires the environment allowlist, an active persisted admin grant, and `currentLevel === 'aal2'`.

**RISK:** MFA availability is not MFA enrollment or successful admin operation. With the inspected schema/settings, intended admin access should fail closed or fail on missing schema; no actual admin session was tested. Provider AAL1 duration settings are not a substitute for the application AAL2 check.

**HUMAN VERIFICATION STEP:** Runtime admin enforcement is **UNKNOWN**. Privately confirm the production database target/allowlist, inspect any actual admin grants and verified factors on that target, and review deployment source. A later separately authorized account test should verify AAL1 denial and AAL2 success; this pass did not enroll, challenge, verify, or sign in any account.

## 8. Recovery SMTP, redirects and templates

**CURRENT DEPLOYED STATE:** Custom SMTP is enabled, host `smtp.resend.com`, port `465`, sender name `OutClass`, minimum per-user interval 60 seconds. A stored SMTP password is hidden. Credential validity, sender-domain verification and actual delivery are **UNKNOWN**; no email was sent.

Site URL: `https://out-class-thefritz2008-5266.vercel.app/`.

Redirect allowlist (7 entries):

- `https://out-class.vercel.app/auth/callback`
- `https://out-class.vercel.app/**`
- `https://out-class.vercel.app/reset-password`
- `https://out-class-thefritz2008-5266.vercel.app/`
- `https://out-class-thefritz2008-5266.vercel.app/**`
- `https://out-*-class-thefritz2008-5266.vercel.app`
- `https://out-*-class-thefritz2008-5266.vercel.app/**`

The reset email has subject “Reset your password” and a custom branded body. Both its reset button and fallback link use **`{{ .ConfirmationURL }}`**. The required `{{ .RedirectTo }}#token_hash={{ .TokenHash }}` link is not used. The exact production reset route is allowlisted, but the overall recovery configuration is **not aligned with the current app contract**.

**EVIDENCE:** [SMTP](https://supabase.com/dashboard/project/htlgjluegmdwfjkzzwic/auth/smtp), [URL configuration](https://supabase.com/dashboard/project/htlgjluegmdwfjkzzwic/auth/url-configuration), [reset template](https://supabase.com/dashboard/project/htlgjluegmdwfjkzzwic/auth/templates/reset-password) rendered links; [repository recovery contract](docs/password-recovery.md). Password-changed notifications are enabled in the template list.

**RISK:** The current template can consume the recovery token through Supabase's confirmation link rather than handing the token hash to the application's recovery POST flow. The fallback Site URL differs from the primary production alias; broad preview wildcards merit ownership review.

**HUMAN VERIFICATION STEP:** Inspect Resend's verified sender domain, SMTP credential status and existing delivery/failure logs without exposing recipients or secrets. Confirm ownership of every redirect origin and the intended fallback URL. End-to-end recovery delivery, expiry and password change remain UNKNOWN and require a separately authorized test; none was initiated.

## 9. Enforced upload size and MIME restrictions

**CURRENT DEPLOYED STATE:** Storage's global file-size limit is **50 MB**, as displayed in the provider settings. Bucket-specific limits are NULL and MIME allowlists are NULL for all existing buckets.

| Bucket | Exists | Public flag | Effective configured size ceiling | MIME allowlist |
| --- | --- | --- | --- | --- |
| `resumes` | Yes | False; SELECT exposure described above | Global 50 MB | Any |
| `headshots` | Yes | True | Global 50 MB | Any |
| `club-assets` | Yes | True | Global 50 MB | Any |
| `task-submissions` | **No** | N/A | N/A | N/A |

**EVIDENCE:** GET bucket API, Storage bucket table (“Unset (50 MB)”, “Any”), and [global Storage settings](https://supabase.com/dashboard/project/htlgjluegmdwfjkzzwic/storage/files/settings). `actions/storage.ts` validates bucket and file name, not file byte size or MIME. The repository's task bucket SQL specifies 10 MiB and explicit MIME types, but that bucket is not deployed here.

**RISK:** Client-side file filters cannot enforce document/image types against direct uploads. Task file submission cannot rely on a missing bucket. No actual boundary-size/MIME uploads were attempted, so transport-level runtime rejection is not tested.

**HUMAN VERIFICATION STEP:** Configured settings are confirmed. If byte-level enforcement evidence is required, use an isolated staging bucket/test with separately authorized uploads; do not infer provider enforcement from a browser file-picker filter.

## 10. Existing-data and schema integrity

**CURRENT DEPLOYED STATE / EVIDENCE:** Aggregate SELECTs and schema comparison returned:

| Check | Result |
| --- | --- |
| InterviewSlot rows / orphan club references | 0 / 0 |
| PipelineRound rows / duplicate exact names per club / duplicate orders per club | 0 / 0 / 0 |
| Applications / interview bookings / memberships | 0 / 0 / 0 |
| Applications referencing another club's round | 0 |
| Saved answers referencing another club's question | 0 |
| Bookings referencing another club's slot | 0 |
| Invalid slot chronology or capacity below 1 | 0 |
| Out-of-range GPA/SAT or non-10-point SAT values | 0 |
| Public users without matching `auth.users` ID | **2** |
| Unvalidated public constraints | 0 |
| InterviewSlot → Club FK | Present and validated, UPDATE/DELETE CASCADE |
| PipelineRound uniqueness | PK and club FK; no per-club name/order unique constraint observed |
| Public enum types | `AppRole`, `AppStatus`, `ClubRole`, `QuestionType`; no duplicate naming families observed |

The zero relationship-anomaly counts largely reflect empty tables; they do not demonstrate concurrent-write integrity.

**Array checks:** `ClubMember.permissions` and `ClubMember.groups` columns are **absent**, not merely NULL. `ClubInvitation` and `ClubTask` are absent, so invitation permission and task requirement arrays cannot be counted. This is confirmed schema absence, not a clean-null result.

Missing tables compared with current Prisma models:

`InterviewRecord`, `PlatformAdmin`, `AuditLog`, `ClubInvitation`, `ClubClaim`, `ClubTask`, `PlatformContent`, `MeetingCheckInToken`, `TaskAssignment`, `TaskFile`, `PlatformViewSession`, `RecruitingRule`, `RecruitingRuleFlag`.

Missing columns on existing tables:

| Table | Missing current columns |
| --- | --- |
| User | passwordHash |
| StudentProfile | actScore, actEnglish, actMath, actReading, actScience |
| Club | marketingApprovedAt, campusKey, directorySource, claimedAt, testRequirement |
| ClubMember | groups, cohort, isOwner, permissions |
| PipelineRound | anonymousReview, interviewKit, kitVersion |
| Application | anonymousReviewText |
| Event (Meeting model) | audience, endDate, agenda, recap, resources, revision |

**RISK:** Live authorization, anonymous review, ACT support, meetings, tasks, interview persistence and recruiting rules depend on missing schema. The two unmatched public users require identity provenance review, particularly given the reconciliation trigger. They were not modified or identified in this report.

**HUMAN VERIFICATION STEP:** Confirm the server database target, then inspect unmatched-user dependencies privately and compare the full schema to the migration chain on a restored copy. Historical intent and whether those two records are deliberate seed records are UNKNOWN. No cleanup or identity merge should be inferred from these counts.

## 11. Backups, retention, cleanup and deletion outside the repo

**CURRENT DEPLOYED STATE:** Supabase lists **8 physical database backups**, dated September 21–28, 2026. Latest: September 28 at **09:19:47 UTC**. The page says backups run daily. PITR is **not enabled**: its page offers the add-on. The backup page explicitly states **Storage object bytes are not included**.

No `pg_cron` or `pg_net` extension is installed in this database. The application `AuditLog` table is absent. These facts do not prove that external scheduled jobs or provider logs do not exist.

**EVIDENCE:** [Scheduled backups](https://supabase.com/dashboard/project/htlgjluegmdwfjkzzwic/database/backups/scheduled), [PITR](https://supabase.com/dashboard/project/htlgjluegmdwfjkzzwic/database/backups/pitr), `pg_extension`, and table inventory. No restore was performed.

**UNKNOWN:** guaranteed backup retention beyond the visible eight snapshots; restore-test history/RPO/RTO; offsite copies; Storage object backups/versioning; Auth/provider/Vercel audit-log retention and exports; Resend message retention; external orphan cleanup, malware scanning, deletion schedules and user-erasure runbooks.

**RISK:** Database backup visibility is not evidence that uploaded documents can be recovered. Missing application audit persistence reduces traceability. No assurance about external deletion or retention controls is possible from repository code or the inspected catalog alone.

**HUMAN VERIFICATION STEP:** Read the organization's Supabase plan/backup retention and log-drain settings, Vercel log retention/drains and Cron Jobs, Resend retention settings, GitHub Actions schedules, and any cloud scheduler/object-backup accounts. Obtain the operator's retention/deletion runbook, job execution evidence and most recent restore-test result. Inspect configurations and records only; do not click Restore or trigger cleanup.

## 12. Real server-backed deployment path

**CURRENT DEPLOYED STATE:** **Vercel serves the current server-backed application.**

- Project: `thefritz2008-5266/out-class`.
- Current Production deployment: `5Q7JMqoWSXmXgMTuRFzcZmzgv9aj`, Ready.
- Primary alias: `https://out-class.vercel.app`.
- Deployment host: `out-class-44lmb9bv0-thefritz2008-5266.vercel.app`.
- Source: `main`, commit `c6d1d371ad9bbdc83804609db422e2f481fe221f`.
- Deployment details show September 28, 2026, 12:33:04 UTC and build duration 1m 18s.
- Resources include Node.js 24.x functions in IAD1 for `/api/application-attachments`, `/api/auth/password-recovery`, `/api/demo`, `/api/platform/view-as`, `/api/resumes`, `/api/users/me`, plus routing middleware.

**EVIDENCE:** [Vercel current production deployment](https://vercel.com/thefritz2008-5266/out-class/5Q7JMqoWSXmXgMTuRFzcZmzgv9aj) and its [resources](https://vercel.com/thefritz2008-5266/out-class/5Q7JMqoWSXmXgMTuRFzcZmzgv9aj/resources); public Supabase URL environment value; matching local git commit.

The repository still contains `.github/workflows/deploy.yml`, a GitHub Pages workflow that uploads `./out`. This is configuration evidence only. Whether a separate Pages site is currently enabled or receiving traffic is **UNKNOWN**; it is not the observed Vercel server deployment.

**RISK:** A Ready deployment does not certify backend schema readiness. Multiple deployment configurations can create ambiguous operational ownership. The Vercel database secret may point elsewhere; it was intentionally not exposed.

**HUMAN VERIFICATION STEP:** In GitHub repository Settings → Pages and Actions → “Deploy Next.js site to Pages,” inspect the actual publishing source and latest run. In Vercel, privately confirm the current deployment's database target and environment snapshot. No deployment or rerun is needed to inspect these records.

## Appendix A — Repeatable read-only catalog checks

Run against the intended production connection in an explicitly read-only transaction. These are verification queries, not remediation instructions.

```sql
BEGIN READ ONLY;
SELECT current_database(), current_user;
SELECT n.nspname,c.relname
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relname='_prisma_migrations';
SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version;
SELECT c.relname,pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity,c.relforcerowsecurity,c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname;
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname IN ('public','storage')
ORDER BY schemaname,tablename,policyname;
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets;
SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure);
SELECT tgname,tgenabled,pg_get_triggerdef(oid)
FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal;
SELECT status,factor_type,count(*) FROM auth.mfa_factors GROUP BY 1,2;
ROLLBACK;
```

If a Prisma ledger exists on a different verified target, inspect `migration_name, started_at, finished_at, rolled_back_at, applied_steps_count, checksum` ordered by `started_at, id`. Do not treat an unfinished or rolled-back row as successfully applied. No such ledger was available on the inspected project.

## Appendix B — Active function definition

Returned by `pg_get_functiondef`; reproduced without changing it:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  normalized_email text;
  existing_user_id text;
BEGIN
  IF NEW.email IS NULL THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  normalized_email := lower(trim(NEW.email));

  IF normalized_email !~
    '^[a-z0-9]+([._+-][a-z0-9]+)*@virginia\.edu$'
  THEN
    RAISE EXCEPTION 'Only @virginia.edu email addresses are allowed';
  END IF;

  SELECT id
  INTO existing_user_id
  FROM public."User"
  WHERE lower(email) = normalized_email
  LIMIT 1;

  IF existing_user_id IS NOT NULL
     AND existing_user_id <> NEW.id::text
  THEN
    -- Test/dev reconciliation:
    -- replace the stale public.User ID with the current auth.users UUID.
    UPDATE public."User"
    SET
      id = NEW.id::text,
      email = normalized_email
    WHERE id = existing_user_id;

  ELSE
    INSERT INTO public."User" (
      id,
      email,
      role,
      "createdAt"
    )
    VALUES (
      NEW.id::text,
      normalized_email,
      'STUDENT'::public."AppRole",
      COALESCE(NEW.created_at, now())
    )
    ON CONFLICT (id)
    DO UPDATE SET
      email = EXCLUDED.email;
  END IF;

  RETURN NEW;
END;
$function$;
```

Active trigger:

```sql
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

No fixes, migrations, policy changes or provider-setting changes were made.
