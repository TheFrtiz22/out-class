# OutClass launch-quality audit

Reviewed September 22, 2026. This is a product/UI audit with local production-build inspection, not a certification of the deployed backend. The prior responsive pass remains in the working tree; this audit builds on it.

## Assessment

The redesigned student product, public site and real applicant/interview/decision workspaces share a coherent bright, navy-led visual language. There is no reason for another broad redesign. The largest launch gap is the difference between the working applicant workflows and several local administrative previews. OutClass should not claim that every recruitment workflow is live until those integrations are completed and tested with the configured services.

## Route and screen review

Most authenticated destinations are view IDs within AppShell, not distinct URLs. These were reviewed through the existing shell, without restructuring navigation.

| Route / screen | Review result and action |
| --- | --- |
| `/` public landing | Restrained editorial headings, preserved wordmark, licensed local campus image, clear CTA, product-led stories and footer. Mobile demo is a static three-candidate snapshot; desktop motion and pause controls retained. Existing reduced-motion and progressive-reveal behavior retained. Local production observation recorded no initial layout shift. |
| Sign in | Clear UVA eligibility, labeled inputs and focused form. Tested desktop/mobile and short viewport. Live Microsoft/email delivery is unverified; no auth semantics changed. |
| Onboarding | Existing structured steps retained. Tested the account-entry screen across six widths. Multi-step live account creation/upload requires service-backed end-to-end testing. |
| Student Home | Calm next-action hierarchy, compact application list and agenda, secondary discovery. Source and prior responsive screenshots reviewed; production empty-state/navigation smoke checked. No new equal-weight cards or metrics added. |
| Discover | Search/filter controls, categories and organization rows retained. Production tests cover populated directory, search, navigation and subscription persistence. No invented recommendations. |
| Club profile / `/club/[clubId]` | Identity, application CTA, status timeline and self-reported information remain structured. Populated component tested through directory fixtures; standalone route tested in its service-unavailable state. Club marks now show initials immediately while an image loads instead of a blank tile. |
| Applications overview | Existing row hierarchy and draft/in-progress/decision groups retained. Production responsive checks use real-shaped records. Logo loading treatment improves visual continuity. |
| Application form / status / decisions | Required validation, dirty guards, save failure recovery, confirmation, submitted lock and respectful decisions verified with mocked transport. No validation or decision semantics changed. |
| Calendar | Agenda remains default; optional grid views retained. Production tests cover event details, persisted-event protections, export and local RSVP. Event semantics are unchanged. |
| Notifications | Priority/club grouping, readable detail view and restrained unread states retained. Read/unread, undo and reload persistence checked. Toast offset now clears student bottom navigation. |
| Profile | Editorial identity plus functional section editing retained. Short-height dialog, save, cancel and keyboard dismissal checked. No unnecessary new containers. |
| Leader applicants | Dense desktop table / mobile list retained. Replaced text-only auth loading with the shared skeleton. Authorized review, filter context, score save, separate round/status changes and confirmation checked. |
| Interview Mode | Focused identity/context/notes/score layout retained. Dirty navigation, save-before-next, keyboard save, failed-save retention and reduced motion checked. No decorative animation added. |
| Board Voting Mode | Focused candidate presentation retained. Confirmation, expected-status writes, failure recovery, role restrictions and return to filtered context checked. This is not collaborative ballot infrastructure. |
| Interview Scheduler | Existing tabs and local schedule tools retained. Schedule-creation dialog now uses shared radius/surface/shadow defaults. Explicit local-preview notice prevents confusion with live bookings. |
| Club Settings: roster, application builder, pipeline, events, branding, QR | All six tabs reviewed in the production viewport matrix. Detailed roster remains horizontally scrollable with guidance; local-preview notice added. Invitation feedback now says no email was sent. Existing permissions-preview behavior is unchanged. |
| Broadcast Messages | Existing layout retained. Preview notice, action text and success feedback now accurately describe local history rather than delivered push/email. |
| Screening / Management Portal | Source-level review of secondary legacy views. Added the same explicit local-preview notice. These are not promoted as live workflows. |
| `/check-in` | Existing unavailable/preview states retained. Uses the actual logo and navy/warm-surface tokens instead of a plain-text mark and black controls. Cross-device attendance is still not connected here. |
| `/live-voting`, `/vote` | Existing clearly labeled same-browser proctor/member previews retained. Reviewed at six widths. Do not confuse them with the authenticated board-decision workflow. |
| `/preview` | Existing public exploration route retained; no fabricated production data introduced. Authenticated branches continue resolving real memberships and server actions. |
| `/design-system` | Component reference checked across widths; noindex metadata retained. Not a student destination. |
| Unknown routes | Added branded, restrained 404 with a clear return action. Production HTTP status and navigation checked. |
| Page render failures | Added a generic, actionable error boundary with retry/home actions; no exception details exposed. Root-layout failures remain outside this page boundary. |
| `/auth/callback`, `/api/users/me` | No standalone visual interface. Callback source remains unchanged; unauthenticated API should return 401. Icons are asset routes, not product screens. |

