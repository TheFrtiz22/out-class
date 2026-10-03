# OutClass Campus OS

The authenticated product uses a shared visual system. Public marketing retains its own foundations. No authentication, permissions, APIs, database schema, or recruitment actions were redesigned.

## Audit and direction

The previous product used Caslon for controls and dense tables, switched primary navigation according to product mode, and presented most information in equal-weight bordered white boxes. Several screen-specific styles repeatedly overrode the same application and shell patterns. Mobile relied on a desktop navigation drawer.

The replacement uses system sans-serif for compact tools and local variable Caslon for expressive headings. A navy rail anchors the product; warm canvas, blue-gray, sage, lilac, and cream distinguish meaningful workflow surfaces. Orange identifies the current destination, current milestone, and selected actions. The continuous campus ribbon recurs in next-action panels, discovery, recruitment, and empty states.

## Foundations and patterns

- `styles/product-tokens.css`: product-scoped semantic colors, typography, radius, elevation, motion, control and shell dimensions. Root scoping also covers portaled menus and dialogs, and focused interview/voting environments.
- `styles/product-components.css`: page framing, metric strips, segmented controls, neutral and contextual surfaces, profile/community patterns, and overlays.
- `styles/product-workflows.css`: operational pipelines, scheduling, members, settings, interview focus, and voting presentation.
- `components/product`: reusable PageHeader, CampusRibbon, MetricStrip, SegmentedControl, and isolated design reference.
- `components/applications/application-journey-card.tsx`: presentation-only application identity, status, milestones, and next step. Existing fetch/save/submit/navigation handlers stay in the tracker.
- `ProductShell`: one consistent desktop rail, stable student destinations, guarded workspace switching, search, notifications and account controls. Club modes retain permission-filtered destinations.
- `MobileNavigation`: persistent, thumb-friendly primary destinations with a full navigation/workspace sheet. Discovery highlights and applicant lanes use horizontal snap browsing on phones.

Use plain sections for headings and lists. Add a Surface only when grouping has meaning: plain, subtle, outlined, elevated, or brand. Existing Card APIs still work with the product elevation system. StatusBadge shares semantic outcome colors. EmptyState pairs concise next steps with the ribbon.

## Experience coverage

Home prioritizes the next action and upcoming agenda over metric cards. Discovery has a campus hero, prominent search, interest browsing, tactile club identities, and mobile highlight browsing. Club profiles retain owned branding, images, statistics, requirements, application actions, and subscriptions. Applications, Interviews, and Decisions share journey cards and real recorded milestones. Calendar, My Clubs, Notifications, and Profile share the same framing and interaction system.

Club overview and recruitment separate attention summaries, a prominent review action, upcoming work, and quieter tools. Applicant lists/boards retain filtering, sorting, permissions, anonymous review, score context, detail drawers, and explicit status/round actions. Scheduling distinguishes available, partial, and full slots. Focused interviews use a navy toolbar, candidate context, an active question surface, and quiet question/library sections. Voting uses the same focused presentation language; preview-only ballots and authoritative board decisions retain their existing separation.

Members, announcements, rounds, settings, loading, errors, and disabled controls inherit the shared system. Existing preview-only communication and demo notices remain explicit.

## Review

`/preview` opens the actual navigation and student workspace. `/design-system` includes actual discovery, club profile, application, recruitment and scheduling components supplied with clearly labeled fictional fixtures. These fixtures do not activate Demo Mode or write account data.

Responsive review targets: 320px phone, 390px phone, 768px tablet, 1280px laptop, and 1440px desktop. Respect reduced motion, preserve visible focus, keep forms zoomable, and keep overlays/primary controls reachable above mobile navigation and the safe area.

## Product density

Authenticated page titles now name the destination, with personality in short supporting copy. PageHeader defaults to compact density; expressive density is an explicit opt-in. SectionHeading and Surface also expose density, and MetricStrip defaults to a compact status bar with optional linked actions. Product titles are 28–36px, section headings 20–24px, object titles 17px, and metrics 28px. Shared spacing tokens keep these choices consistent without changing public marketing typography.

Home uses a short next-action row above side-by-side applications and upcoming events. Recruitment replaces the tall feature panel with a real review count, submitted/in-review breakdown, and nearby review action; interview-stage application counts remain distinct from bookings. Club overview leads with follow-ups beside the next meeting. Owner setup remains available below the working overview with an expandable compact checklist. Discovery retains the campus photo and ribbon in a shorter contextual header. Application journeys, club profiles, the interviewer hub, focused interviews, voting, and supporting community pages use the same compact foundations.

Density review covered 1366×768, 1440×900, 1512×982, 768×1024, 390×844, and 320×740. All six populated reference patterns fit the viewport width at every size. The reference includes a club overview with an isolated sample meeting and assignment; live recap loading is disabled only in that reference. Sample links show feedback instead of navigating into fictional clubs. The live shell is reviewed separately, with the database boundary below still applying.

At 1366×768, Home’s working area starts at 284px instead of 458px. The applications and agenda sections start together at 428px; both are visible in the initial laptop viewport. Linked metrics were checked for keyboard focus and sample-action isolation. TypeScript, production build, and the 394 active tests pass; lint remains at zero errors and the same 31 warnings.

## Validation boundaries

The local database rejects the configured credentials, so populated authenticated end-to-end workflows cannot be exercised against that database in this session. Visual fixtures cover populated reusable components; automated authorization, booking, recruitment, demo isolation and focus tests validate existing behavior independently. No credentials or database access were changed to work around this limitation.

The starting checkout also contained an unresolved merge conflict in applicant evaluation markup and stray merge text/closing markup in interview and board review. Those small presentation errors were repaired. Prisma Client was regenerated from the existing schema; no migration or schema change was introduced.

Final checks: TypeScript and production build pass. The test suite passes 394 tests with two skipped and no failures. Migration compatibility checks pass for fresh and legacy databases. Lint has no errors and 31 existing warnings. Desktop and phone visual review included populated reusable patterns; the live shell has no horizontal overflow at all five review widths. Command search, navigation-to-main focus, and navigation-sheet focus return were exercised in the browser.
