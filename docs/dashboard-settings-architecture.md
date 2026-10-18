# Dashboard and settings architecture

## Route inventory (recorded before implementation)

All `app/**/page.tsx` and layout files, the query-driven student views, club workspace sections, and platform sections were audited.

| Route / view | Original experience | Decision |
| --- | --- | --- |
| `/settings/organizations` | Independent logo, “Back to dashboard”, full-height main | Shared dashboard shell + personal Settings navigation; preserve memberships, invitations, dismissed requests, claims |
| `/settings/availability` | Independent logo and “Back to Home” | Shared shell + Availability settings; preserve club/round query parameters |
| `/settings/interviews` | Standalone panel schedule and calendar backlink | Shared shell, Calendar context; keep URL as an operational schedule, outside Settings secondary navigation |
| `/invitations/[id]` | Independent logo, standalone join/claim response | Shared personal shell; preserve verification, unavailable/error states, accept/decline actions |
| `/club-claims/[clubId]` | Standalone claim form and homepage backlink | Shared personal shell, Organizations breadcrumb; preserve evidence and approval flow |
| `/club-access/[clubId]` | Standalone role/access editor and raw backlink | Shared organization shell, Settings context; retain server access checks |
| `/meetings`, `/meetings/[id]` | Standalone meeting list/detail and backlinks | Shared personal shell, Meetings context; preserve filters and detail links |
| `/club/[clubId]/tasks` | Standalone team tasks | Compatibility redirect into existing club workspace Tasks, preserving query parameters |
| `/saved-clubs` | Standalone saved-clubs view | Shared shell when authenticated; retain signed-out local saved-clubs experience |
| `/corkboard` | Standalone event discovery | Shared shell when authenticated; retain public discovery |
| `/club/[clubId]` | Public club profile, also visited by signed-in users | Shared shell when authenticated; retain public profile for visitors |
| `/?workspace=student` and `view=student-dashboard,explore,corkboard,tracker,status,calendar,my-clubs,student-profile,inbox` | Existing DashboardLayout/ProductShell | Retain; add discoverable Settings entry and use same shell architecture |
| `/club/[clubId]/workspace` (overview, meetings/events, tasks, members, announcements, recruitment, settings) | Existing ProductShell | Retain; refine configuration navigation, link personal/organization settings, preserve operational routes |
| Legacy leader views (`leader-dashboard`, `club-manager`, `club-management-portal`, `screening-dashboard`, `interview-scheduler`, `broadcast-messages`) | Existing guarded redirects into club workspace | Retain compatibility and role checks |
| `/interviews`, `/decisions` | Redirects into applicant Status | Retain; already arrive in student shell |
| `/platform`, `/platform/[section]`, `/platform/clubs`, `/platform/claims`, `/platform/events`, `/platform/school-requests` | Shared AdminShell | Retain elevated administration and separate authorization |
| `/platform/view-as` | Authorized redirect into selected user's workspace | Retain |

## Intentionally separate experiences

- `/`, `/about`, `/uva`, `/request-school`: public marketing and school requests. The homepage also hosts the existing query-driven authenticated dashboard.
- `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/student-claim`, auth callback routes, `/platform/login`: account entry, recovery, verification, and elevated authentication must work without an authenticated dashboard.
- `/interviews/book`: token-based, focused applicant booking, including signed-out entry and verification.
- `/applications/[applicationId]/decision`: focused formal decision letter presentation.
- `/check-in`: QR attendance workflow intended for a mobile check-in session.
- `/vote`, `/live-voting`, `/voting/[sessionId]/join`: session/PIN-based live voting and presentation experiences.
- Immersive interview mode in the club workspace and legacy `view=interview-workspace`: focused interview/review workspace with explicit exit navigation.
- `/preview`: deliberate embedded/demo presentation. `/design-system`: internal component reference.
- Framework loading/error/not-found pages and API routes are not dashboard destinations.

## Implementation and validation

Implementation details, final navigation, and verification results follow.

### Shared layouts

`AuthenticatedPageLayout` verifies the existing authenticated identity and renders `RouteWorkspaceShell`, which reuses `ProductShell`, `AuthSessionBoundary`, the organization switcher, account controls, notification center, desktop rail, and mobile navigation. Route layouts cover settings, invitations, ownership claims, workspace access, meetings, saved clubs, and the public corkboard when authenticated. Public club profiles use the same optional authenticated boundary. Content pages no longer render an independent brand header or a second `main` landmark.

`app/settings/layout.tsx` retains the shell and secondary navigation across personal sections. The established student DashboardLayout and club workspace keep their existing client navigation and now use the same breadcrumb presentation. The platform AdminShell and its elevated authorization remain intact. Suspended club notices retain the personal shell without rendering operational tools.

### Settings navigation

