# OutClass — platform-wide visual unification

Status: **foundational change in progress, not a claim of end-to-end completion**. This document is the implementation contract for carrying the design from the floating top navigation and expanding navy dock into every product surface. Reference: the four student Home, Applications, club Overview and Recruitment screenshots supplied October 28, 2026. Existing functionality is the source of truth.

## Outcome

Every OutClass screen should feel like the same deliberately designed product. The navigation remains the visual reference and should not be rewritten. Use its polished silhouette, quiet depth, precise geometry and restrained motion to inform *content*, not to add translucent glass to ordinary forms, tables, or large scroll containers.

### Non-negotiables

- Preserve the current **floating header, workspace modes, expanding sidebar, mobile navigation, search, notification center, keyboard flow, role-based destinations, permission filters and leave guards**. Never replace these to accomplish a styling task.
- Preserve real application and recruiting data, auth and authorization, database models, requests, server actions, autosave, error/retry behavior, selection, sorting, filtering, draft/submission/decision workflows and URL/back behavior. Do not insert fake content or placeholder metrics.
- Keep existing Source Sans 3 body and Libre Caslon Text display pair, Phosphor icons, navy/cream/orange palette, existing brand artwork and intentional campus/event imagery. Do not import a new UI framework or another icon library.
- Honor `prefers-reduced-motion`, `prefers-reduced-transparency`, increased contrast, forced colors, 200% zoom, safe areas, mobile touch targets and WCAG 2.2 AA.
- Do not trade page speed for decoration: no heavy backdrop filtering on scrolling content, nested blurs, per-frame JavaScript, unbounded animated lists or new fetches for aesthetic reasons.
- Do not merge unrelated historical optimization experiments. Only integrate confirmed changes on latest `main`; respect pending performance work and evidence gates.

## Material and hierarchy

The optical navigation is **Layer 3**. Content sits beneath it:

1. **Canvas** — warm off-white, open page gutters, generous deliberate whitespace.
2. **Operational surface** — nearly white card, subtle structural border, approx. 18px corner radius, near-invisible resting shadow; used when content needs a boundary. Flat rows and dividers remain valid *inside* grouped surfaces and dense data grids.
3. **Interactive floating navigation and transient overlays** — keep existing navy/light optical material, deeper shadow and branded orange active markers. Do **not** replicate navigation blur on every card.

Keep one restrained dark/navy feature surface per viewport only when a true urgent action merits it. Muted blue, warm and sage surfaces should indicate a purposeful semantic grouping, not arbitrary page ownership. Use orange sparingly for selected navigation, actionable highlights, and critical accents—not all buttons or every card.

### Canonical visual tokens and components

- `styles/product-tokens.css`: product material/spacing/elevation tokens; global precedence remains `app/globals.css` and the existing product shell selectors.
- `styles/product-components.css`: shared `PageHeader`, `MetricStrip`, `SegmentedControl`, Card, tabs, form-field and table styling. Reuse component APIs in `components/product` and `components/ui` rather than inventing replacements.
- `styles/navigation-glass.css` and `components/shell/*`: keep their existing independent material tokens and all navigation behavior.
- Keep borders light but legible; card shadow < floating menu shadow. Use 140–220ms compositor-friendly hover/focus motion and clear pressed/selected states.
- Page headings have shared baseline/spacing, a large concise primary title, one short descriptive line if needed, and aligned actions. Section titles share spacing and weight; microcopy is secondary, not an extra headline.
- Use consistent row heights and padding; long labels wrap without hiding primary actions. Never make an entire area clickable without the correct keyboard/accessible semantics.
- Status chips keep meaning, not decorative badge overload. Counters should be aligned, tabular, and only shown if actionable/meaningful.
- Empty states occupy no more area than their importance warrants and point to real next steps. Loading skeletons must preserve content structure; errors never masquerade as empty results.

## Whole-platform coverage contract

The source of truth is the *current repository*; do not stop at these examples. Audit every visible route, modal/drawer, loading/empty/error state, mobile adaptation and role variant before marking the effort complete.

