# OutClass handoff to Claude Code

Prepared November 4, 2026 from the existing local checkout. This document records
observations, not a new production audit or a promise that launch work is complete.

## Start here

1. Read `CLAUDE.md` and `AGENTS.md`, then inspect the current branch, working tree
   and recent commits. Do not reset, checkout over, or discard someone else's work.
2. Ask the owner what the final hurdle means: remaining behavior, polish, launch
   readiness, or specific defects. Work toward those priorities using current code.
3. Establish the connections below, with secret values kept out of output.
4. Reproduce the chosen issue, make a focused change and run relevant checks.
   Record what was verified and what still requires owner input or service access.

## Observed checkout

- Workspace: `C:\Users\arden\OutClass\out-class`.
- Origin: https://github.com/TheFrtiz22/out-class.git.
- Branch at handoff: `codex/additional-observation-runtime-access`.
- HEAD at inspection: `668d9417` (Record verified Additional observations production release).
- Existing uncommitted edit: `docs/post-interview-workflow-verification.md`.
  This edit predates the handoff and must be preserved.
- `node_modules` exists. Node reports `v24.21.0`; the available pnpm command reports
  `11.25.0`, while the repository pins `10.17.1`. Use the pinned version for installs
  and CI parity; do not regenerate the lockfile with a different major version.
- Only `.env.example` was found among root `.env*` files. No application database
  or Supabase credentials were found in the inspected process environment.
  This means this shell's live app connection is unverified, not that hosted
  configuration is missing. Do not copy example placeholder values as working secrets.
- `.vercel` and a local Claude desktop installation directory exist. Neither proves
  that Claude Code is authenticated or that a hosting connection is usable.
- No `claude` or `gh` command was found on the inspected shell PATH initially.
  Claude Code native version `2.1.318` was subsequently installed at
  `C:\Users\arden\.local\bin\claude.exe` and its directory added to the user PATH.
  Open a new terminal to pick up the PATH change. `claude auth status` reported
  `loggedIn: false`, `authMethod: none`; owner sign-in is still required.
- `.claude/skills/` already contains Prisma Composer/Platform skills. Their presence
  does not establish that this app runs on Prisma Platform: current application
  code and deployment workflow use Prisma ORM, Supabase and Vercel.

## Connection checklist

| Connection | What to verify in Claude's own session |
| --- | --- |
| Claude account | Launch Claude Code, sign in with the account holding the intended subscription, then inspect `/status`. Confirm subscription authentication rather than assuming an API billing account is intended. |
| Local repository | Open this exact workspace; confirm origin, branch, HEAD and existing changes. Claude does not receive prior Codex conversations automatically. |
| GitHub | Local Git remote is configured. Verify Claude's Git/CLI or MCP authentication and read access to repository, PRs and Actions. A configured remote alone does not prove push permission. |
| Vercel | Verify account/team/project access through Claude's own CLI or MCP. Inspect project and environment scope without printing values. Read current deployment source/status before release work. |
| Supabase / PostgreSQL | Obtain the intended local or staging configuration through the owner's secure setup. Inspect `utils/prisma.ts` connection precedence and existing Supabase client configuration. Verify read-only connectivity first. Never substitute production as a test database. |
| Private Storage / Auth | Use a designated test account in the intended environment. Check upload/download authorization and signup/recovery only within approved test scope. Read `docs/database-deployment.md` and `docs/authorization.md`. |
| Email / workers | `.env.example` documents SMTP, optional Resend communications and cron settings; `vercel.json` contains delivery schedules. Confirm environment and delivery flags before testing sends. Never use real recipients as fixtures. |
| Optional Typesense | Read `docs/typesense-integration.md` only if search indexing is in scope; it is optional and does not replace the database. |

Codex plugins and connector credentials do not transfer with this repository.
Configure only the services needed for the work in Claude itself. Do not copy
Codex configuration or credential files into Claude, Git or this document.

## Commands and checks

The complete command list is in `package.json`; CI is in `.github/workflows/`.

```text
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm test:migrations
pnpm build
pnpm validate
```

Use pnpm 10.17.1 for these commands. Install runs Prisma Client generation and PDF
asset copying. `prebuild` includes a production-only read-only database gate;
do not bypass it to force a deployment through. A local build without credentials
is not proof of working Auth, database, Storage, email or protected workflows.
Some existing test runners provision and mutate disposable resources: inspect
their environment guards before running them. Browser commands are listed as
`test:*:e2e` and `test:a11y*` in `package.json`.

## Useful context, read by scope

- Product/workspaces: `docs/application-shell.md`, `docs/club-workspace.md`,
  `docs/student-home.md`, `docs/platform-admin.md`.
- Auth and data: `docs/authorization.md`, `docs/database-deployment.md`,
  `utils/auth.ts`, `utils/prisma.ts`, `prisma/schema.prisma`.
- Design: `docs/design-system.md`, `docs/icons.md`, `styles/tokens.css`.
- Interviews: `docs/interview-mode.md`, `docs/interview-collaboration.md`,
  `docs/post-interview-workflow-verification.md` and the receipt for the actual
  feature being changed. Latest local HEAD concerns Additional observations.
- Release review: `docs/production-readiness-review.md`,
  `docs/accessibility/MANUAL_ACCESSIBILITY_TESTS.md`, `.github/workflows/deploy.yml`.

Documents contain dated checkpoints, superseded blockers and old deployment IDs.
Even documents headed "current" can be historical. Verify source revision and
current service state before acting; never replay an old recovery procedure just
because a receipt describes it. `DEPLOYED_BACKEND_STATE.md` is historical evidence,
not an automatically refreshed inventory.

The October readiness review recorded owner-approved Privacy/Terms/support
content, mobile performance and real integration/manual checks as remaining work.
Recheck the present implementation before labeling any of these still open.
The November 3 post-interview receipt records Linux CI success and several local
Windows/CRLF/timezone limitations; it does not establish today's full-suite result.

## Suggested first message

> Continue OutClass from this checkout. Read CLAUDE.md, AGENTS.md and
> docs/claude-code-handoff.md first. Preserve existing edits. Inspect current code
> and release evidence, verify which local and service connections actually work,
> and tell me what needs my login. Help me define the final launch priorities,
> then reproduce and finish the highest-priority issue with relevant verification.
> Do not infer production authorization from historical release receipts.

## Handoff verification scope

This preparation inspected local setup, scripts, architecture entry points,
deployment conventions and selected release records. It did not rerun the full
application suite, audit every feature, verify hosted credentials, or change
production. The new handoff files should pass `git diff --check`; app tests are
unnecessary for documentation-only changes.
