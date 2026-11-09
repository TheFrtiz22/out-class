# Validation report

Appended by `outclass-release-check`. Newest first.


2026-11-05 backend/booking-throughput (merge on bd3e12d3) app gates: test 1588/0/58 migrations 67 ok (80 tables RLS) lint ok types ok build ok | integration skips 58 (env-gated e2e/native suites; security suite run separately 11/11, booking+ballot contention 14/0) | agent-hook tests 29/0 | authz-reviewer: no high/medium, LOW-1/LOW-2 fixed before merge
deploy <pending> | runtime errors <pending> | advisor delta <n/a, no migration> | rollback target: production deploy of bd3e12d3 | verdict <pending>

## 2026-11-06 POLISH-3 layout/page-structure (base main 4d531bdf + #133 + #134)
- `npm run validate` (inert env) on e421ff00: 1721 tests, 1661 pass, 1 fail, 59 skipped; lint 0 errors; typecheck ok; build ok. The failure (release-database) compares migrations to the generated Prisma client, which another session regenerated in the shared node_modules with a VotingHandRaise model not present in this repo; the same test passed on this branch before that (1651/0/59 run).
- Disposable stack (fresh volume) on e421ff00: onboarding/paths/account/settings 54/54; selected navigation 16/16. Voting bar check at 390/1440: hidden until selection, pager and last row not covered.
- Combined main + #133 + #134: validate 1705/1646/0/59; stack 54/54 + 16/16 on a fresh volume (an earlier #418 hydration failure on /club-access came from stale data in the old disposable volume).

## 2026-11-05 NAV-B nav/workspace-switcher (base 16e8bcc1, stacked on NAV-A)
- `npm run validate` (inert env): test 1688 total, 1629 pass, 0 fail, 59 skipped (same env-gated set as NAV-A); test:migrations ok; lint 0 errors / 22 existing warnings; typecheck ok; build ok (76 pages).
- Disposable stack (real prod build + Supabase Auth + Postgres, built from 54b5bac8): onboarding/student-paths/account/settings 54/54; selected navigation phases 1/2/10/12 16/16 (phase 2 re-run after renaming its club overview selector to `nav-club-home`).
- Browser fixture: new navigation-rail-browser (labels ≥1280, tooltips 1024–1279, no overlay, URL-driven active state, group menus by click/keyboard, guards, permissions, phones, axe wcag2a/aa/21aa/best-practice at 1100/1440/390, forced colors, contrast-more, blur fallback); workspace-selector-browser rewritten for the pill; club-workspace-entry-browser keeps entry-preference and no-flash checks via rail sections.
- Not verified: real-device Safari/iOS, signed-out /preview in a real browser (unit-tested only), production.

## 2026-11-05 COPY-1 copy/plain-language (base 69cc83b0)
- test 1684 total, 1625 pass, 1 fail, 58 skipped; the failure (interview-enter-browser résumé text) passes after `npm run pdf:assets` in the fresh worktree, so 1626/0/58. test:migrations 69 applied, 84 tables RLS; lint 0 errors / 22 warnings; typecheck ok; build ok.

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

## 2026-11-06 LAYOUT page-structure, merged with #145 and plain-language copy
- `validate` (inert env) on 238d36ba: 1755 tests, 1695 pass, 0 fail, 60 skipped (env-gated); lint 0 errors / 23 warnings; typecheck ok; build ok.
- CI "Local Auth, settings and navigation" failed phase2 "selected tabs" (pipeline). Reproduced locally only under load: 4 of 8 concurrent runs failed on this branch AND on #133's head e4340685 (pre-existing). Cause: the browser Auth client fences read authority after first paint (`signed_in`), so a tab selected before then legitimately reads twice / remounts the rail flyout. Test `open()` now waits for network idle; 12 of 12 concurrent runs pass; full phase2 file 7/7 on a fresh disposable stack.
## 2026-11-06 UI-GLASS-1 ui/club-home-glass (from nav/workspace-switcher e4340685, not yet on main)
- `pnpm run test` (inert env; Playwright Chromium pointed at /opt/pw-browsers/chromium through a local NODE_OPTIONS preload, no repo change): 1748 total, 1688 pass, 0 fail, 60 skipped (env-gated). test:migrations 71 applied, RLS 85. lint 0 errors / 23 warnings (same as before). typecheck ok. build ok, 76 pages.
- Existing browser suites unchanged and passing: navigation-rail-browser, workspace-selector-browser, floating-search-browser, welcome-browser, club-workspace-entry-browser. Updated for the redesigned page only: club-workspace-refinements-browser (overview headings), club-workspace.test (mock gains clubMember/clubInvitation, asserts club scope), and the env-gated operational-dashboards-e2e / navigation-phase2-e2e (new heading, refresh and submission names; not run, need the disposable stack).
- Pre-existing, not caused here: `node scripts/check-floating-header.cjs` fails at baseline (waits for "Workspace dock"; NAV-B renamed it); the legacy (non-dashboard) part of check-liquid-glass.cjs still targets "Product modes".
- Glass audit `OUTCLASS_GLASS_SCOPE=dashboard node scripts/check-liquid-glass.cjs` (Chromium): small and large club at 1440/1100/1024/820/390, scrolled, reviewer/member/clear, reduced motion, higher contrast, forced colors, reduced transparency (CDP): 0 axe violations in 11 runs; blurred surfaces 6 desktop / 5 phone (header 4 + existing bottom bar), 0 with reduced transparency; scroll frames (2.2 s, 1440): glass median 16.7 / p95 33.3 ms / 122 frames, solid median 16.7 / p95 16.7 ms / 133 frames, 0 frames >34 ms, 0 layout shifts. Headless software rendering; not a device measurement.
- Not run: WebKit (not installed; `playwright install` not permitted here); authenticated E2E on the disposable stack; real-device frame times.

