# Restore drill

Goal: prove, once now and then every quarter, that production can be restored from backup, how long it takes, and that the restored copy works. Until it has been done the backup is unverified. Status (2026-11-11): **never run** (listed as P1 in `docs/agent-ops/migration-reconciliation-2026-11-09.md`).

Owner-only: it needs Supabase dashboard access and production credentials. Everything below reads production or writes to a **new, separate** project. Never restore into, or "restore in place" on, the production project during a drill. In-place restore replaces production data and causes downtime.

## 1. Confirm what backups exist

Supabase dashboard → the production project → **Database → Backups**.

Record:

- [ ] Plan (Free has no downloadable backups; Pro and above keep daily backups: 7 days on Pro, 14 on Team, 30 on Enterprise).
- [ ] **Point-in-time recovery (PITR)**: on or off, and its retention window. PITR is a paid add-on (Project Settings → Add-ons) that restores to any second within the window instead of only to the last daily backup.
- [ ] Time of the most recent daily backup, and that the list has one per day without gaps.
- [ ] Storage: database backups do **not** include Storage object files (résumés, headshots, flyers, club assets, task submissions). Only the `storage.objects` rows are in the database. Note whether anything else backs up the bucket contents. If nothing does, record it as a known gap.

If backups are off or the plan is Free, stop here: that is the finding. Decide on the plan or PITR before launch.

## 2. Restore into a separate project

Use one of these, in order of preference:

**A. Restore to a new project** (Backups page → **Restore to a new project**, available with PITR or physical backups on paid plans). Choose a recovery time a few hours back. Supabase creates a new project, same region, from that point. It is billed while it exists.

**B. Download a daily backup and restore it into throwaway PostgreSQL 17** (when the dashboard offers a download):

```sh
docker run -d --name outclass-restore -e POSTGRES_PASSWORD=<local-only> -p 127.0.0.1:55499:5432 postgres:17
# Supabase backups reference Supabase roles; create them first or ignore those ownership errors
gunzip -c <backup>.backup.gz | psql "postgresql://postgres:<local-only>@127.0.0.1:55499/postgres" -v ON_ERROR_STOP=0
```

Keep the downloaded file and the container on an encrypted disk, delete both when done, and never commit or share them: they contain student data.

Record the start time, the time the restored database first accepts connections, and any errors.

## 3. Verify the restored copy

Run all of these against the **restored** database. Do not run the app's write paths against it.

1. **Schema history matches.** `DATABASE_URL=<restored URL> npx prisma migrate status` reports no pending or failed migrations relative to the commit production runs (`/api/health` shows it).
2. **Schema fingerprint matches.** `psql "<restored URL>" -X -At -F ' | ' -v ON_ERROR_STOP=1 -f scripts/db/schema-fingerprint.sql > fingerprint-restored.txt` and compare with a fingerprint of production taken the same day. Expected difference: none, apart from rows added since the recovery time.
3. **Row counts are plausible.** Compare `SELECT count(*)` on `"User"`, `"Club"`, `"Application"` and `"ClubMember"` between production and the restored copy. Counts should match production as of the recovery time.
4. **Security survived.** RLS is still enabled on every `public` table (`SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;` returns nothing), and the `outclass_*` Storage policies and the `on_auth_user_created` trigger exist.
5. **Auth (option A only).** `auth.users` has the same count, and a test account can sign in against the restored project's Auth URL.
6. **The app boots on it (option A).** Run the app locally with `.env.local` pointing at the restored project, sign in with a test account and open a club page. Keep `COMMUNICATIONS_EMAIL_ENABLED` unset and SMTP blank so no email can be sent to real students. Do not run the cron routes against it.
7. **Pending migrations apply (optional rehearsal).** If a migration PR is waiting, run `pnpm run db:deploy` against the restored copy and repeat the fingerprint. The only difference should be that migration's changes.

## 4. Clean up

Delete the new Supabase project (Project Settings → General → Delete project) or the local container and backup file. Confirm nothing points at the restored copy.

## 5. Record the result

Append a dated entry to `docs/agent-ops/validation-report.md` (heading `## <date> OPS-RESTORE-DRILL`) with: plan, PITR on or off and retention, backup chosen and recovery time, method (A or B), time to restore (start to first connection), results of each check in section 3, the Storage-files gap if it exists, and the cleanup confirmation. Add a row to `docs/agent-ops/task-ledger.md`, and set a reminder to repeat it in three months and before any large migration.

No credentials, connection strings, row contents or student data go in the record. Counts and pass or fail only.
