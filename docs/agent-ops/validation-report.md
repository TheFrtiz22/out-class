# Validation report

Appended by `outclass-release-check`. Newest first.


2026-11-05 backend/booking-throughput (merge on bd3e12d3) app gates: test 1588/0/58 migrations 67 ok (80 tables RLS) lint ok types ok build ok | integration skips 58 (env-gated e2e/native suites; security suite run separately 11/11, booking+ballot contention 14/0) | agent-hook tests 29/0 | authz-reviewer: no high/medium, LOW-1/LOW-2 fixed before merge
deploy <pending> | runtime errors <pending> | advisor delta <n/a, no migration> | rollback target: production deploy of bd3e12d3 | verdict <pending>

## 2026-11-05 DS-1 design/single-palette
- `npm run validate` (inert env): test 1660 total, 1602 pass, 58 skipped, 0 fail; test:migrations pass; lint FAIL: 389 errors, all `outclass/no-raw-colors` (intended, report-only), 23 pre-existing warnings; chain stopped.
- Run separately: typecheck pass; `next build` FAIL at its lint step (same 389); `next build --no-lint` pass (diagnostic only).
- Not run: authenticated E2E. /settings redirects to / without a session, so its screenshots show the landing page.
- Ratchet added on branch ui-unify-tokens (rebased on 9da1f9bc): the 43 baselined files report warnings; other .tsx files error. `eslint .` 0 errors, 412 warnings (389 baselined + 23 existing). Glob characters in baseline paths (e.g. `app/q/[code]`) are escaped.
- Rebased gates (ui-unify-tokens): test:agent-hooks 31/31; test 1661 total, 1603 pass/58 skip on first run; a later run under machine load avg 143-176 had 14 browser-test timeouts, all 15 files re-run at normal load 22/22 pass; test:migrations pass; lint 0 errors; typecheck pass; next build pass (65/65 pages).
