# Task ledger

Status: todo · doing · review · done · blocked. Cost = model spend if known, else wall-clock minutes. "Accepted" = owner merged or approved.

| ID | Task | Acceptance criteria | Status | Evidence | Wall time | Corrections | Accepted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OPS-1 | Adopt minimal Claude config (this branch) | Guard blocks 13/13 sampled risky commands and allows 6/6 safe ones; skills and agents load in `/agents` and skill list | review | `node .claude/hooks/guard-bash.cjs` sample run, 2026-11-05 | | | |
