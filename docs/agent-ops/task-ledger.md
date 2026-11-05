# Task ledger

Status: todo · doing · review · done · blocked. Cost = model spend if known, else wall-clock minutes. "Accepted" = owner merged or approved.

| ID | Task | Acceptance criteria | Status | Evidence | Wall time | Corrections | Accepted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OPS-1 | Adopt minimal Claude config (this branch) | `pnpm run test:agent-hooks` passes (tripwire regression cases incl. the Codex review, documented gaps, config checks); app gates unchanged; reviewers have Read/Grep/Glob only | review | Hook/config: 27/27 tests pass, 2026-11-05. App gates: see PR | | 1 (Codex review: default push, `git -C`, `.env.example`) | |
| PERF-BOOK | Interview self-booking under simultaneous club openings (per-person locks, 8 s lock timeout) | 60 simultaneous bookings at 2 ms RTT finish < 2 s; every booking stored once; no over-capacity; last-seat and cross-club races book exactly once; no authz regression | review | Benchmark 60/1 club max 10.0 s -> 1.4-1.7 s, 60/3 clubs 9.2 s -> 0.6-1.0 s; security suite 11/11; authz-reviewer no high/medium, 2 low fixed; docs/performance/interview-booking-contention.md | | 1 (authz-reviewer LOW-1/LOW-2) | Owner approved merge in chat 2026-11-05 |
| OPS-2 | Make MCP approval rules match real tool names; run hook tests in CI | `ask` rules cover `mcp__claude_ai_<Server>__*` connector names and local names for Vercel/Supabase/Resend writes; a config test fails if either form is missing; `validate` job runs `test:agent-hooks` | review | Hook/config: 30/30 pass; new test fails against the pre-fix settings (mutation check), 2026-11-05. Owner's `claude mcp list` shows connectors named `claude.ai Vercel/Supabase/Resend/Claude Docs` | | 0 | |
