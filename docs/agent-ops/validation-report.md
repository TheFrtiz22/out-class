# Validation report

Appended by `outclass-release-check`. Newest first.


2026-11-05 backend/booking-throughput (merge on bd3e12d3) app gates: test 1588/0/58 migrations 67 ok (80 tables RLS) lint ok types ok build ok | integration skips 58 (env-gated e2e/native suites; security suite run separately 11/11, booking+ballot contention 14/0) | agent-hook tests 29/0 | authz-reviewer: no high/medium, LOW-1/LOW-2 fixed before merge
deploy <pending> | runtime errors <pending> | advisor delta <n/a, no migration> | rollback target: production deploy of bd3e12d3 | verdict <pending>

## 2026-11-05 NAV-A routes/student-paths (base 2427d3b8)
- `npm run validate` (inert env): test 1687 total, 1628 pass, 0 fail, 59 skipped (58 existing env-gated + new `student-paths-e2e`, which runs only on the disposable stack); test:migrations all 70 applied, RLS on 84 tables, trigger hrefs asserted; lint 0 errors / 22 existing warnings; typecheck ok; build ok (76 pages). `test:agent-hooks` 31/31.
- Disposable stack (real Next prod build + Supabase Auth + Postgres): `test:onboarding:e2e` 42/42 incl. `student-paths-e2e` (old URLs signed in, back/forward without reload, direct reload); `test:application-writing:e2e` 1/1 (opens an old URL while signed in).
- Signed-out real-browser check (dev): 8 old URLs 307 to paths; 11 paths end at /login?next=<path> with noindex; /, /?workspace=leader, /corkboard unchanged.
- Found by E2E, fixed: Next rewrites 127.0.0.1 to localhost in middleware redirects (cookie loss on loopback); middleware now 307s on real hosts and loopback IPs use the page-level redirect.
- Open: a 403 from /api/workspace for a student without clubs on /home and /applications; same components as main, not yet confirmed against main.
