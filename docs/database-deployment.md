# Authoritative database and Storage deployment

**prisma/migrations is the only application-schema migration history.** Prisma also carries the corrective private-resume Storage patch. The unchanged Supabase remote snapshot is archived under supabase/archive for comparison, not execution. Supabase CLI migration replay is disabled in config.toml. database/attendance.sql is an obsolete reference design, not deployable schema; do not apply it. Do not run both histories, use db push to reconcile drift, reset an existing database, or blindly mark migrations applied.

## Existing installations: stop and reconcile first

1. Take a recoverable database backup and schema-only dump; record Storage bucket policies/settings separately. Use a restored staging copy. Preserve auth identities, object bytes, and application IDs.
2. Inspect both tracking tables, if present: public._prisma_migrations and supabase_migrations.schema_migrations. Inspect actual tables, constraints, enums, triggers, grants, policies and indexes. History entries alone are not evidence of an equivalent schema.
3. Compare the actual public schema with the committed Prisma baseline and each additive migration. The archived remote snapshot overlaps the baseline but is not equivalent: it contains multiple enum naming conventions and a public resume SELECT policy. Do not replay it or infer a baseline from its timestamp.
4. If Prisma history is already aligned, investigate failed/checksum-divergent migrations and review pending SQL before deployment. Never edit previously applied migrations to silence a checksum problem.
5. If application tables exist without a matching Prisma baseline, prepare a reviewed, installation-specific additive reconciliation plan on the restored copy. Preserve records and dependencies; do not cast/drop duplicate enums or recreate tables speculatively. Only after verifying the exact effects of a migration may an operator use prisma migrate resolve --applied for that migration. Marking an entire chain applied without checking every change is unsafe.
6. Compare counts/IDs and sensitive records before/after; run permission and Storage smoke tests. Then apply the same reviewed reconciliation to the intended database. The repository cannot determine live drift without inspecting that database.

After reconciliation, npm run db:deploy uses Prisma migrate deploy and rejects an active conflicting Supabase SQL history. The repository guard is not a remote drift detector or a baseline approval. Run prisma migrate status and inspect the reviewed plan first. Generate Prisma Client and deploy the application after the required migrations.

## Fresh installations

Provision PostgreSQL (and Supabase Auth/Storage if used). Use npm run db:deploy against an empty application schema, then npx prisma generate. Do not load the archived snapshot. Existing Supabase-managed auth/storage schemas are not replaced by Prisma.

## Private resumes and application attachments

20260928000000_private_resume_storage is an additive, idempotent patch. On Supabase it:
- makes the resumes bucket private, creating it if absent;
- drops the known resumes_select_public policy;
- adds a restrictive SELECT guard for PUBLIC, so another permissive policy cannot expose resumes to browser roles;
- permits authenticated owner-prefix INSERT and restricts broad INSERT policies to that ownership rule.

Owner uploads still use authenticated signed-upload issuance. Downloads use service-role signing after live authorization, not browser Storage SELECT. Both upload and download code reject a public bucket. Existing profile downloads remain bound to the current saved resume; application downloads are separately bound to the current saved FILE_UPLOAD answer and application permissions.

On plain PostgreSQL without Storage the patch deliberately skips Storage, leaving application data unchanged. If Storage is provisioned later, run the same migration SQL directly as the Storage-owning deployment role (psql with ON_ERROR_STOP), then verify its effects; do not pretend a skipped Storage patch provisioned a bucket. It can also be used as a standalone emergency privacy patch on a divergent installation before schema reconciliation. This does not reconcile the application migration history. Do not use Prisma migrate deploy blindly on that installation.

Run supabase/task-submissions.sql for the separate private task bucket as described in tasks.md. It is an idempotent bucket provisioning script, not a competing public-schema history.

## Deployment verification

- Check resumes.public = false and inspect pg_policies for the restrictive guard, including any legacy ALL/SELECT grants.
- Using real anon and authenticated tokens, direct resume listing/download must fail, including for the owner. Owner upload issuance must work; cross-owner upload issuance must fail.
- Authorized /api/resumes and /api/application-attachments reads must redirect to short-lived URLs. Deny outsiders, revoked memberships, draft reviewers, anonymous-round reviewers, guessed/old paths, and foreign application/question references.
- Repeat after Storage policy changes. Service-role signing bypasses RLS intentionally; secrets must remain server-only. Previously issued signed URLs remain usable until expiry (five minutes). Previously public downloaded/cached copies cannot be retracted by policy changes.
- Existing legacy external document URLs remain external links; the server does not fetch or sign them. Internal keys must belong to the applicant. Anonymous review continues withholding attachments.
- Local PGlite tests exercise permissive-policy coexistence and row access plus all application migrations. They do not replace real Supabase API/token smoke tests.

No deployment or remote schema reconciliation is implied by local validation. No destructive migration is supplied.
