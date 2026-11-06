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

## 2026-11-05 NAV-A pre-PR release check (routes/student-paths b5429b4b = 16e8bcc1 + merge of origin/main 69cc83b0 + review fixes)
- test:agent-hooks 31/31; test 1699 total, 1640 pass, 0 fail, 59 skipped (58 env-gated as on main + student-paths-e2e, which runs on the disposable stack and in CI via run-onboarding-e2e --club-integration); test:migrations 70 applied, RLS 84 tables, trigger assertions incl. pinned search_path and a real status change storing /applications; lint 0 errors / 22 existing warnings; typecheck ok; build ok (76 pages); integration coverage check ok.
- Disposable stack on 16e8bcc1 (before review fixes): test:onboarding:e2e 42/42 incl. student-paths-e2e; test:application-writing:e2e 1/1. Re-run on b5429b4b pending: another session held the reserved E2E ports/stacks.
- Reviews: authz (no high; fixed), migration (no high; search_path pinned; per-trigger + runtime checks added), test-gap (no weakened tests; email, middleware POST/noindex, trigger runtime gaps closed), nextjs (H1 onboarding redirect loop fixed with test; M2 revalidation broadened; M3 AppShell remount after server-action refresh on a pushed path left for the single shell mount on nav/workspace-switcher).
## 2026-11-05 DS-1 design/single-palette
- `npm run validate` (inert env): test 1660 total, 1602 pass, 58 skipped, 0 fail; test:migrations pass; lint FAIL: 389 errors, all `outclass/no-raw-colors` (intended, report-only), 23 pre-existing warnings; chain stopped.
- Run separately: typecheck pass; `next build` FAIL at its lint step (same 389); `next build --no-lint` pass (diagnostic only).
- Not run: authenticated E2E. /settings redirects to / without a session, so its screenshots show the landing page.
- Ratchet added on branch ui-unify-tokens (rebased on 9da1f9bc): the 43 baselined files report warnings; other .tsx files error. `eslint .` 0 errors, 412 warnings (389 baselined + 23 existing). Glob characters in baseline paths (e.g. `app/q/[code]`) are escaped.
- Rebased gates (ui-unify-tokens): test:agent-hooks 31/31; test 1661 total, 1603 pass/58 skip on first run; a later run under machine load avg 143-176 had 14 browser-test timeouts, all 15 files re-run at normal load 22/22 pass; test:migrations pass; lint 0 errors; typecheck pass; next build pass (65/65 pages).

## 2026-11-05 DS-1 pre-PR release check (ui-unify-tokens on merge with origin/main 1f1e6a3e)
- test:agent-hooks 31/31; test 1680 total, 1621 pass, 0 fail, 58 skipped (env-gated, same as main; one interview browser failure was the worktree missing gitignored public/pdfjs, passes after `npm run pdf:assets`); test:migrations 69 applied, RLS 84 tables; lint 0 errors / 412 warnings (389 baselined + 23 existing); typecheck ok; build ok 65/65; integration coverage check ok.
- Reviewers: nextjs-reviewer and test-gap-reviewer, no high findings. Owner decisions: touch targets stay global on mobile, overflow-wrap scoped to product surfaces; outlines on light public/product surfaces use --ring (measured 2.66:1 -> 4.52:1 on #f6f5f1; shell outlines on the navy rail keep --brand-orange at 4.85:1).
- Not verified: authenticated screens in a real browser; mobile screenshots of /login and public club pages after the scope change.

## 2026-11-05 post-merge: #131 (9ae50a6c) and #132 (4d531bdf)
- #131: deploy dpl_Axu6uvd6sKotAp3AgmkXemxPP5YK READY from 9ae50a6c; runtime errors 1h: none; no migration. Verdict OK. Rollback target dpl_F77gSz2qJxyBuApJWLDGqPhQbPME.
- #132: deploy dpl_HTURG3Eak7C5SCkJqi5C8QXbk1QD READY from 4d531bdf; migration 20261105190000 applied with owner approval (only pending migration) and verified read-only (ledger row, /applications in both functions, search_path pinned, invoker, owner postgres, ACL postgres/service_role/outclass_production_app, both triggers attached and enabled); advisors 0/52/43 (search_path warnings 51 → 49); runtime errors: no new class (one existing "Additional observations unavailable"); cron scheduled-communications 29 runs in 30 min, no error-level logs; live: old URLs 307 to paths on www and uva, /applications noindex, / landing 200. Verdict OK. Rollback target dpl_Axu6uvd6sKotAp3AgmkXemxPP5YK; a code rollback leaves notification hrefs as /applications, which pre-#132 code does not serve (would 404), so roll forward instead.

## 2026-11-06 UI-FOCUS ui/focus-frame
- `test:agent-hooks` 31/31; `validate` (inert env): test 1715 total, 1655 pass, 0 fail, 60 skipped (env-gated, including tests/focus-frame-e2e.test.cjs); test:migrations 70 applied, RLS on 84 tables; lint 0 errors, 401 warnings (all raw-color ratchet); typecheck ok; build ok (76 pages).
- New real-browser fixture test `focus-frame-browser`: Exit target from the account-scoped stored page, /home fallback, foreign/focus/external entries ignored, registration merge and cleanup, onExit, projector dark surface, click-through over the hidden bar, keyboard/hover reveal.
- Disposable E2E (`test:onboarding:e2e`) run 1 on e607d3c4: 45/47; failing = new signed-out subtest (getCurrentUser sends signed-out visitors to /). Fixed (session check first) and verified on an inert dev server (NEXT_REDIRECT to `/login?next=%2Fclub%2F…%2Finterview%3F…`). Reruns not completed: the reserved stack was in use by another local session. Pending: one green disposable run (CI runs it via run-onboarding-e2e).
- Screenshots (inert env, signed-out states) before/after for 16 routes at 1440 and 390 in the session scratchpad; every focus route shows the frame, one main, no horizontal overflow.

## 2026-11-06 UI-STATUS ui/status-pill-empty-states
- `validate` (inert env): 1730 tests, 1670 pass, 0 fail, 60 skipped (env-gated); test:migrations 71 applied, RLS 85 tables; lint 0 errors / 400 warnings; typecheck ok; build ok.
- #136 post-merge: production deployment dpl_3L9HhqvyQCLZGhVV65S1MuUG74ay READY on 00840eea; get_runtime_errors 2h: none.
