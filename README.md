# OutClass

OutClass is a campus operating system for student organizations. Students discover clubs, apply with a reusable profile, book interviews and follow decisions. Club leaders run recruiting (applications, review, interviews, live voting, decisions and offers), membership, meetings and events, announcements and QR attendance in one place. It launches at the University of Virginia and is built to support more schools through school-scoped data rather than separate deployments.

## Stack

- Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- Prisma 6 on PostgreSQL (Supabase). `prisma/migrations` is the only schema history.
- Supabase Auth and Storage
- Vercel hosting, with three protected cron routes (`vercel.json`)
- Email: Supabase Auth SMTP and Resend for notifications
- Sentry for errors, Vercel Analytics and Speed Insights
- pnpm 10 and Node 22.13 or later

## Local setup

```sh
corepack enable                  # provides the pnpm version pinned in package.json
pnpm install                     # also runs prisma generate and copies PDF.js assets
cp .env.example .env.local       # then fill in the values below
pnpm exec supabase start         # local Postgres, Auth, Storage and Mailpit (needs Docker)
pnpm exec supabase status        # prints the local API URL, keys and database URL
```

In `.env.local`, set at least `DATABASE_URL` (the local database URL from `supabase status`), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`. Everything else in `.env.example` is optional and documented there; features whose keys are missing stay off. Never commit `.env*` files other than `.env.example`, and never point a local setup at the production database.

Apply the schema to the local database and start the app:

```sh
pnpm run db:deploy               # prisma migrate deploy, after the migration-path guard
pnpm dev                         # http://localhost:3000
```

Supabase CLI migrations are disabled on purpose (`supabase/config.toml`). Do not use `prisma db push` or `prisma migrate reset` against any shared database.

## Tests

| Command | What it runs |
| --- | --- |
| `pnpm run test` | Unit and component suites (`node --test tests/*.test.cjs`). Environment-gated suites report as skipped. |
| `pnpm run test:migrations` | Every migration on fresh and legacy PostgreSQL, plus RLS checks |
| `pnpm run lint` / `pnpm run typecheck` | ESLint and UI-control checks / `tsc --noEmit` |
| `pnpm run build` | Production build and source-map check |
| `pnpm run validate` | All of the above, as CI runs it |
| `pnpm test:a11y` | axe accessibility checks on public pages |
| `node --test tests/<file>.test.cjs` | One suite |

Integration suites that boot Auth, Storage, SMTP or native PostgreSQL run on disposable local infrastructure; see [docs/disposable-integration-ci.md](docs/disposable-integration-ci.md). CI (`.github/workflows/deploy.yml`) also runs a production dependency audit that fails on high or critical advisories not listed in `.github/audit-allowlist.json`.

## Database migrations

1. Add a new Prisma migration in the PR. Never edit a migration that has been applied anywhere.
2. CI and `pnpm run test:migrations` rehearse it on disposable PostgreSQL.
3. When the PR is ready to merge, run **Actions → Database migrations** (`.github/workflows/database-migrate.yml`) with the PR's branch as `ref` and **dry run on**. Check that only the expected migrations are pending.
4. Run it again with dry run off. A repository owner approves the run through the `production` environment.
5. Merge the PR. Migrations are applied **before** the code that needs them is deployed; the production build's read-only schema check refuses to publish code whose columns are missing.

Details: [docs/database-deployment.md](docs/database-deployment.md).

## Deploys

Vercel deploys every push: pull requests get preview deployments, and a merge to `main` deploys production. `main` is protected and merges need green CI. If a deploy goes wrong, follow [docs/rollback.md](docs/rollback.md).

`GET /api/health` returns `{ ok, version }` with 200 when the database answers and 503 when it does not; it is the target for uptime monitoring.

## Runbooks and docs

- [docs/rollback.md](docs/rollback.md): bad deploy, bad migration, service-worker kill switch, maintenance mode
- [docs/restore-drill.md](docs/restore-drill.md): confirm backups and rehearse a restore
- [docs/monitoring.md](docs/monitoring.md): health endpoint, uptime monitor and alert rules
- [docs/database-deployment.md](docs/database-deployment.md): migration process and Storage policies
- [docs/service-worker.md](docs/service-worker.md): installable app and how to turn it off
- [docs/sentry.md](docs/sentry.md): what error reports contain
- [docs/turnstile.md](docs/turnstile.md): optional bot checks
- [docs/disposable-integration-ci.md](docs/disposable-integration-ci.md): integration test runners
- [docs/authorization.md](docs/authorization.md): roles and capabilities
- [docs/agent-ops/README.md](docs/agent-ops/README.md): how coding agents work in this repository

## Security

Report vulnerabilities privately to the repository owner rather than in a public issue.
