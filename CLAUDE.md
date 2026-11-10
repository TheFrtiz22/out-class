# OutClass — Claude Code project instructions

OutClass is a multi-school campus club operating system, beginning at UVA. It serves students discovering/applying to organizations and club leaders running recruiting, interviews, meetings, voting, decisions, events, communications, and attendance. Preserve working behavior while completing the release. Do not rebuild from scratch or introduce competing sources of truth.

## Read these first
1. `AGENTS.md` for authoritative Phosphor interface-icon rules. It applies alongside this document.
2. `docs/CLAUDE_CODE_HANDOFF_2026-11-04.md` for the dated handoff, live-system checkpoints, product requirements, connection checks, and release priorities.
3. Relevant **current code**, Prisma schema/migrations, tests, and the specific feature's docs. Documentation from earlier October may describe features that have since been implemented or replaced. Verify against `main`.
4. `docs/staging-security-rls-20261101.md`, `docs/database-deployment.md`, `docs/disposable-integration-ci.md`, `docs/product-integration-audit.md`, and `docs/qr-attendance.md` before backend or release work.

## Tech and architecture
- Next.js 15 / React 19 / TypeScript / pnpm; Prisma 6 -> PostgreSQL on Supabase; Supabase Auth and Storage; Vercel hosting and three protected cron routes.
- Prisma migrations own the application schema. Supabase CLI migrations are **not** the canonical Prisma migration ledger. Never reset, baseline, or rewrite an existing environment to make migrations appear green.
- Server actions and trusted server handlers enforce identity, club capabilities, authorization, revision checks, and ownership. The browser must not gain direct access to private Prisma tables, applicant data, notes, resumes, voting records, or service-role credentials.
- Demo and preview paths must remain distinctly isolated from production writes and data. Where a feature claims to work across devices, use authoritative server persistence, not browser-local placeholders.
- Email: preserve existing Supabase Auth SMTP, invitation delivery and the canonical notification/outbox/digest/Resend logic. Read the current source before proposing replacement.
- Search: PostgreSQL is source of truth; Typesense, when configured, is optional public-club discovery acceleration. Never index private applicant data or grant unrestricted search keys to browsers.
- QR: **always** use `@/components/qr/outclass-qr-code` and `@/lib/qr` with the first-party short-link system. Preserve branded monogram, high error correction, accessible export/scanning, and server-authorized identity-bound attendance. Do not add generic QR generators.
- Interface icons: **Phosphor**, through `@/components/icons`, not Lucide (older discussions mentioning Lucide are superseded). Follow `AGENTS.md`.
- Scheduling/availability: preserve the established Eastern display behavior, 8 AM–9 PM editor boundary, approvals, private panel drafts, immutable published history, and version/conflict checks. Do not casually add timezone controls to the interview UI.
- Product identity: polished, compact, calm, premium editorial UX; distinctive OutClass branding, campus photography/Rotunda where established, minimal helper text and no generic clip-art. Preserve accessible keyboard/focus, responsive layouts, and motion-reduction support.
- Growth: support multiple schools through scoped data, themes, identities and planned school-specific subdomains, rather than forking the entire app per school. Initial launch is UVA. A native mobile client is an extension of secure shared APIs, not a reason to replace the functioning web application.

## Work protocol
1. At session start inspect `git status`, recent commits, target branch, open PRs, relevant CI, deployment source, and existing tests. Check whether the local worktree contains changes from Codex or teammates; do not overwrite them.
2. Before changes, map the requested user journey and its API/auth/database/notification impacts. Distinguish **implemented**, **partially implemented**, **demo-only**, and **unverified**. Treat legacy audits as historical, not current truth.
3. Prefer a small, reviewable feature branch/PR. Preserve IDs, action contracts, audit trails, foreign-school isolation, RLS, triggers, auth flows, optimistic revisions, and no-duplicate delivery invariants.
4. No unapproved production database migrations, SQL/ACL edits, auth/storage changes, credential rotations, deployments, merges, email sends, or destructive data writes. Use disposable local/test infrastructure for write tests. Production inspection is read-only unless explicitly approved.
5. Protect secrets and student PII: do not print or commit `.env`, credentials, tokens, auth sessions, production data dumps, or private logs. Limit MCP tools to the project and prefer read-only access to production.
6. Run targeted tests, then the relevant full gates: `pnpm run test`, `pnpm run test:migrations`, `pnpm run lint`, `pnpm run typecheck`, and `pnpm run build` or `pnpm run validate`. Check skipped/gated integration counts; a successful unit suite is **not** a substitute for authenticated E2E, concurrency, email, Storage, or real-browser verification.
7. Measure regression risks across small and large clubs, cold/warm navigation, mobile, keyboard/accessibility, real error states and degraded integrations. Do not claim a speedup or completeness based only on code review or synthetic runs.
8. At completion, report changed files, the feature preservation matrix delta, tests/skip counts, performance evidence, PR URL, remaining blockers, and what requires owner approval. Keep dated handoff status updated if scope materially changes.

## Agent guardrails (what is enforced, and what is only a tripwire)
- `.claude/settings.json` permission rules ask before pushes, merges, installs, `vercel`, `supabase`, `prisma`, `psql`, `curl` and production-changing MCP tools, and deny file-tool reads of `.env*` secrets (`.env.example` is allowed).
- `.claude/hooks/guard-bash.cjs` is a best-effort **tripwire**, not a security boundary: it denies or escalates the usual forms of push-to-main, force-push, production deploys, migrations and secret printing, but cannot see commands run inside scripts, aliases or runtime-expanded variables (`docs/agent-ops/README.md` lists the gaps). A block or prompt means: stop and ask the owner in chat. Never rephrase a command, or edit the guard, to get past it.
- The real boundaries are outside Claude: GitHub branch protection on `main`, read-only or absent production credentials on dev machines, the `read_only=true` Supabase MCP server, and owner approval.
- Skills: start every session with `outclass-session-start`; `docs/agent-ops/README.md` lists the other OutClass skills and when each applies.
- Reviewer subagents (`docs/agent-ops/README.md` says which to use when) have Read, Grep and Glob only: no shell, no MCP. **You** run tests and read-only MCP queries and pass the diff and results in; they judge the evidence. You decide.
- Records live in `docs/agent-ops/`: append a task-ledger row per task with acceptance criteria, evidence and wall time; append gate results to `validation-report.md`. Keep this file under ~8 KB; put changing plans in the ledger, not here.
- Branches: create with `git switch --no-track -c <area>/<slug> origin/main`. Never set an upstream of `origin/main` (Nov 4 auto-push incident).
- Efficiency: one task, one branch, one acceptance check. Use a cheaper model for search and summaries, the strongest model for auth, migrations and concurrency. After two failed attempts at the same plan, stop and report the diagnosis instead of retrying. Do not add plugins, MCP servers or third-party skills without an entry in `docs/agent-ops/decision-log.md` and owner approval.

## Immediate mission
Follow the launch-oriented read-only inventory and phased execution checklist in `docs/CLAUDE_CODE_HANDOFF_2026-11-04.md`. First establish verified current state and real remaining release blockers; then resolve the highest-impact issues in sequence without architectural rewrites or unsafe production actions.

