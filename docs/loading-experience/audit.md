# OutClass loading experience audit

Audited base: `29100f9c` (latest `origin/main` when work began, including #95–#97). Work is isolated on `feat/loading-experience-refinement`. The original checkout and its existing uncommitted edit were preserved.

## Inventory and method

- [render-inventory.csv](render-inventory.csv): **898 individual feedback nodes, pending controls, and lazy boundaries**, expanded with the TypeScript parser so multiple nodes on a compact source line remain separate entries. Each entry records file, line, destination, original treatment, category, disposition, and priority.
- [inventory.csv](inventory.csv) and [inventory.json](inventory.json): **1,506 broad source candidates across 240 files**, including state controllers, polling, autosave, disabled controls, and intentional `return null` branches. These are source-derived triage, not instructions to replace every match.
- [routes.txt](routes.txt): all **59 original route, layout, loading, and error files**. The implementation adds seven nested loading boundaries.
- Reproduce with `node scripts/audit-loading-experience.cjs 29100f9c`.

The scan covers `app`, `components`, `contexts`, `hooks`, and UI-facing `lib` code; server actions and database code were read where needed to trace a request, and left unchanged. Reviewed the existing `LoadingState`, `Skeleton`, `WorkspaceLoading`, dashboard composition, both loading stylesheets, every dynamic import, the existing Suspense fallback, asynchronous controls, and all route entry points. Existing tests and CI logs were also inspected.

The seven categories have different outcomes:

| Category | Treatment |
| --- | --- |
| 1. Initial page/section | Destination-shaped skeleton; one status; decorative blocks; no applicant names or numeric claims. |
| 2. Navigation/lazy code | Explicit fallback inside the existing shell; nested route boundaries use the same primitive. |
| 3. Background refresh | Preserve currently authorized content within its existing scope. Use local pending controls/status. Retain access-loss clearing and stale-result guards. |
| 4. Form/autosave | Preserve controls, focus, drafts, validation, accurate pending/saved/error messages, and duplicate-submit protection. Small existing icons become motion-safe. |
| 5. Upload/processing | Keep actual upload/import/crop/extraction status and review steps. Do not invent percentages or stages. |
| 6. Authentication/permission | Abstract status only while authority is unresolved; retain branded full-entry boundary and fail-closed behavior. |
| 7. Error/empty/unavailable | Keep honest terminal states and existing recovery. A lobby waiting for a proctor is a connection state, not an endlessly spinning fetch. |

## Reviewed destination decisions

P1 means a page, major section, permission check, or blank lazy transition. P2 means compact feedback or a pending action. The CSVs retain each source location; this table records the product decisions across those instances.

| Destination / source family | Original gap | Result | Priority |
| --- | --- | --- | --- |
| `app-shell`, all personal/workspace lazy views | Same generic workspace for clubs, inbox, calendar, forms, applicant tracking; interview lazy entry replaced shell with brand screen | Explicit cards, feed, agenda, forms, application cards, applicant pipeline, interview workspace | P1 |
| `club-workspace`, `club-settings-workspace` dynamic imports | Numerous code loads had no fallback | Every dynamic entry has a descriptive contextual fallback, including settings builders and review drawers | P1 |
| `selected-club-workspace`, `club-members`, `organization-member-management` | Avatar list stood in for four-column membership directory; announcements used cards | Responsive member table and compact announcement feed; original ownership/authority epochs and fresh reads unchanged | P1 |
| `dashboard-presentation`, `manager-overview`, `recruiting-overview` | Full dashboard skeleton inside small task/meeting/review drawers; pipeline CSS collision | Keep distinct club/recruiting overview compositions; form-sized drawer fallbacks; scope dashboard-only pipeline styling | P1 |
| `views/leader-dashboard-view`, `live-leader-workspace` | Generic top-level recruitment wait | Applicant stages, filter positions, candidate rows and review-action positions; retain existing authorized warm pipeline behavior | P1 |
| `club-tasks` | Personal task list disappeared on revalidation | Retain same-club authorized list while refreshing; local status; new scope still loads; failed read still clears data | P1 |
| `views/application-tracker-view`, `views/student-dashboard-view`, `views/unified-student-profile-view` | Existing contextual compositions; inconsistent status semantics | Retain application cards and custom destination skeletons; fix single explicit status/busy semantics for student/profile placeholders | P1 |
| `views/club-manager/application-builder-view`, pipeline builder, screening rules | Builders already had contextual forms/rows; rules still showed generic workspace | Retain builder geometry; rules use form; lazy code has matching pending feedback | P1 |
| `interview-kit-session`, `views/interview-workspace-view` | Generic main/sidebar list for interview session; plain score-history wait | Applicant context column, question, notes, review controls; compact score history rows | P1 |
| `interview-resume-loader`, `interview-resume-preview`, applicant panel | Plain viewer fallback and preview text | Paper-shaped full viewer fallback; compact preview status; existing resource lifetime, access-loss handling, and viewer error boundary unchanged | P1/P2 |
| `interview-submitted-reviews`, `interview-review-references`, `applicant-intelligence` | Plain waits for review/closing DTO/candidate context | Compact rows/forms and localized score status; no private DTO expansion | P1/P2 |
| `interviews/room-manager`, panel planning, `availability/my-availability`, `availability/admin-overview` | Generic rows or isolated text for scheduling | Seven aligned days with time gutter/slots for weekly availability; compact panel schedule; local refresh status with existing content | P1 |
| `interviews/applicant-booking`, booking-link page, interview list, scheduler entry | Inline spinner/rows instead of date/time choices | Month calendar for booking; agenda-shaped interview lists; weekly geometry for schedule management | P1 |
| `live-voting/room-view`, room presentation, board decisions, session join | Restoring-session text, generic candidate rows/workspace | Console and ballot regions versus candidate presentation; session/eligibility checks stay compact | P1 |
| `live-voting/member-voting-pad`, mobile join | Indefinite spinning while proctor hasn't advanced | Static semantic clock with existing lobby/recorded-vote explanation; submit feedback remains pending only during a request | P2 |
| Decision letters and `communications/template-editor` | Decision paper already contextual; template load error shared perpetual loading paragraph | Retain document skeleton; template failure is an alert with explicit retry; form skeleton while pending | P1 |
| Announcement/invitation/availability/decision schedules | Mixed plain text and generic lists | Shared compact feed; existing polling cadence, publication semantics, cancellation and access checks unchanged | P1/P2 |
| `shell/notification-center`, `clubs/saved-clubs-popover` | Separate bespoke static blocks/plain loading text | Shared compact feed within the existing popover dimensions; remove obsolete notification skeleton CSS | P2 |
| `organization-ownership-requests`, memberships, setup checklist, profile suggestions | Standalone paragraphs | Invitations feed, organization cards, checklist rows, compact profile-check status; optional dashboard invitation panel remains intentionally absent when empty | P1/P2 |
| `meeting-workspace`, task/meeting/dashboard preparation drawers, member recaps | Generic lists/plain paragraphs | Schedule-shaped lists; compact forms/details; small recap feed; existing attendance and registration states retained | P1/P2 |
| Admin directory, school review, organization onboarding | Plain waits/mismatched lists | Directory-shaped tables; compact school-selection check; permissions and investigation controls retained | P1/P2 |
| Password reset, QR preparation, check-in, eligibility/access setup | Plain text | Local session/preparation status and appropriate tables; original security, crop/import/upload, and submit flows unchanged | P1/P2 |
| `app/settings`, meetings, interviews, invitations, decisions, application decision, voting room | Only global branded route loader | Seven nested route fallbacks; authenticated parent layouts own navigation, shared primitives own pending content | P1 |
| `Skeleton`, `loading.css`, `interface-primitives.css`, notification CSS | Duplicate owners, shimmer plus animated orange dot, unlayered radius overrode rounded avatars | One CSS owner; restrained transform-only sheen; static status label; honor caller's radius utilities; reduced-motion/forced-colors support | P1 |
| Login, onboarding, school request, toast, indeterminate progress | Some small action animations ignored reduced motion | Keep accurate in-place action feedback and existing guards; animations opt in with `motion-safe` | P2 |

## Performance and privacy decisions

No delay threshold was added: there is no measurement justifying a global wait, and real content should commit immediately. No new background requests, polling timers, data caches, database changes, or authorization changes were introduced. The only new retry is an explicit user action after failed letter-settings loading.

Same-scope warm content stays usable where already supported. The task-list improvement uses its existing club-scoped workspace; selected-resource tests continue to hide content on club, identity, support, privacy, or authority changes. Failed protected reads keep their existing fail-closed behavior. The abstract skeletons contain no names, candidate metadata, fabricated metrics, stage percentages, or interactive controls.

All interface icons continue to come through `@/components/icons` and the existing Phosphor package. The MIT notice and branding artwork are unchanged.
