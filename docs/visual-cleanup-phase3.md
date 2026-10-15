# Phase 3: Visual cleanup and Tasks

Implemented October 15, 2026. No deployment, database migration, or production task writes.

## Pages and visual changes

- **Shared authenticated shell:** removed the internal “Your campus, connected” slogan, repeated institutional footer, redundant workspace caption, and repeated mode label. The OutClass logo, current workspace name, avatars, navigation, search, and mobile drawer remain. Useful navigation group names remain in ordinary case.
- **Shared page headers:** one compact title/action layout, smaller authenticated title scale, normal-case contextual captions, and no architectural illustration slot. Removed obsolete automatic artwork mappings, header artwork CSS, and the unused ribbon component. Original image assets, brand colors, typography, club logos, profile photos, functional icons, charts, and public landing imagery remain.
- **Home, Explore, Corkboard, Applications/Status, Saved Clubs, Profile, and Interviews:** removed redundant campus/page-purpose labels. The shared Dashboard layout also cleans headers on Calendar, Notifications, and My Clubs. Club names, profile education records, validation, privacy guidance, deadlines, and status information remain.
- **Club overview, Tasks, Settings, Recruiting, Meetings, Members, Announcements, and platform club editing:** removed repetitive public-profile shortcuts in the shared Club header, standalone Tasks navigation, and platform editor. Public profile routes, student discovery, and the live public-profile preview inside appearance editing remain.
- **Tasks / My Tasks:** Due, Missing, and Submitted are compact 44px filter controls. Zero counts stay quiet. My Tasks/Manage, status filtering, and search share a tighter toolbar. Task rows use small functional icons, normal title text, subtle separators, readable due dates, and restrained overdue emphasis. The standalone Tasks route uses the authenticated visual tokens and compact spacing.
- **Tasks / Manage:** compact summary counts, tighter assignment rows, aligned search and actions, existing review/member/project views, and clearer empty states. Both task modes share the same control, search, summary, and empty-state styling. Empty states distinguish “You're all caught up,” “No tasks yet,” and “No tasks match your filters,” with relevant clear/create/view-all actions.
- **Corkboard:** Saved Clubs sits in the page header. Empty boards use a compact state instead of a large decorative cork surface; populated flyer boards retain their existing appearance. Search has sufficient width on mobile.

## Functionality preserved and one reliability fix

Existing task actions and server authorization are reused. Creation, recipient preview, member/year/group selection, deterministic random assignment, deadlines, submissions, reviews, projects, bulk updates, and existing revisions/data continue through the original task engine. Autosaving a response still cannot submit it or issue an assignment.

Browser testing exposed an existing submission bug: `FormData` was constructed from the React event's `currentTarget` after awaiting the draft flush. The handler now captures the form data before that asynchronous boundary. The browser test confirms the exact entered response is persisted only after Submit work.

## Verification

| Check | Result |
| --- | --- |
| Full `npm test` | 1,143 passed; 24 environment-dependent tests skipped; zero failures (1,167 total) |
| Final focused Tasks, events, authorship, header, and discovery regressions | 67 passed; zero failures |
| Real-component browser journey | Passed on desktop and mobile; zero page errors |
| `npm run lint` | Zero errors; 28 existing warnings |
| `npm run typecheck` | Passed |
| `npm run build` | Passed, including static page generation and route tracing |
| `git diff --check` | Passed |

The browser journey uses the real React shell, Tasks, assignment builder, audience controls, review workspace, Explore, Corkboard, shared provider, Radix controls, and compiled product CSS. A disposable local HTTP adapter invokes the existing demo task engine. It checks:

- Compact summaries and first-task visibility; search and empty-state recovery.
- Private response editing does not submit; explicit submission stores the entered text.
- Member/year selectors, random preview, exact recipient review, and explicit assignment.
- Bulk deadline updates, review feedback/approval, bulk closing, and reloads of stored changes.
- Manager controls are absent from the personal-only view.
- Mobile navigation drawer, no horizontal page overflow, Saved Clubs Escape dismissal, and usable event search.
- No header clip art; existing logos and account imagery still render.

