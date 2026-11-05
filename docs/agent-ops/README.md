# Agent operations records

Small, append-only records that let anyone (or any Claude session) see what was done, with what evidence, at what cost.
Keep these short. Detailed investigation notes go in feature docs; link them from here.

| File | What goes in it | Written by |
| --- | --- | --- |
| `task-ledger.md` | One row per task: ID, acceptance criteria, status, evidence, cost | `outclass-session-start`, owner |
| `baseline-log.md` | Dated health snapshot: advisors, deploy SHA, runtime errors, agent cost per accepted task | `release-verifier`, nightly scheduled task |
| `validation-report.md` | Release gate results per PR / merge | `outclass-release-check` |
| `journey-matrix.md` | Feature preservation matrix (implemented / partial / demo-only / unverified) | `outclass-journey-verify` |
| `authz-matrix.md` | Actor × operation access matrix with test references | `outclass-authz-matrix` |
| `decision-log.md` | Decisions, alternatives, cost, reversal condition | owner, Claude |
| `nightly-health-prompt.md` | The exact prompt for the read-only scheduled health check | owner |