| Personal | Existing functionality |
| --- | --- |
| `/settings` | Overview and links to all supported personal settings |
| `/settings/profile` | Existing personal information/photo, academics, experience, links, résumé, and profile-edit dialogs |
| `/settings/account` | Verified account email, university, sign-in method, existing password recovery for password accounts; security mutations unavailable during support impersonation |
| `/settings/notifications` | Existing email categories and frequency preferences; in-app/security notification behavior preserved |
| `/settings/organizations` | Current memberships/roles, workspace links, pending and dismissed invitations, accept/decline/restore, organization discovery and claim entry |
| `/settings/availability` | Existing cross-organization schedule with preserved club/round query parameters |

Organization settings remain at `/club/[clubId]/workspace?section=settings`, with permission-filtered sections:

- General (`setting=general`): organization profile, branding, contact details, discovery visibility.
- Recruitment & Applications (`setting=application`): application questions, availability, deadline, and student preview.
- Application Cycles (`setting=cycles`): existing cycle creation, naming, archiving.
- Recruitment Rounds (`setting=pipeline`): existing versioned rounds, types, instructions, duration, and ordering.
- Interviews (`setting=interviews`): interview master kits and administrative interview access. Operational scheduling, room/panel management, résumé moderation, and submitted reviews remain in Recruiting → Interviews. Scheduling-only grants can reach this existing operational workspace without requiring applicant-review access.
- Members & Permissions (`setting=members`): existing member and role/access controls, with Members still available as an operational destination.
- Communications (`setting=notifications`): invitation email preference and existing decision letter templates/formal-letter preference, filtered by their existing permissions. Sending and scheduling invitation batches links to operational Members.
- Ownership & Administration (`setting=advanced`): ownership/claim status and existing transfer/access workflow.

The menu links personal settings to organizations the user may configure. The organization workspace links back to personal settings. Switching organizations from Settings retains the current section when permitted, otherwise selects the destination organization's first permitted section. Known unauthorized sections show an access message and never mount their editors. All existing server action authorization remains authoritative.

There is no organization-wide task-default model or mutation, session-management UI, or in-app notification toggle in the current application; no placeholder controls or database changes were introduced. Per-task assignment configuration stays in Tasks.

### Compatibility and interaction

All original URLs remain available. The old `/club/[clubId]/tasks` destination redirects to the existing Tasks workspace, retaining repeated query values and filters. Recruitment `tool=cycles` and `tool=letters` bookmarks resolve into the matching Settings section. Old interview operational tabs under Settings resolve into Recruiting → Interviews, retaining round context. `/settings/interviews` remains the operational panel schedule with Calendar active rather than being represented as a settings category.

Desktop uses a secondary menu and a comfortable-width panel. Tablet/mobile use labelled native section selectors while retaining the global drawer, bottom navigation, and account controls. Existing save, autosave, publish, retry, and invitation feedback remain in place. Section navigation checks ongoing saves and unsaved changes; mobile organization navigation uses the same guard and discard behavior as desktop.

### Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and 26 existing warnings.
- Production `npm run build` using the disposable local environment: passed, including Next.js type and lint checks.
- `node --test --test-concurrency=4 tests/*.test.cjs`: 1,250 tests; 1,220 passed, 0 failed, 30 environment-dependent tests skipped.
- `npm run test:migrations`: passed; all 56 existing migrations verified against fresh and legacy fixtures, with browser-role isolation on all 78 tables. No migration was added.
- Complete onboarding E2E: all 14 checks passed, including actual email confirmation/resend, ownership, roster import, invitation recovery, replay safety, SMTP capture, legacy mailbox verification, and MFA password recovery.
- Settings browser E2E: all 11 checks passed against real Supabase Auth, PostgreSQL, server actions, and the production Next server, with no uncaught browser errors.

Browser coverage uses desktop 1440 × 1000, tablet 820 × 900, and mobile 390 × 900 viewports. It verifies one shell and one main landmark, persistent shell identity across personal settings, breadcrumbs/current navigation, denied direct URLs and actions, limited interviewer access, scheduling-only access, organization switching, application publication, profile and notification saves, refresh, browser back/forward, dismissed invitation recovery, acceptance/decline, ownership claim submission, task/cycle/letter URL compatibility, meeting list/detail, availability, interview schedule, saved clubs, public club profiles, mobile selectors/drawers, horizontal overflow, and the elevated superadmin shell. Desktop/tablet/mobile screenshots were visually reviewed.

The new `npm run test:settings:e2e` command reuses the isolated onboarding runner (`--settings`). Its database, Auth service, and SMTP capture use reserved localhost ports 55321–55327 and app port 3107. The runner enables local mail delivery so email assertions can observe the captured messages. Replayed invitation acceptance is checked for its existing idempotent response and unchanged membership/audit counts.

Settings editors keep their mounted state through configuration-version refreshes so success feedback remains visible. Changes to account, organization, membership status, permissions, or interview offices still reset the editors immediately.
