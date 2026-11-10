# Agent operations records

Small, append-only records that let anyone (or any Claude session) see what was done, with what evidence, at what cost.
Keep these short. Detailed investigation notes go in feature docs; link them from here.

| File | What goes in it | Written by |
| --- | --- | --- |
| `task-ledger.md` | One row per task: ID, acceptance criteria, status, evidence, cost | main session (`outclass-session-start`), owner |
| `baseline-log.md` | Dated health snapshot: advisors, deploy SHA, runtime errors | main session after `release-verifier` judges it; nightly scheduled task |
| `validation-report.md` | Release gate results per PR / merge | main session (`outclass-release-check`) |
| `journey-matrix.md` | Feature preservation matrix (implemented / partial / demo-only / unverified) | main session (`outclass-journey-verify`) |
| `authz-matrix.md` | Actor × operation access matrix with test references | main session (`outclass-authz-matrix`) |
| `decision-log.md` | Decisions, alternatives, cost, reversal condition | owner, Claude |
| `nightly-health-prompt.md` | The exact prompt for the read-only scheduled health check | owner |

## What each control actually does

| Control | Kind | Holds against | Does not hold against |
| --- | --- | --- | --- |
| Permission rules in `.claude/settings.json` (`ask`, `deny`) | Claude Code permission system | The command forms Claude normally writes, after Claude Code splits `&&`/`;`/`|` and strips wrappers such as `timeout`, `nohup`, `xargs` | Per the official docs, the same program in another form: by absolute path, inside `sh -c`, `git -C . push`, `git -c … push`. Bash rules "aren't a security boundary around the program" |
| `Read(...)` deny rules for `.env*`, `*.pem`, `*.key` | Claude Code permission system | Read/Grep/Glob tools and `cat`/`head`/`tail`/`sed`/redirects that name the file | Scripts that open the file themselves (`node`, `python`), `grep -r` over a directory |
| `.claude/hooks/guard-bash.cjs` | Best-effort text tripwire (PreToolUse hook, `onFailure: block`) | Push to `main`/`master` in common forms (incl. bare `git push` on main, `git -C`, `git -c`, quoted words, `sh -c`, `eval`, `$(…)`), force-push, `vercel --prod`/promote/rollback, printing env or `.env` files. Escalates migrations, `db:deploy`, Supabase CLI writes, non-local `psql`, `vercel deploy` | Anything not in the text: variables expanded at run time (`B=main; git push origin $B`), code that shells out (`node -e`, `python -c`), package scripts or Makefile targets, git aliases, obfuscation. `tests/known gaps` lists these explicitly |
| Reviewer subagents (`tools: Read, Grep, Glob`) | Tool allowlist | They cannot run commands, tests, git or MCP tools at all | Nothing to bypass: they only read files. They rely on the evidence the main session gives them |
| GitHub branch protection on `main` (owner to enable) | Server-side | Any push to `main` from any tool or person without a reviewed PR | — this is the control that actually prevents the Nov 4 incident class |
| Read-only Supabase MCP (`read_only=true`) and no production DB credentials locally | Credential scope | Any agent write to the production database | — |

`onFailure: "block"` requires Claude Code v2.1.295 or later; on older versions a crashed hook does not block. Hooks and settings take effect only after the workspace trust prompt is accepted.

## Tests

- **Hook and config tests:** `pnpm run test:agent-hooks` runs `.claude/hooks/tests/*.test.cjs`. They feed synthetic hook input to the tripwire and parse the committed settings and agent files. No command under test is executed; the only real git calls create throwaway temp repos to resolve a branch name. Passing them says nothing about the application.
- **Application tests:** `pnpm run test`, `pnpm run test:migrations`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run build`, and the disposable-integration suites. Report their counts separately.

## Skills and reviewers: which to use when

| Name | Kind | Use when |
| --- | --- | --- |
| `outclass-session-start` | skill | Start of every session |
| `outclass-reuse-first` | skill | Before writing a new helper, hook, component, route, email path or queue, or adding a dependency |
| `outclass-journey-verify` | skill | Before calling any journey or feature done |
| `outclass-authz-matrix` | skill | Any identity, data-access, Storage, invitation, short-link or cron change |
| `outclass-react-performance` | skill | Changing a signed-in page or component, or asked to make something faster |
| `outclass-release-check` | skill | Before opening or merging a PR, and after every merge |
| `authz-reviewer` | reviewer (opus) | Diff touches `actions/`, authorization in `lib/` or `utils/`, middleware, Storage, short links, cron or migrations |
| `migration-reviewer` | reviewer (opus) | Diff touches `prisma/schema.prisma`, `prisma/migrations/`, raw SQL, triggers, functions, grants or RLS |
| `nextjs-reviewer` | reviewer (sonnet) | Diff touches `app/`, `components/`, `actions/`, `lib/` or `utils/` |
| `failure-path-reviewer` | reviewer (sonnet) | Diff touches email or notification delivery, the outbox, `app/api/internal/*`, autosave or save queues, revisions, Storage, Typesense or error handling |
| `test-gap-reviewer` | reviewer (sonnet) | Any PR that changes application behavior, or gate results with skipped or gated suites |
| `release-verifier` | reviewer (sonnet) | After a merge to `main`, with deploy, error, cron and advisor evidence |

Run the reviewers whose row matches the diff, in parallel, each with the same evidence files. Four of them (`migration-reviewer`, `nextjs-reviewer`, `failure-path-reviewer`, `test-gap-reviewer`) and two skills (`outclass-reuse-first`, `outclass-react-performance`) are adapted from Everything Claude Code; see the decision log.

## Reviewer evidence flow

The main session runs every command and MCP query, then hands the reviewers files to read:

1. `git diff origin/main...HEAD > /tmp/oc-review/diff.patch` and `git diff --stat` in the prompt.
2. Test commands and their pass/fail/skip counts, verbatim.
3. For releases: Vercel deployment ID, state, SHA and rollback target; runtime errors before and after; cron route status; Supabase advisor counts.
4. Invoke the matching reviewers from the table above with those paths and the acceptance criteria. Treat "missing evidence" in their report as a gap to close, not a pass.