| Domain | Representative entry points / code | Visual outcome |
| --- | --- | --- |
| Public, auth and onboarding | `app/page.tsx`, `app/login`, `app/signup`, `app/auth`, `app/forgot-password`, `app/reset-password`, `app/uva`, `app/about`, `app/request-school`, `components/views/auth-view.tsx`, `components/views/student-onboarding-wizard.tsx` | Public story remains distinctive; forms, disclosure and transitions feel related to the product without copying card/rail styles |
| Personal home and discovery | `components/views/student-dashboard-view.tsx`, `student-home.css`, `explore-view.tsx`, `saved-clubs-view.tsx`, `components/personal-clubs.tsx`, `components/clubs`, `app/saved-clubs` | Precise page framing; real next actions, grouped applications/events/updates; usable discovery cards and responsive empty states |
| Applications and status | `components/views/application-tracker-view.tsx`, `components/applications/*`, `app/applications/[applicationId]`, `app/decisions`, `app/invitations` | Calm cards and filters, obvious drafts/requirements/status, prioritized writing, autosave and submit/error feedback preserved |
| Calendar, notifications and profile | `components/views/calendar-view.tsx`, `inbox-view.tsx`, `unified-student-profile-view.tsx`, `components/settings/*`, `app/settings/*` | Shared layout and row hierarchy, obvious upcoming work, consistent calendar cells/fields/notification density |
| Club overview and membership | `components/manager-overview.tsx`, `components/member-overview.tsx`, `components/club-workspace.tsx`, `components/club-members.tsx`, `components/club-profile-settings.tsx`, `components/organization-member-management.tsx`, `app/club/[clubId]` | Compact meaningful top action, grouped responsibilities, activity, membership, identity and settings. Keep permission-bound actions intact |
| Recruitment and applicant review | `components/recruiting-overview.tsx`, `components/views/leader-dashboard/*`, `components/views/screening-dashboard-view.tsx`, `components/applicant-intelligence.tsx`, `components/product/operational-dashboard.css` | Cohesive pipeline, prominently surfaced real bottlenecks, consistent data density, review states and actionable rows |
| Interview booking and rooms | `components/views/interview-scheduler-view.tsx`, `interview-workspace-view.tsx`, `components/interviews/*`, `components/availability/*`, `components/interview-* `, `app/interviews/*` | Accurate scheduling states, distinct booking/assigned/available views, readable room and evaluation interfaces |
| Club workflows, meetings and tasks | `components/views/club-management-portal-view.tsx`, `components/views/club-manager/*`, `components/club-tasks.tsx`, `components/tasks/*`, `components/meeting-workspace.tsx`, `app/meetings/*` | Consistent dense workspaces, row actions, creation flows, drawers, feedback and selected states |
| Events, Corkboard and public club profile | `components/views/corkboard-view.tsx`, `components/events/*`, `app/corkboard`, `components/views/club-profile-view.tsx` | Preserve distinctive corkboard flyers; unify its surrounding controls, event detail, creation forms and list mode |
| Communications, decisions, invitations | `components/communications/*`, `components/club-announcements.tsx`, `components/decision-schedules.tsx`, `components/communication-schedules.tsx`, `components/invitation-* ` | Shared forms, readable messaging, correct publication/status confirmations, no invented progress or sends |
| Voting and focused modes | `components/live-voting/*`, `app/voting/*`, `app/vote`, `app/live-voting`, `components/views/interview/*` | Purpose-built immersive layouts retained; surrounding controls and feedback harmonize with product, no forced dashboard card grid |
| Platform administration/support | `components/admin/*`, `app/platform/*`, `components/platform-view-banner.tsx`, support/view-as routes | Same typography and content hierarchy, denser tables and action groups; never hide high-stakes controls or security state behind ornamentation |
| Shared details and overlays | `components/shell/*`, `components/product/*`, `components/ui/*`, `components/product/dashboard-drawer.tsx`, `styles/product-workflows.css`, `styles/interface-primitives.css` | Every modal, popover, toast, validation, menu, tooltip, sheet, loading and error state follows consistent styling and interaction rules |

## Migration execution order

1. **Inventory and baseline**: enumerate all discoverable routes and UI owners, capture current desktop/tablet/mobile screenshots and representative empty/dense/error states. Record mismatches in one checklist; no screenshots may be a substitute for behavior tests.
2. **Shared foundation**: establish material tokens, component size/radius/type and interaction rules. Apply through product shell shared components rather than piling `:has` overrides and CSS patches at the end. Navigation remains unchanged.
3. **Personal journeys**: Home → Explore/Save → Apply/Write → Status/Interviews → Calendar/Notifications/Profile. Test all connected states and back/refresh.
4. **Club Leader journeys**: Overview → Recruitment → Pipeline/Reviews → Interviews/Rooms → Club/Members/Tasks → Events/Announcements/Settings. Prioritize *real bottlenecks* and data visibility, not decorative dashboards.
5. **Admin, support, focused tools, onboarding and public/auth**: cover every route and role-specific variant. Harmonize without breaking specialized immersive or marketing layouts.
6. **Final integration**: remove obsolete screen-specific style overrides where safe, verify CSS specificity at shared boundaries, run automated and visual regression matrix, and compare perf budgets. Repeat until checklist has no unexplained exceptions.

**Do not declare completion merely because the first four screenshot pages match.** Coverage across all navigable screens and overlay states is the acceptance gate. Implement the entire scope in reviewable increments and keep a per-area before/after report. Unfinished areas must remain explicitly listed.

## Visual QA acceptance checklist

- Desktop 1440×900 and 1280×800; tablet 1024×768 and 768×1024; mobile 390×844 and 320px width; plus zoomed layout at 200%.
- Baseline/after screenshots for student, member, club leader and platform admin role contexts. Use synthetic fixture accounts; no real student/club/private information in artifacts.
- Cover nav collapsed/expanded and dock hover, selected/mode switching, modal/drawer/flyout overlays, forms, validation errors, keyboard-only tab traversal, responsive tab/filter controls and vertical scrolling.
- Test no accidental horizontal page scrolling, no card/icon clipping, clean focus rings, minimum mobile 44px touch targets, readable contrast, and reduced motion/transparency/forced colors.
- Load, empty, partial, full, error, retry, stale-data and denied states remain honest. Critical actions are visually above redundant descriptive copy.
- No changes to route state, API calls, migration/schema, access control, autosave or submission, no introduced performance regressions. Check React warnings/hydration and LCP/INP, especially navigation and dense tables.
- CI gates: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, targeted Playwright and accessibility checks. Existing failures must be diagnosed, not bypassed. Rebase on latest `main` before merging.
- Final summary must report exact files changed, screen-state coverage, test results, screenshots, and known incomplete areas. Keep `main` production-ready.

## First implemented foundation

The initial branch defines `--oc-content-*` material tokens and applies them to shared metrics, cards, segmented controls, personal Home and recruiting/club overview surfaces. That is **cross-platform groundwork**, not final application-wide visual QA. Continue the migration above before claiming the entire platform has been redesigned.
