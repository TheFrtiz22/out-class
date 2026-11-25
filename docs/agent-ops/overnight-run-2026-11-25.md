# Overnight launch-readiness run, 2026-11-25

Owner brief: 10-hour unattended run as lead engineer (owner message 2026-11-25 06:02 UTC). Owner approved, for this run only, merging to main, production deploys and production database migrations, under the brief's gates. Everything else in CLAUDE.md and AGENTS.md applies.

Times are UTC. "Ran" means executed here or in CI; "read" means verified by reading code only.

## Session start (06:05)

- main `8a70a46` (#541). Production deployment `dpl_2S19S64aiez6wvH13W1UdWpvHfVM` READY on the same SHA. Previous production (rollback target): `dpl_rTzcqHjQHmTYGLDQgDUx9iVxVULx` (`da2586d`).
- Open PRs: #532 (short-answer question type, includes a production DB change), #288 and #200 (owner drafts, left alone).
- CI on main: dependency audit now green (the zod/picomatch advisories are no longer red). "Applicant workflow / shell" has been cancelled at its 75-minute limit on every recent main run.
- Sentry (production, 7 days): only OUT-CLASS-G/H, the 22-minute database login outage of Nov 24 03:16–03:38. Nothing new since.
- Supabase: production `OutClass` (us-west-2) and `outclass-staging` (us-east-1), both healthy.
- Docs named in the brief: `site-review-backlog-2026-11-16`, the hardening audits, `outclass-execution-plan`, `outclass-roadmap` are not in the repo, the project files or Google Drive (searched by title). Used instead: the Nov 24 web and mobile stress-test reports (project files), the handoff, the task ledger and the feature docs.

## Environment limits

- Linux container: no iOS simulator or Android emulator. App journeys are checked through the app's jest suite (CI `mobile` job), the `/api/mobile/v1` server routes and code reading. None is claimed as run on a device.
- Dependencies: installing the project's lockfile here needs the owner's separate yes (agent rule on installs a project's files list), so the full gates run in GitHub Actions on each PR (`validate` = test, test:migrations, lint, typecheck, build; `mobile`; `dependency-audit`; disposable integrations). Local checks use only what runs without installing.
- Postgres 16 is installed in this container, available as a disposable database.

## Work list

(Built from the stress-test reports and CI, each item checked against main before work.)

| # | Item | Source | Status |
| --- | --- | --- | --- |
| A | CI "Applicant workflow / shell" hangs to the 75-minute limit on every main run | CI on main | PR #544 (fix), CI running |
| B | Club with `isDiscoverable=false` still has a public page | Nov 24 web report | Checked: by design ("unlisted"): noindex, out of Explore/search/sitemap, reachable by link for invite-only recruiting. No change. |
| C | Applying to a hidden club by direct link | Nov 24 web report | Same as B: intended for invite-only recruiting. No change. |
| D | Short links (`/q/[code]`) have no rate limit | Nov 24 web report | Stale: `RATE_LIMITS.shortLinks` (600/min) is applied in `middleware.ts`. Codes are 6-char base62. No change. |
| E | Explore directory reads all future events uncached | Nov 24 web report | Measured fine at launch scale (1.35 MB, ~70 ms at 200 clubs). Low priority. |
| F | PR #532 short-answer question needs a production migration | Open PR | Blocked (production migrations gated). Rehearse on disposable Postgres; do not merge. |
| G | 4 unindexed composite foreign keys (Supabase advisor) | Supabase advisor | Checked: already covered. Each FK's two columns are the leading columns of an existing index, in the other order (e.g. `ApplicantRecusal(clubId, memberId)` for FK `(memberId, clubId)`); the advisor compares column order. No migration needed. |
| H | Authorization review: mobile API and recruiting actions | Brief step 2 | Reviews running |

## Findings, merges, migrations and deploys


### 06:07 Production migrations are blocked by the environment approval gate

- Dispatched the `Database migrations` workflow as a dry run on `main` (run 45558285500). It waits on the GitHub "Production" environment, whose only required reviewer is the owner.
- Approving that pending deployment from this session was refused by the agent's permission guard. Per the brief, not worked around. Cancelled the waiting dry run so no approval request is left open.
- Consequence: no production migration can run tonight. Migration work (PR #532, the missing indexes, the push-session column) is prepared and rehearsed on disposable Postgres only, and not merged, because `prebuild` (`check-release-database.cjs --vercel-production-build`) blocks a production deploy whose schema is ahead of the database.
- To unblock: the owner approves the workflow run in GitHub (Actions → Database migrations → Review deployments).

### 06:25 Supabase performance advisor: no real gap

- The 4 "unindexed foreign key" findings are covered by existing composite indexes whose leading columns are the FK's columns in a different order. Postgres uses them for the FK equality lookups. No migration.
- 70 "unused index" findings: expected before launch (little traffic). Not dropping any: removing indexes is not additive and could hurt at launch load.
- Auth uses a fixed 10 connections: noted for the owner, a dashboard setting, not code.

### 06:30 Migration rehearsal on disposable Postgres 16

- Fresh local Postgres 16 with the Supabase roles the repo's own harnesses create (`anon`, `authenticated`, `outclass_production_app`, `auth.sessions`): all 101 migrations on main apply cleanly, in order.
- PR #532's `20261123120000_short_answer_question` then applies cleanly on top: adds enum value `SHORT_ANSWER`, nullable `ApplicationQuestion.characterLimit`, and the 1–500 CHECK. Additive, no data rewritten.
- Production ledger (read-only query): 101 applied, 0 unfinished, latest `20261118140000_native_push_platform_required`, matching main.
- #532 stays unmerged: its new column would make `prebuild` block the production deploy until the migration runs, and running it needs the owner's approval in GitHub.
