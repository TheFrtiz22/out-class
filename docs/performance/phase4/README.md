# Phase 4 evidence

Start with [PHASE4_REPORT.md](PHASE4_REPORT.md).

- `comparison-awake/`: accepted full BA/AB study, all 288 planned outcomes, verified no host Sleep events. Its PLAN and PROTOCOL identify immutable builds, fixtures and tool hashes.
- `comparison/`: earlier complete collection, retained in full but excluded from accepted performance claims because macOS Sleep/DarkWake events interrupt measurement. Two readiness timeouts are retained. Original measurement tool copies in TOOLS match its protocol hashes.
- `baseline-100-diagnostic/`, `baseline-5000-diagnostic/`, `logo-5000-diagnostic/`: exploratory pilots; no pooling into the accepted comparison.
- Early baseline and final candidate loader probes use real local Auth/SQL/Prisma outside the Next dispatcher. They confirm fields, byte counts, statement counts and identity checks; their timings are not a matched HTTP comparison.
- Source manifests and IMPLEMENTATION.diff describe the three changed code files plus bundled-artwork documentation. Server cursor pagination remains Phase 5 work.
- Power logs export only time/event categories, never full device logs. All data fixtures are disposable and synthetic. No hosted configuration, production schema/index or deployment is changed.
