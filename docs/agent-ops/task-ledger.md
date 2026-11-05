# Task ledger

Status: todo · doing · review · done · blocked. Cost = model spend if known, else wall-clock minutes. "Accepted" = owner merged or approved.

| ID | Task | Acceptance criteria | Status | Evidence | Wall time | Corrections | Accepted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OPS-1 | Adopt minimal Claude config (this branch) | `pnpm run test:agent-hooks` passes (tripwire regression cases incl. the Codex review, documented gaps, config checks); app gates unchanged; reviewers have Read/Grep/Glob only | review | Hook/config: 27/27 tests pass, 2026-11-05. App gates: see PR | | 1 (Codex review: default push, `git -C`, `.env.example`) | |