## Material fixes in this audit

- Shared recovery pages: `app/not-found.tsx`, `app/error.tsx`.
- Mobile toast clearance: `components/ui/sonner.tsx`, `app/globals.css`.
- Stable logo fallback: `components/club-logo.tsx`.
- Consistent loading/dialog/brand treatment: leader entry, schedule dialog and check-in components.
- Accurate preview communication: shared shell, roster invitations and broadcast feedback. No backend capability was invented or disabled.
- Fixed the two nullable-context diagnostics by capturing the narrowed provider values for the update closure.
- Repaired four tests with test-owned fixtures rather than restoring sample applicants to production data.
- Re-enabled build-time TypeScript enforcement. Excluded alternate generated build directories from application type checking to avoid conflicting generated route declarations; the primary production route types remain included.

## Validation and production inspection

- All 66 Node tests pass.
- `tsc --noEmit` passes.
- Production build passes with type checking enabled.
- `git diff --check` passes.
- `npm run lint` cannot run: ESLint and its configuration are not installed. Build lint remains skipped; this is outstanding validation debt, not a passing lint result.
- Served the compiled production build on port 3002, separately from the development server.
- Public/secondary route matrix: 96 viewport checks, no page-level horizontal overflow, at 320/430/768/1280/1440/1920px. Additional populated workflow scripts cover the main student/leader screens, reduced motion and short-height forms.
- Production functional checks use isolated HTTP/server-action fixtures. These are not live Supabase/Postgres, Microsoft sign-in, email, storage or cross-device tests.
- Local unthrottled landing observation had CLS 0 during the initial inspection window. This is not a mobile field-performance score or a claim about all loaded states.
- Build reports 411kB first-load JS for `/` and `/preview`, with 103kB shared. The public site imports the broad AppShell graph; separating marketing from infrequently used workspaces remains valuable.

## Remaining technical debt / launch risks

1. No configured live database/auth/storage environment was available for this audit. Validate UVA email enforcement, permissions, draft/submission races, file access, status concurrency and club isolation against real staging services before launch.
2. ESLint/CI and durable browser-test infrastructure need setup. Current browser scripts run from the local audit workspace; they are not a checked-in CI suite. The Node tests remain checked in.
3. AppShell eagerly imports many screens. Route/view-level lazy loading, cache behavior, and query pagination/indexing need measurement with realistic recruitment volume.
4. Image optimization is globally disabled. Campus images are already locally sized WebP; remote club/avatar/resume resources still need production loading/access validation. Avoid switching optimization on without reviewing allowed sources.
5. Legacy customization, scheduling, broadcasts and attendance code still coexist with live CRM workflows and hard-coded preview club/campus defaults. Preview labels reduce confusion but do not complete these integrations.
6. Physical iOS/Android keyboards, safe areas, VoiceOver/NVDA, zoom, and slow-network usability need human/device testing. Chromium viewport emulation is not a substitute.
7. The new page error boundary does not cover a failed root layout. Operational error monitoring and deployment recovery should be verified separately.

## Intentionally deferred functionality

No new major features, schema migrations, dependencies or backend semantics were introduced. Still deferred where not already persisted: live administrative publishing, roster invitations/role editing, scheduling builders, broadcast/email delivery, server-synced subscription/notification workflows, cross-device attendance, real-time multi-device voting/ballots, persisted round targets, configurable rubrics, reapplication/semester/year eligibility rules, and LinkedIn/resume parsing. Existing upload/link functionality remains distinct from parsing. Future campus configuration should replace remaining UVA-specific preview defaults without altering the launch identity now.

## Five highest-value next improvements

1. **Complete and honestly gate the live administrative workflows.** Connect the existing builders, invitations, schedules and communications to authorized persistence; prioritize the workflows launch clubs actually need.
2. **Run a real staging recruitment cycle end to end.** UVA sign-in → profile/resume → application → interview/evaluation → president decision → student delivery; include two clubs to prove isolation and concurrent writes.
3. **Make quality checks repeatable in CI.** Configure ESLint, retain mandatory types/tests/build, and promote the key fixture-backed browser flows into a maintained runner with accessibility checks.
4. **Reduce initial JavaScript and validate production performance.** Split the marketing/workspace bundles, measure mobile LCP/INP/CLS under throttling, and optimize images/queries based on evidence.
5. **Conduct a focused student/leader usability and accessibility session.** Test real phones, keyboard/screen-reader use, first-time discovery, application recovery and high-volume review before adding more visual effects.