Screenshots were visually inspected at 1440×1000 and 390×844. Task before/after captures use the same fictional seed and existing components. They use the bundled Caslon display face and a local sans-serif fallback; the production DM Sans/Caslon configuration is unchanged. Browser testing does not use a real authenticated production account or exercise real file uploads, emails, or Supabase writes. Existing backend tests cover permission and persistence rules; environment-dependent checks remain skipped.

To reproduce current screenshots:

```sh
OUTCLASS_TASK_SCREENSHOTS=/tmp/outclass-phase3-visual node --test tests/task-cleanup-browser.test.cjs
```

## Screenshot comparison

[Open the screenshot gallery](visual-cleanup-phase3/index.html).

| View | Before | After |
| --- | --- | --- |
| My Tasks, desktop | [Before](visual-cleanup-phase3/tasks-before-desktop.png) | [After](visual-cleanup-phase3/tasks-after-desktop.png) |
| My Tasks, mobile | [Before](visual-cleanup-phase3/tasks-before-mobile.png) | [After](visual-cleanup-phase3/tasks-after-mobile.png) |

Additional captures: [Manage desktop](visual-cleanup-phase3/tasks-manage-after-desktop.png), [Manage mobile](visual-cleanup-phase3/tasks-manage-after-mobile.png), [caught up](visual-cleanup-phase3/tasks-caught-up-desktop.png), [filtered empty](visual-cleanup-phase3/tasks-filtered-empty-desktop.png), [no tasks created](visual-cleanup-phase3/tasks-manage-empty-desktop.png), [Explore desktop](visual-cleanup-phase3/explore-after-desktop-viewport.png), [Explore mobile](visual-cleanup-phase3/explore-after-mobile-viewport.png), [Corkboard desktop](visual-cleanup-phase3/corkboard-after-desktop.png), [Corkboard mobile](visual-cleanup-phase3/corkboard-after-mobile.png).

## Changed implementation files

| Area | Files |
| --- | --- |
| Shared shell and headers | `components/product/page-header.tsx`, `components/dashboard-layout.tsx`, `components/club-workspace.tsx`, `components/shell/product-shell.tsx`, `components/shell/authenticated-product.css`, `components/club-workspace-switcher.tsx`, `styles/product-components.css`, `styles/product-tokens.css` |
| Tasks | `components/club-tasks.tsx`, `components/tasks/task-manager-workspace.tsx`, `components/tasks.css`, `components/personal-clubs.tsx`, `app/club/[clubId]/tasks/page.tsx` |
| Student and interviewer pages | `components/views/explore-view.tsx`, `components/views/corkboard-view.tsx`, `components/views/student-dashboard-view.tsx`, `components/views/application-tracker-view.tsx`, `components/views/saved-clubs-view.tsx`, `components/views/unified-student-profile-view.tsx`, `components/views/interviewer-dashboard.tsx` |
| Corkboard controls and empty state | `components/events/public-event-board.tsx`, `components/events/events.css` |
| Platform editing and reference patterns | `components/admin/admin-clubs.tsx`, `components/product/design-patterns.tsx` |
| Artwork cleanup | `app/globals.css`, `lib/campus-illustrations.ts`, `styles/campus-illustrations.css`, `components/product/campus-illustration.tsx`; removed unused `components/product/campus-ribbon.tsx` |
| Tests and fixtures | `tests/task-cleanup-browser.test.cjs`, `tests/helpers/task-cleanup-browser-fixture.cjs`, `tests/helpers/browser-bundle.cjs`, `tests/task-workspace-ui.test.cjs`, `tests/tasks-workflow.test.cjs`, `tests/campus-illustrations.test.cjs` |
