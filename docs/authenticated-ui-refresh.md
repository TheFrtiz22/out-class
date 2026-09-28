# Authenticated UI refresh

September 28, 2026. Presentation refresh using the approved OutClass mockups. Public landing, platform-admin UI, backend behavior, database schema, route/query contracts and permission checks are unchanged.

## Changes

| Files | Result |
| --- | --- |
| `components/shell/product-shell.tsx`, `components/shell/authenticated-product.css` | Centered desktop primary modes, visible manager club identity, labeled contextual icons, warm-white/navy/orange surfaces, restrained table and drawer styling. Existing mobile navigation sheet and workspace switcher retained. |
| `components/clubs/explore-directory.css` | Subtle existing Rotunda asset, large search, category chips and refined directory cards. Existing directory data and claimed/recruiting behavior retained. |
| `components/applications/application-tracker.css` | Calm application cards with progression and a separate next-step column on wide screens. Existing drafts, bookings and status logic retained. |
| `components/views/leader-dashboard/live-leader-workspace.tsx` | Search with one Filters disclosure containing existing round/status/review/academic controls; existing applicant drawer preserved. |
| `components/views/leader-dashboard/live-applicant-views.tsx` | Pastel Kanban lanes and semantic status badges for live applicant/decision views; List and Kanban still share data, filtering and mutations. |
| `components/interview-kit-session.tsx`, `components/views/interview/interview-mode.css` | Three-panel focused interview presentation, active-question and agenda surfaces, collapsible library and narrow-screen layout. Notes remain explicitly private. |
| `components/manager-overview.tsx`, `components/member-overview.tsx` | Calm meeting/task overview sections using existing live content. |

Meetings, tasks, members, review tools, announcements and settings reuse their existing permission-aware components inside the refreshed shell, including shared table/drawer treatment. Their forms, loading/error/empty states and actions were not replaced.

## Reuse and cleanup

ProductShell, ClubWorkspaceSwitcher, account menu, command search, notification navigation, application tracker, live pipeline/drawer, interview session and overview components were reused. Only presentation wrappers/styles were replaced or extended. No component was deleted and no legacy preview state was introduced into a live workflow.

This pass creates no newly obsolete preview components. The previous audit's unused `components/shell/navigation.tsx` and `components/ui/sidebar.tsx` remain candidates for a separate removal pass. Legacy manager, scheduling, broadcast and voting previews still have consumers and should not be deleted wholesale.

## Validation

- `npm run validate` passes: 218/218 tests, isolated PGlite migration tests, lint (0 errors, 28 existing warnings), typecheck and production build.
- Migration tests exercise all 11 migrations and 27 application tables in isolated fresh/legacy databases. No deployed migrations or provider changes were made.
- `git diff --check` passes.
- Build reports 103 kB shared first-load JavaScript, 471 kB root and 390 kB club workspace. This is build output, not measured field performance.
- Local browser fixture uses current components and isolated deterministic Demo data. Checked Personal Explore/Applications, workspace switching to MII Leader, Club overview, applicant List/Kanban and filtering, anonymous drawer, mobile contextual navigation, and focused interview entry/context/private notes/library collapse.
- Keyboard Enter opens anonymous applicants; Escape closes the drawer and restores originating-card focus. Sampled mobile board/drawer and interview pages had no document-width overflow. Interview checked at measured 320, 433 and 1600 CSS-pixel widths; browser zoom affects requested viewport dimensions.
- Automated tests cover limited permissions, anonymous projection, stale updates and Demo boundaries. This browser pass does not constitute production-account or physical-device certification. A Grammarly-injected hydration warning occurred in the local browser; no application exception was observed in sampled flows.

## Intentionally unchanged boundaries

Announcements and notification delivery remain explicitly preview/unconnected. Legacy local scheduling, branding/application-builder and voting tools remain labeled previews. No fake seasons, deadlines, saved-club persistence, recommendations, ballots, collaborator presence or shared realtime interview notes were added.

Persisted recruiting rules remain save/preview/explicit-flag workflows, not automatic decisions. Existing deployed schema/auth/Storage concerns remain documented in `DEPLOYED_BACKEND_STATE.md` and `PRODUCTION_RECONCILIATION_PLAN.md`; this UI work does not remediate or certify those services.

Real-account authorization, provider flows, cross-device QR, touch-only devices, screen-reader speech output and throttled field performance remain staging/manual QA responsibilities.
