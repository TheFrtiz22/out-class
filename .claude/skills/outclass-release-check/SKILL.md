---
name: outclass-release-check
description: Use before opening or merging a PR into main, and after any merge, to run the release gates, record evidence, and confirm the production deploy built from the merged SHA with no new runtime errors.
---

# OutClass release check

Every merge to `main` auto-deploys to production. This skill is the gate.

## Before the PR
1. `pnpm run test`, `pnpm run test:migrations`, `pnpm run lint`, `pnpm run typecheck`. Record pass, fail and skip counts for each.
2. `node scripts/check-disposable-integration-coverage.cjs`. Record skipped and gated suites, and say whether each skip is environmental or a real gap.
3. If the change touches a journey or authorization, attach the output of `outclass-journey-verify` or `outclass-authz-matrix`.
4. If the change includes a migration: confirm it was rehearsed on disposable Postgres, list every new function and check `SET search_path` is pinned, and list grants to `anon` and `authenticated`. Migration to production requires the owner's written approval in chat.
5. Diff review: no `.env` values, no service-role keys in client code, no new icon library (Phosphor only), QR only via `@/lib/qr`, no new email send path.

## After merge (read-only)
1. Vercel MCP: the production deployment for the merge SHA reaches `READY`.
2. Vercel MCP `get_runtime_errors` for the 30 minutes after deploy versus the 30 minutes before. A new error class is a rollback candidate.
3. Supabase MCP `get_advisors` (security) and compare counts with the last entry in `docs/agent-ops/baseline-log.md`. Any increase is flagged.

## Output
Append to `docs/agent-ops/validation-report.md`:
```
<date> <PR#/SHA> gates: test <p/f/s> migrations <p/f> lint <ok> types <ok> | integration skips <n> (<reasons>)
deploy <id> READY <yes/no> | new runtime error classes <n> | advisor delta <+n/-n> | rollback target <previous deploy id>
```

## Stop conditions
- Any failing gate, a new runtime error class, or an advisor increase: do not merge further work; report the rollback target (`isRollbackCandidate` deploy) and wait for the owner.
