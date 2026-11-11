# Rollback runbook

For a production problem after a deploy. Pick the smallest step that stops the harm, then fix forward through a normal PR. Record what happened, the deployment IDs and the time in `docs/agent-ops/validation-report.md`.

| Symptom | First step |
| --- | --- |
| New deploy is broken, schema unchanged | [Vercel instant rollback](#1-vercel-instant-rollback) |
| New deploy is broken and its PR applied a migration | [Migration already applied](#2-a-migration-is-already-applied) |
| Users stuck on stale pages or a bad cached shell | [Service-worker kill switch](#3-service-worker-kill-switch) |
| Writes must stop while you investigate (data being corrupted, bad emails going out) | [Maintenance mode](#4-maintenance-mode) |

Confirm the outcome each time with `https://out-class.net/api/health` (`version` shows the serving commit; see [monitoring.md](monitoring.md)) and Sentry's issue stream.

## 1. Vercel instant rollback

Vercel keeps every production deployment. Rolling back re-points the domains (`out-class.net`, `www`, `uva`) at an earlier deployment in seconds, without a rebuild.

1. Vercel → the OutClass project → **Deployments**, filter to Production.
2. Find the last good deployment. Each release in `docs/agent-ops/validation-report.md` records its "rollback target" deployment ID.
3. Open its menu (⋯) → **Instant Rollback** (or **Promote to Production** on an older deployment) and confirm.
4. Check that all three domains serve it: `/api/health` reports the old commit, and the broken behavior is gone.

Afterwards:

- Vercel pauses automatic production deploys after an instant rollback. Merges to `main` will not go live until you promote again. Fix forward on a branch, merge, then promote the new deployment (or undo the rollback) in the Deployments page.
- Do not revert by force-pushing `main`. If the change must leave `main`, open a revert PR.
- Environment variable changes are not rolled back. If the incident came from an env change, restore the old value and redeploy.
- Cron schedules follow the deployment that is live (`vercel.json`).

## 2. A migration is already applied

Prisma migrations are forward-only here. Never edit, delete or rename a migration that has been applied anywhere: the checksum in `_prisma_migrations` would no longer match, and future deploys would refuse to run (see [database-deployment.md](database-deployment.md)). Never run `prisma migrate reset`, `db push` or `migrate resolve --rolled-back` against production to "undo" one.

1. **Can the previous code run on the new schema?** Our migrations are additive by convention (new tables, nullable or defaulted columns, new indexes and constraints). Usually yes: roll back the app (section 1) and leave the schema in place. The production build's schema check only refuses code whose columns are **missing**, so old code on a newer schema still deploys.
2. **If the old code fails on the new schema** (a column renamed, a constraint the old code violates, a changed enum), write a **new** migration that restores compatibility. Examples: drop the new constraint, re-add the old column, make a column nullable. Review it like any migration: disposable rehearsal (`pnpm run test:migrations`), then **Actions → Database migrations**, dry run first, then apply with owner approval.
3. **If data was damaged**, stop writes first (section 4), then repair with a reviewed forward migration or script tested on a restored copy ([restore-drill.md](restore-drill.md)). A full restore from backup loses every write since the restore point, so it is the last resort and the owner's decision.
4. **If a migration failed partway**, `prisma migrate status` shows it as failed and further deploys stop. Read the migration's own rollback notes in its PR and in `docs/agent-ops/migration-reconciliation-2026-11-09.md`. Fix the cause, then mark it with `prisma migrate resolve` only after checking exactly what was and was not applied.

## 3. Service-worker kill switch

Full details: [service-worker.md](service-worker.md).

1. **Normal path.** Set `OUTCLASS_SERVICE_WORKER=off` for Production in Vercel → Settings → Environment Variables, then redeploy. On the next page load each browser unregisters the worker and deletes the `outclass-*` caches.
2. **If page JavaScript cannot be trusted to run,** copy `public/sw-kill.js` over `public/sw.js` in a PR, merge and deploy (keep the env flag on). Browsers fetch the new `/sw.js` on their next navigation, and it unregisters itself and reloads open tabs.

The worker never caches pages or API responses, only content-hashed `/_next/static` files and the offline page, so a Vercel rollback alone normally fixes stale code. Use the kill switch when the worker itself misbehaves.

## 4. Maintenance mode

Built in admin settings (#245). Off by default.

1. Sign in as a platform administrator → **Platform → Settings** (`/platform/settings`).
2. Optionally write a **Maintenance notice** (shown as a banner to everyone).
3. Turn on **Maintenance mode**, enter a reason (it goes to the audit log), save and confirm.

Effect: signed-in people who are not platform administrators see the maintenance page instead of product pages, and their authenticated Server Actions (the product's write path) are refused with a "changes are paused" message (`utils/auth.ts` calls `assertSiteWritable`). Writes through `/api` route handlers are not covered by this guard. Signed-out visitors still see public pages and can reach sign-in. Administrators (including in support sessions) keep full access so they can verify the fix. `/api/health` and the cron routes are not affected.

Limits:

- The setting lives in the database. If the database itself is down, the settings read times out and the site behaves as if maintenance mode were off. Use a Vercel rollback, or for a total outage rely on the error pages.
- It does not stop the email crons. To stop them as well, set `COMMUNICATIONS_EMAIL_ENABLED=false` for Production in Vercel and redeploy: notification and announcement email stops (anything but `true` disables it) and queued invitation email pauses (only the literal `false` pauses it). Auth emails from Supabase are unaffected.

Turn it off the same way when the fix is live, and check a non-admin account can make a change again.
