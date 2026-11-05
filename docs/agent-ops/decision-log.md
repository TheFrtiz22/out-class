# Decision log

| Date | Decision | Alternatives | Why | Cost | Reverse if |
| --- | --- | --- | --- | --- | --- |
| 2026-11-05 | Do not install Everything Claude Code, Ponytail, OmniRoute or AgentSkills; keep 4 project skills + 2 read-only subagents | Install ECC (314 skills, 71 agents per its README) | Existing CLAUDE.md is strong; large skill sets add context and unreviewed hooks; no baseline yet to show benefit | 0 | A one-week baseline shows a specific bottleneck one of them measurably fixes |
| 2026-11-05 | Reviewer subagents get Read, Grep, Glob only; the main session runs tests and MCP queries and passes evidence | Bash with a read-only allowlist hook | A shell allowlist cannot be guaranteed (`node --test` can write, `git fetch` writes refs, git options can run helpers); a tool allowlist actually constrains them | Reviewers cannot gather evidence themselves | A reviewer repeatedly reports missing evidence the main session cannot supply |
| 2026-11-05 | Keep `guard-bash.cjs` as a documented best-effort tripwire with regression tests; rely on branch protection and credential scope for real enforcement | Claim the hook enforces policy | Official docs: Bash rules are not a security boundary; text checks miss runtime expansion and scripts | Some risky forms pass silently (listed as known gaps in tests) | Branch protection and read-only credentials are confirmed in place |
