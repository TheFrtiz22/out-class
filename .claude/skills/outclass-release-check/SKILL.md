---
name: outclass-release-check
description: Use before opening or merging a PR into main, and after any merge, to run the release gates, record evidence, and confirm the production deploy built from the merged SHA with no new runtime errors.
---

# OutClass release check

Every merge to `main` auto-deploys to production. This skill is the gate. You (the main session) run every command and read-only query; the reviewer subagents only read the evidence you hand them.

## Before the PR
1. Application gates: `pnpm run test`, `pnpm run test:migrations`, `pnpm run lint`, `pnpm run typecheck`. Record pass, fail and skip counts for each, verbatim.
2. `node scripts/check-disposable-integration-coverage.cjs`. Record skipped and gated suites, and whether each skip is environmental or a real gap.
3. If `.claude/` changed: `pnpm run test:agent-hooks`. Report it separately; it is not an application test.
4. Write `git diff origin/main...HEAD` to a file, then invoke every reviewer whose row in `docs/agent-ops/README.md` matches the diff (`authz-reviewer` for identity, data access, Storage, cron or migrations; `migration-reviewer`, `nextjs-reviewer`, `failure-path-reviewer`, `test-gap-reviewer` by area), in parallel, each with the file path, the test counts and the acceptance criteria.
5. If the change includes a migration:
   - Rehearse it on disposable Postgres (`node scripts/run-disposable-postgres.cjs` or the relevant `scripts/test-*-local.cjs`).
   - List every `SECURITY DEFINER` function and confirm it sets `search_path` (`SET search_path = ''` with schema-qualified names for definer functions, as in `20261104230000_inbox_realtime_signal`; `pg_catalog, public` is used for trigger functions).
   - List every GRANT, REVOKE and `CREATE POLICY … TO` with role and reason. Grants to `outclass_production_app` and narrowly scoped policies `TO authenticated` (as in the realtime inbox migration) are established patterns. A new grant to `anon`, `authenticated` or `PUBLIC` needs a written reason and an `outclass-authz-matrix` test.
   - Applying it to production requires the owner's written approval in chat. The tripwire escalates `prisma migrate deploy` and `db:deploy` for this reason.
6. Diff review: no `.env` values, no service-role keys in client code, Phosphor icons only, QR only via `@/lib/qr`, no new email send path.

## After merge (main session collects, read-only)
1. Vercel MCP: production deployment for the merge SHA, its state, and the previous READY production deployment (rollback target).
2. Vercel MCP `get_runtime_errors` for the 60 minutes after deploy and the 24 hours before; runtime logs for the three `/api/internal/*` cron routes.
3. Supabase MCP `get_advisors` (security and performance): counts by level and lint name.
4. Write those results to a file and invoke `release-verifier` with its path. It compares against `docs/agent-ops/baseline-log.md` and returns a verdict.

## Output
Append to `docs/agent-ops/validation-report.md`:
```
<date> <PR#/SHA> app gates: test <p/f/s> migrations <p/f> lint <ok> types <ok> | integration skips <n> (<reasons>) | agent-hook tests <p/f or n/a>
deploy <id> READY <yes/no> | new runtime error classes <n> | advisor delta <+n/-n> | rollback target <previous deploy id> | verdict <OK/WATCH/ROLLBACK-CANDIDATE>
```

## Stop conditions
- Any failing gate, a new runtime error class, or an advisor increase: do not merge further work; report the rollback target and wait for the owner. Never trigger a rollback yourself.