## 2026-11-06 UI-GLASS-2 ui/glass-rollout (stacked on ui/club-home-glass 75c383be)
- `pnpm run test` (inert env, Chromium via the local preload): 1748 total, 1688 pass, 0 fail, 60 skipped (env-gated). test:migrations 71 / RLS 85. lint 0 errors / 23 warnings (unchanged). typecheck ok. build ok.
- Existing browser tests kept their assertions. Two caught real regressions during the rollout and the code was fixed, not the tests: workspace-materials-browser (segmented tabs widened a 320px page) and task-cleanup-browser (empty corkboard must have no background image).
- `scripts/check-glass-rollout.cjs` on the local production build: before (ui/club-home-glass) and after, 37 screenshots each, 0 axe violations in both (design-system with every primitive, the six product patterns, dialog/menu/tooltip; public pages; reduced transparency via CDP, forced colors, higher contrast). One intermittent React #419 on /signup or /login in both runs: Supabase client configuration missing in this container (0 in 6 reloads).
- Scroll frames (OUTCLASS_GLASS_FRAMES=1, 1440px, 2.5 s, 3 runs): origin/main 9f15d2ea and the rollout both 150 frames, median 16.7 ms, p95 16.7–16.8 ms, 0 frames >34 ms, over the Explore cards and the applicant-table placeholder. Headless software rendering.
- Not run: signed-in pages in a browser (no Supabase credentials or Docker daemon here, so neither demo nor the disposable stack can start); WebKit (not installed); env-gated E2E.

