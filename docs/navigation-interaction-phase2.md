# Phase 2: Navigation and interaction refinement

Implemented in the existing OutClass shell and data layer. No new endpoints, schema changes, deployment, or production migrations.

## Behavior

- Explore no longer offers Fund Size filtering. Legacy `aum` query values are ignored and removed; unrelated search parameters, other filters, and public club AUM/profile editing remain intact.
- Explore and Corkboard open the same anchored Saved Clubs popover. It reads the existing Corkboard provider, including optimistic changes and rollback. It supports profile links, removal, loading/error/retry/empty states, long lists, outside click, Escape, and keyboard focus restoration. The existing `/saved-clubs` route remains available for bookmarks.
- Availability leaves the persistent sidebar. Substantial calendar buttons near the profile header, Calendar header, and interview room scheduling controls open `/settings/availability`, retaining club/round context when supplied. The global schedule, 8 AM–9 PM range, and America/New_York timezone are unchanged.
- The Club sidebar parent, page titles, and related guidance say Settings, retaining the original settings route and customization controls.
- Recruiting and Club both expose the same Announcements component with the existing `meetings.manage` permission. `section=announcements&mode=recruiting` retains the Recruiting shell; the existing Club entry remains `section=announcements`.
- Applicants and Decisions are accessible collapsible groups in the shared desktop/mobile-drawer navigation. Each child retains its original route and permission. Direct child destinations expand the parent and highlight the child. Compact mobile destinations represent groups once.
- Tutorial X and Escape close immediately, including during an outstanding save. Account/experience-scoped local dismissal prevents reopening after refresh/navigation while offline. Existing server progress is synchronized on load/reconnection; other tabs also close. Preview fallback uses session storage, separate from live/demo progress. Stale responses cannot reopen a dismissed guide, queued writes are scoped to the mounted identity, and Tutorial help can restart the walkthrough. Focus returns to the original control or the remounted Tutorial help button.
- Account, Personal workspace, profile navigation, and profile search controls use the shared avatar with the existing protected photo source and initials fallback. People/group icons for applicants, members, and unrelated records remain.
- Expanding navigation groups and opening mobile navigation are local interactions and bypass autosave navigation flushing. Actual destination changes retain the existing autosave guards.

## Changed files

| Area | Files |
| --- | --- |
| Directory and saved clubs | `lib/club-directory.ts`, `components/views/explore-view.tsx`, `components/views/corkboard-view.tsx`, `components/clubs/saved-clubs-popover.tsx` |
| Shared navigation and modes | `lib/product-navigation.ts`, `components/club-workspace.tsx`, `components/shell/workspace-navigation.tsx`, `components/shell/product-shell.tsx`, `components/shell/mobile-navigation.tsx`, `components/shell/responsive-workspace.css`, `lib/autosave-navigation.ts` |
| Availability entry points | `components/availability/availability-button.tsx`, `components/views/unified-student-profile-view.tsx`, `components/views/calendar-view.tsx`, `components/interviews/room-manager.tsx` |
| Settings labels | `lib/views.ts`, `components/club-settings-workspace.tsx`, `components/club-profile-settings.tsx`, `components/views/leader-dashboard/live-leader-workspace.tsx` |
| Tutorial | `components/tutorial-walkthrough.tsx`, `lib/tutorial-dismissal.ts` |
| Current-person avatars | `components/account-avatar.tsx`, `lib/profile-photo.ts`, `components/club-workspace-switcher.tsx`, `components/shell/navigation.tsx`, `components/shell/navigation-search.tsx` |
| New verification | `tests/navigation-refinement.test.cjs`, `tests/navigation-refinement-browser.test.cjs`, `tests/helpers/browser-bundle.cjs` |
| Updated regression expectations | `tests/campus-illustrations.test.cjs`, `tests/club-directory.test.cjs`, `tests/club-workspace.test.cjs`, `tests/student-journey.test.cjs`, `tests/support-tutorials.test.cjs` |

## Verification and limits

Local results:

- `npm test`: 1,145 passed, 24 environment-dependent tests skipped, zero failures (1,169 total).
- `npm run lint`: zero errors; 28 existing warnings.
- `npm run typecheck`: passed.
- `npm run build`: passed, including page generation and route tracing.
- `git diff --check`: passed.

 The browser tests exercise real React components, Radix controls, the shared Corkboard provider, and tutorial behavior against an isolated HTTP fixture. They verify keyboard/mobile interactions, long lists, shared removal/persistence/rollback, availability routes, image/initials rendering, pending tutorial saves, offline refresh, manual restart, and dismissal across tabs. Unit/regression tests cover permission-gated navigation, legacy filter cleanup, and existing forms/autosave behavior.

The browser fixture isolates application data and does not send announcements, email, decisions, or production requests. Authenticated production smoke testing and environment-dependent native PostgreSQL checks remain outside this local verification. Existing repository hook warnings are reported separately from lint errors. When both browser storage and the server are unavailable, tutorial dismissal lasts for the mounted session; durable dismissal needs either storage or a successful server write. Availability completion text is supported when a caller already knows the status; these entry points do not add a second schedule read or duplicate schedule state.
