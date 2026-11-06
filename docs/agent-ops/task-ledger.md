# Task ledger

Status: todo · doing · review · done · blocked. Cost = model spend if known, else wall-clock minutes. "Accepted" = owner merged or approved.

| ID | Task | Acceptance criteria | Status | Evidence | Wall time | Corrections | Accepted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OPS-1 | Adopt minimal Claude config (this branch) | `pnpm run test:agent-hooks` passes (tripwire regression cases incl. the Codex review, documented gaps, config checks); app gates unchanged; reviewers have Read/Grep/Glob only | review | Hook/config: 27/27 tests pass, 2026-11-05. App gates: see PR | | 1 (Codex review: default push, `git -C`, `.env.example`) | |
| PERF-BOOK | Interview self-booking under simultaneous club openings (per-person locks, 8 s lock timeout) | 60 simultaneous bookings at 2 ms RTT finish < 2 s; every booking stored once; no over-capacity; last-seat and cross-club races book exactly once; no authz regression | review | Benchmark 60/1 club max 10.0 s -> 1.4-1.7 s, 60/3 clubs 9.2 s -> 0.6-1.0 s; security suite 11/11; authz-reviewer no high/medium, 2 low fixed; docs/performance/interview-booking-contention.md | | 1 (authz-reviewer LOW-1/LOW-2) | Owner approved merge in chat 2026-11-05 |
| OPS-2 | Make MCP approval rules match real tool names; run hook tests in CI; run required integration checks on every PR | `ask` rules cover `mcp__claude_ai_<Server>__*` connector names and local names for Vercel/Supabase/Resend writes; a config test fails if either form is missing; `validate` job runs `test:agent-hooks` | review | Hook/config: 30/30 pass; new test fails against the pre-fix settings (mutation check), 2026-11-05. Owner's `claude mcp list` shows connectors named `claude.ai Vercel/Supabase/Resend/Claude Docs` | | 0 | |
| OPS-3 | Tailored ECC subset for OutClass | 4 reviewers + 2 skills adapted to OutClass conventions; every subagent limited to Read/Grep/Glob (config test covers all agent files); no hooks, plugins, MCP servers or dependencies added; decision-log entry with attribution | review | See PR | | 0 | |
| NAV-A | Student workspace views get real paths (/home, /explore, /explore/categories, /corkboard, /applications, /applications/status, /clubs, /clubs/meetings, /clubs/tasks, /calendar, /inbox, /profile) under app/(product); old `/?workspace=student&view=…` URLs 307 to them; old leader `?view=` URLs open the club workspace section; signed-in `/` → /home; notification triggers emit /applications (owner-approved migration) | Every old student URL, alias and section maps to its path with other params kept; signed-out paths end at /login?next=<path>; signed-in tab switches push paths without reload and back/forward/reload return to the same view; no code builds the old URLs; authz entry gates match `/` | review | see validation-report 2026-11-05 NAV-A; authz-matrix AUTH-PATHS | | 4 (relative Location after E2E caught localhost/127.0.0.1 cookie loss; authz-reviewer M1 stale base, L1 disabled+next; nextjs-reviewer H1 onboarding redirect loop; migration-reviewer search_path) | |
| DS-1 | Single palette: merge product-tokens.css into tokens.css; remove `data-workspace-detail`/`data-outclass-design`; add `outclass/no-raw-colors` ESLint rule (report only) | One `:root` palette, no scoped override, no attribute in markup or CSS; dependent CSS retargeted with hooks pinned by test; rule errors on new violations and existing ones are baselined (exact-count ratchet); light-surface focus/selection outlines meet 3:1; validate green | review | Gates on merge with main 1f1e6a3e: test 1621 pass/0 fail/58 skip, migrations 69, lint 0 errors, typecheck ok, build ok; nextjs-reviewer + test-gap-reviewer: no high; fixes: exact ratchet, selector-arg hex exemption, CSS hook contract test, overflow-wrap scoped to product surfaces, light-surface outlines to --ring (2.66:1 -> 4.52:1), 2026-11-05 | | 3 (ratchet glob escape; reviewer scope/contrast findings; worktree pdfjs assets) | |
| OPS-4 | Onboarding E2E port-prefix override (`OUTCLASS_ONBOARDING_E2E_PORT_PREFIX`) | A stale stack on 55321-55327 can no longer block the runner; same prefix validation; documented | review | See PR | | 0 | |
| FE-1 | perf/demo-split-workspace-api: demo implementations load on demand behind a fail-closed activation gate | Demo seed absent from live route chunks; workspace route gz JS drops ≥ 40 kB; demo works in a real browser with no empty-state flash; signed-in non-demo browser requests no demo chunk; calls wait for a requested-but-loading demo and never fall through to live; middleware still blocks demo writes | review | See PR | | 2 (activation gate before PR; reviewer fixes) | |
| FE-2 | perf/visibility-gated-polls | 0 requests in hidden tabs; 0 view-as calls when not impersonating (cross-device detection trade-off noted); voting re-authorizes on every visible poll; failure-path-reviewer | todo | | | | |
| FE-3 | perf/root-layout-providers | `lib/data.ts` absent from the root chunk; root gz JS down; saved-club toggles work; check-in makes no saved-clubs request | todo | | | | |
| FE-4 | perf/student-reads (parallel reads, initialData, server Explore, shared clock, regex UUID, dynamic signup wizard, parallel club-page awaits) | Before/after navigation numbers; no behaviour change | todo | | | | |
| FE-5 | cleanup/dead-code (public assets in FE-6) | Zero references incl. tests/docs; no visible change | todo | | | | |
| FE-6 | cleanup/public-assets | Checked against CSS url(), email templates and OG images | todo | | | | |
| FE-7 | tokens/uva-palette (decision 5) | Verified UVA values in a school theme layer; ring ≥ 3:1 on both canvases; screenshots light/dark. Needs owner input: PR #131 removed the scope hook | blocked | | | | |
| FE-8 | tokens/radius-elevation | One radius scale; 3 elevation levels; no layout shift | todo | | | | |
| FE-9 | tokens/type-css-* (one PR per CSS group) | No literal font sizes in touched files; 375/1280 screenshots | todo | | | | |
| FE-10 | tokens/kit-editor-dark | Kit editor readable in dark mode; tab keyboard unchanged | todo | | | | |
| FE-11 | nav/surface-hidden | /settings/interviews in nav; Cmd-K meetings/members/events + shortcut list, permission-scoped; / hint; view choice in URL | todo | | | | |
| FE-12 | nav/events-entry (decision 7) | Events one click from leader nav; `?meetingTab=events` redirects | todo | | | | |
| FE-13 | nav/email-prefs-inbox (decision 9) | `/settings/notifications` redirects to Inbox preferences; `emailMessages` toggle path removed, column kept | todo | | | | |
| FE-14 | ui/confirm-dialog (57 window.confirm calls, in batches) | Focus moves into the dialog and back; Esc cancels; verb labels. Includes the Demo Mode alert's "Try again"/"Exit demo" focus (focus drops to the page today; found in FE-1) | todo | | | | |
| FE-15 | ui/badge-tones | Retired module imports reach 0; screenshots | todo | | | | |
| FE-16 | ui/empty-loading | As FE-15 | todo | | | | |
| FE-17 | ui/selects | Raw selects move to NativeSelect | todo | | | | |
| FE-18 | ui/buttons | As FE-15 | todo | | | | |
| FE-19 | qr/presenter-dialog (wrapper only) | Byte-identical SVG/PNG exports; focus trap; Esc; real-phone scan | todo | | | | |
| FE-20 | student/club-profile-once | One Apply, one deadline, one status; Apply visible at 375 px | todo | | | | |
| FE-21 | student/q-landing | All short-link types resolve; contrast ≥ 4.5:1 | todo | | | | |
| FE-22 | shell/solid-chrome (decision 6) | Safe areas, reduced motion and focus order unchanged; screenshots | todo | | | | |
| FE-23 | corkboard/naming-and-texture (decision 4) | Naming split; licensed texture ≤ ~60 kB; dark mode; reduced motion | todo | | | | |
| FE-24 | copy/helper-trim-* | Required consent wording kept; selectors updated | todo | | | | |
| FE-25 | copy/arrows-and-drift | Phosphor arrows; "Sign in" everywhere; sign-in returns to the origin page | todo | | | | |
| FE-26 | icons/sizes | Only 14/16/20/24 | todo | | | | |
| FE-27 | voting/consolidate (decision 1) | Redirects keep printed QR codes working; aggregate count decides history view; no table drops | todo | | | | |
| FE-28 | preview/retire (decision 2) | Chosen option and reason recorded; demo writes still blocked | todo | | | | |
| FE-29 | subscribe/real-updates (decision 3) | Server subscriptions; outbox/digest delivery; one-click unsubscribe; migration rehearsed, not applied | todo | | | | |
| FE-30 | exports/csv (decision 8) | Capability-checked, club-scoped, formula-safe, audited; authz-matrix rows | todo | | | | |
| FE-31 | admin/notices-and-maintenance (decision 12) | Site-wide banners; maintenance mode default off with admin bypass | todo | | | | |
| FE-32 | admin/editorial-ui (decision 12) | page-header/tokens/AlertDialog/pickers; nav de-duplicated; /platform loading and error; school picker for CSV import | todo | | | | |
| FE-33 | legal/privacy-terms (decision 11) | DRAFT pages matching the code; gaps listed; CTA intent fixed | todo | | | | |
| FE-34 | design-system/gate (decision 10) | requirePlatformAdmin; noindex | todo | | | | |
| FE-35 | Hardening: invitation page writes during GET | Write moves to an action or route; authz-reviewer | todo | | | | |
| FE-36 | Hardening: server-side admin check in app/platform/layout.tsx | outclass-authz-matrix rows | todo | | | | |
| FE-37 | Hardening: app/global-error.tsx | Renders on a root error | todo | | | | |
| FE-38 | Hardening: middleware double auth (investigate only) | Evidence for or against, citing Supabase guidance; no change without it | todo | | | | |