## 2026-11-07 UI-GLASS-3 ui/glass-everywhere (from main 41be2908; local commits only, not pushed)
- `pnpm run test` (inert env, Chromium via the local preload) after A, B, C and D: 1765 total, 1705 pass, 0 fail, 60 skipped (env-gated). test:migrations: 71 migrations, RLS on 85 tables. lint 0 errors / 23 warnings (unchanged) and `scripts/check-ui-controls.cjs` OK (all findings allowlisted; a probe file with a native select, a styled raw button and a raw toggle fails it). typecheck ok. build ok.
- Spacing fixture (real ProductShell and PageHeader) at 2560/1920/1440/1100/1024/820/390 for home, explore, applications, applicants, meetings, settings, admin and club home: gap above the title 10px on desktop and 8px on phones on every page; title left edge equals the workspace pill's; no horizontal scroll.
- `scripts/check-glass-rollout.cjs` phase D on the local production build: 37 screenshots (design-system, six product patterns, public pages, dialog/menu/tooltip, reduced transparency, forced colors, higher contrast), 0 axe violations. Page errors: React #419 on /login and /signup, also present in the earlier "final" capture (pre-existing).
- New `OUTCLASS_GLASS_SCOPE=dashboards` in `scripts/check-liquid-glass.cjs` (tests/fixtures/dashboards: Personal Home full/empty/error, Recruiting Overview large owner/small reviewer/new club) in Chromium: 26 screenshots, 0 axe violations including reduced motion, higher contrast, forced colors and reduced transparency; at most 5 blurred surfaces (the shell's); 0 animations under reduced motion; SegmentedControl one tab stop, arrows, Home/End, Enter/Space, visible ring; menu and dialog trap and return focus on /design-system. Scroll frames (1440, 2.5 s): 133 frames, median 16.7 ms, p95 16.7–16.8 ms, 0 > 34 ms, glass and solid alike.
- Tests changed only where markup legitimately moved (listed in the final report): club-home-browser, club-workspace-refinements-browser, campus-illustrations, operational-dashboards, platform-visual-unification (dashboard assertions now check the shared pieces), select predicates in six harness tests, review-tools/recruiting-rules-ui/voting-join-ui NativeSelect mocks, live-applicant-views, campus-events-ui, login-ui, organization-members-ui, task-workspace-ui, tasks-workflow.
- Not run: WebKit (not installed; `playwright install` not permitted); signed-in pages in a browser (no Supabase credentials or Docker here), so Applicants/leader pipeline frame times and the Interviews/Voting/Decisions/Tasks/Announcements/Profile before/after screenshots are blocked; env-gated E2E (60 skipped).

## 2026-11-07 RELEASE 41be2908 (#151, includes #150)
- Production deployment dpl_DuYz6ZHnQXrefMU9pfbYGhUawzRk READY on 41be2908, aliased to out-class.net, www and uva.out-class.net.
- get_runtime_errors (7h): two groups, both pre-dating the merge (ZodError `prompt` baseline class, last on the previous deployment; "Additional observations are unavailable" authorization denial, first seen 2026-11-05). No new error classes. Advisors 0/52/43 matched baseline before merge. No rollback.

## 2026-11-07 PUBLIC-SITE-1 ui/public-site-cleanup (from main 8ffe7722; local commits only, not pushed)
- `pnpm run test` (inert env; Playwright's expected Chromium build symlinked to the container's /opt/pw-browsers build, no repo change): 1820 total, 1760 pass, 0 fail, 60 skipped (env-gated). One test added afterwards (admin-clubs, getPublicClub sanitization): file 12/12.
- `pnpm run test:migrations`: 71 migrations, RLS on 85 tables (no schema change). lint 0 errors / 23 warnings (baseline); ui-controls OK (one allowlist entry removed: profile-presentation.css css-hex). typecheck ok. build ok.
- Signed-out audit, local production build + disposable loopback Postgres (38 clubs from docs/club-profile-design), fresh context per page: before (main) and after, 22 page variants at 1440 and 390, plus reduced motion and forced colors for /, /club/[id], /login. After: 0 axe violations; forced-colors color-contrast hits are false positives (computed black on white), present on main too. docs/public-site/.
- Keyboard-only (scripts/public-site-keyboard.cjs): phone menu, audience toggle (+ cookie on reload), sign in, sign up: 4/4.
- Vitals (scripts/public-site-vitals.cjs; lab, not field): docs/public-site/performance.md. All pages LCP ≤ 2.5 s, CLS ≤ 0.1 in every profile.
- Content fix (scripts/clean-public-club-profiles.cjs): dry run and `--apply` rehearsed on the disposable database only (38/38 clubs, 297 fields, idempotent second run 0, AuditLog rows written; AuditLog stayed append-only). Not run against production.
- Reviewers: authz-reviewer 0 high/medium; nextjs-reviewer 0 high, 2 medium documented (see report).
- Not run: WebKit (not installed); signed-in pages in a browser (no Supabase Auth here); env-gated E2E (two updated for the sign-up heading text: onboarding-e2e, signup-privacy-e2e).
- Owner decisions applied before merge (2026-11-07/08): club leaders default; Explore private; employer logos hidden behind `SHOW_EMPLOYER_MARKS`; formal Privacy/Terms behind `LEGAL_PAGES_PUBLIC` (404 until on). Audience toggle content switch moved into a React transition (nextjs-reviewer follow-up found and the fix covers a double-tap desync; hook tests added).
- Final gates on the merge candidate: `pnpm run test` 1822 total, 1762 pass, 0 fail, 60 skipped (env-gated); test:migrations 71 / RLS 85; lint 0 errors / 23 warnings (baseline), ui-controls OK; typecheck ok; build ok. Disposable-integration coverage: 34 suites, 24 wired, 10 unwired (unchanged from main). No `.claude/` changes. Vitals re-measured for both main and the branch with the corrected script (LCP/CLS read before interaction; no navigating clicks): docs/public-site/performance.md.

## 2026-11-08 RELEASE b461adfb (#162, PUBLIC-SITE-1)
```
2026-11-08 #162/b461adfb app gates: test 1822/1762/0 fail/60 skipped (env-gated) migrations 71 ok (RLS 85) lint ok (0 errors, 23 baseline warnings) types ok | integration skips 10 unwired suites (unchanged from main) | agent-hook tests n/a
deploy dpl_HCbKqFuC85KMysoQanp1KDZ2fF7U READY yes | new runtime error classes 0 | advisor delta +0/-0 (security 0/52/43) | rollback target dpl_2SfUGnpRcGXwWjdEf369ZR6t1fDL | verdict WATCH
```
- PR CI on head bc715296: 14/15 green. `Local Auth, settings and navigation` failed once at tests/pipeline-release-e2e.test.cjs:67 (one RSC request to the workspace path after the same-workspace "All applicants" CTA, expected 0); the same application code passed that job on 24534c26 (run 233). The CTA itself uses history.pushState (lib/workspace-navigation.ts), so the extra request is a Link prefetch or refresh elsewhere on the page; suspected timing, not proven. The owner merged with it red. This docs PR re-runs the suite on the merged code.
- WATCH reasons: ~8 minutes of production traffic at check time; invitation-delivery and notification-delivery crons log nothing on success; the intermittent E2E above. Security advisors unchanged; first performance-advisor counts recorded in baseline-log.md.
## 2026-11-05/06 FE-1 perf/demo-split-workspace-api (#138; base 60aef457, rebased locally onto 00840eea as 85b9f461, not yet pushed)
- Bundle (audit gzip script, prod builds of 4d531bdf vs FE-1): demo-seed marker on 15 of 61 routes → 0; `/club/[clubId]/workspace` 464 → 387 kB gz; meetings, booking, decision letter, voting join −85 to −90 kB; root layout 164 → 164.
- Unit, `node --test --test-timeout=120000 tests/*.test.cjs` on the final tree: 1728 total, 1668 pass, 0 fail, 60 skipped (58 env-gated + `student-paths-e2e` + new `demo-browser-e2e`). Repeat full runs on this machine: 4 clean; 1 file-level failure of `scheduling-simplification-browser` (2 of 3 tests reported, then "test failed"; passes 4/4 alone; exit code/signal not captured by the spec reporter); 2 runs slowed by machine load (load average ~30), with browser timeouts in unrelated files that pass alone. Main 60aef457: 2/2 full runs clean (1711 tests).
- Targeted (every test referencing workspace-api or lib/demo): 84 files main 538/0/5 → FE-1 554/0/5; after rebase onto 00840eea, 85 files 555/0/6 (+`focus-frame-e2e`, gated). `test:migrations` 70 applied, RLS on 84 tables; typecheck 0; lint 0 errors, 412 warnings (same as main); build ok.
- Disposable stack (`run-onboarding-e2e --club-integration --selected-navigation`, prod build, demo enabled for one test address): onboarding 54/54; selected navigation 16/16 incl. "Phase 1 GET reads preserve live authority, no-store, Demo isolation…"; `demo-browser-e2e` 4/4 (non-demo leader: 8 routes, 330 scripts, 0 demo chunks; demo routes: 0 flashed empty states, 0 live requests; blocked chunk → error + Try again → recovered; stalled chunk → alert at 10.5 s → recovered).
- 2026-11-06 rerun on 85b9f461 with the OPS-5 fixture fix applied locally (uncommitted) and a stale fixture planted: onboarding 59/59; selected navigation 16/16 incl. Demo isolation; `demo-browser-e2e` 5/5 with the positive control: Demo Mode loaded demo chunks 2243 (seed/store) and 9982 (implementations); non-demo leader 322 scripts, 0 demo chunks; 0 flashed empty states on 4 demo routes; blocked chunk recovered; stalled-chunk alert at 10.45 s, recovered.
- Earlier attempts (superseded): `demo-browser-e2e` with the added chunk-scan positive control was blocked. Two stack reruns failed for environment reasons: (1) `navigation-audit.cjs:36` reused a navigation fixture from a stopped stack → "Invalid login credentials" in all 7 selected-navigation tests; (2) Mailpit SMTP timeout in admin bootstrap ("Error sending confirmation email"). Stopped per the two-attempt rule.
- Reviewers: nextjs (no high), failure-path (1 high + 3 medium, all fixed, re-review CONFIRMED), test-gap (2 high + 2 medium, all closed on re-review).

## 2026-11-06 OPS-4 tests/onboarding-port-prefix (#139; base 4d531bdf)
- Unit 1704 total, 1645 pass, 0 fail, 59 skipped; typecheck 0; lint 0 errors (412 warnings, same as main). Build not rerun (script-only change).

## 2026-11-08 · SHELL-1 · ui/shell-persistence-and-dashboard-split (local, not pushed)
```
branch ui/shell-persistence-and-dashboard-split (from main 5f50339a), commits: Part 1 2fff5ef1, Part 2 72bf6f5a, Part 3 (this commit)
app gates: test 1869/1805/0 fail/64 skipped (60 env-gated + 4 new stack-only: workspace-shell-e2e, header-gap-e2e, overview-view-authz-e2e, dashboards-split-e2e) migrations 71 ok (RLS 85) lint ok (0 errors, 23 baseline warnings; ui-controls OK) types ok build ok
per part: Part 1 1862/1801/0/61; Part 2 1863/1801/0/62
disposable stack (run-onboarding-e2e.cjs --shell; SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io): workspace-shell-e2e 4/4, header-gap-e2e 1/1, overview-view-authz-e2e 1/1, dashboards-split-e2e 1/1
glass: check-liquid-glass OUTCLASS_GLASS_SCOPE=dashboard 0 axe violations; scope=dashboards fails on main and branch alike in this container (chrome-error navigation in the fixture), covered instead by dashboards-split-e2e axe on the real app
local environment notes: Playwright 1.64 expects Chromium build 1248, container has 1243 (local symlink only); WebKit not installed
```
2026-11-08 SHELL-1 after merging main b4cd90e8 and review fixes: app gates: test 1886/1821/0 fail/65 skipped (61 env-gated incl. main's new demo-browser-e2e + 4 stack-only shell suites) migrations 71 ok (RLS 85) lint ok (0 errors, 23 baseline warnings) types ok build ok | integration skips 10 unwired suites (unchanged from main); new shell suites wired to CI matrix `shell` | agent-hook tests n/a
reviewers: authz-reviewer 0 high/medium (3 low: non-member nameless member rail fixed with test; view-as frame matches previous behavior; reviewed count is a team total by design); nextjs-reviewer 0 high (fixed: seeding merges instead of replacing, tabs observe late triggers, ref written in layout effect, pill re-click cancels pending, leave guard on Schedule interviews / strip / Open applicants; kept: meeting buttons open the meeting drawer where attendance and edit live; strip refreshes on remount); test-gap-reviewer: dashboards-split-e2e restored to the --shell runner and missing suites now fail the run
disposable stack after fixes: workspace-shell-e2e, header-gap-e2e, overview-view-authz-e2e, dashboards-split-e2e 7/7 subtests

## 2026-11-08 · Post-merge release check · #138 FE-1 (b4cd90e8), #149 FE-3 (2ac4efca), #165 FE-6 (6801a2c8)
```
#138 b4cd90e8 app gates: test 1875/1814/0/61 (after merging 5f50339a) | CI 16/16 green
deploy dpl_4rQtzY7FKXNfXuDgh297fBjU4fz9 READY yes
#149 2ac4efca app gates: test 1887/1825/0/62 | CI 16/16 green after one rerun of the settings job (React #418, pre-existing on main, BUG-1)
deploy dpl_5Mpw9h3W3NGzAcChC5nqvEUYSoum READY yes
#165 6801a2c8 app gates: test 1875/1814/0/61 | CI 16/16 green
deploy dpl_8B3cAEH6efVNkrgAx3JpdSXuy2ye READY yes (production at check time)
new runtime error classes 0 (none since 18:20Z; the two classes in the prior 24 h predate these merges) | rollback target dpl_GAbgrcXkPkMfwCRmmJv4QWH6U7yt (3e779e55, #166); before #138 dpl_CweCYcA8R6hSXo3FyV1UbhBv3MNW (5f50339a)
crons: owner confirmed scheduled-communications ran every minute for 3 h with 0 failures; the other two log nothing when idle
advisors: security advisor counts unchanged vs baseline; no migrations in these PRs. Performance advisors unchanged vs baseline.
verdict WATCH (release-verifier; not a rollback candidate)
```

## 2026-11-08 · FE-7 #167 design-guard fix
```
cause: halo box-shadows with px literals in page CSS counted as css-shadow by scripts/check-ui-controls.cjs (6 files over allowlist)
fix: --focus-halo-outset / --focus-halo-inset-4/5/6 tokens in styles/tokens.css, 22 rules use them; allowlist ratcheted down (10 entries shrunk, 3 removed); merged origin/main 928dcb27 (one new focus rule converted to var(--ring); active segmented-tab focus rules moved after main's measured-indicator rule, which cleared the halo)
app gates: test 1920/1854/0/66 lint ok (0 errors, 23 baseline warnings; ui-controls OK) types ok build ok
first full run: 2 fails (focus-ring active-tab halo, fixed; club-home-browser hover transform under load, then 3/3 in isolation, flake)
```
