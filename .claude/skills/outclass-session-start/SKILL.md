---
name: outclass-session-start
description: Use at the start of any OutClass work session, before planning or editing, to establish verified current state (branch, main SHA, open PRs, CI, production deploy SHA, migration parity) in under 5 minutes.
---

# OutClass session start

Goal: a short, verified snapshot so the session never builds on stale handoff notes.

## Inputs
- The task the owner asked for (one sentence).

## Steps (read-only)
1. `git status --short` and `git branch --show-current`. If there are uncommitted changes you did not make, stop and ask whose they are. Never stash or discard them.
2. `git fetch origin main` then `git log -8 --oneline origin/main`.
3. `gh pr list --state open` and `gh run list --limit 5`.
4. Vercel MCP (read-only): latest production deployment for project `out-class`: state and `githubCommitSha`. Note if it differs from `origin/main`.
5. Supabase MCP (read-only server only): `list_migrations` is NOT the Prisma ledger. For parity, compare `ls prisma/migrations` with the newest entry recorded in `docs/` or ask the owner; do not query production tables for data.
6. Confirm the current branch was created with `--no-track` and does not track `origin/main`.
7. Open `docs/agent-ops/task-ledger.md` and find or add the row for this task.

## Output (paste in chat, max 12 lines)
```
main: <sha> (<n> commits since last ledger entry)   prod deploy: <sha> <state>
branch: <name> (tracking: none|<remote>)   worktree: clean|dirty(<who>)
open PRs: <n>   last CI: <workflow> <conclusion>
task: <ID> <title>   acceptance: <1 line>   budget: <time/cost cap>
risks touched: auth | RLS | migrations | email | cron | demo isolation | none
```

## Stop conditions
- Dirty worktree you did not create, prod deploy SHA not on `main`, or a red CI run on `main`: report and wait for the owner.
