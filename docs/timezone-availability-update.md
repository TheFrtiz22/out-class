OutClass now uses `America/New_York` through the shared configuration in [scheduling-config.ts](../lib/scheduling-config.ts). Scheduling screens, applicant bookings, dashboard calendars, room filters, panel reviews, official assignments, notices and calendar links use Eastern Time. Timezone-changing controls were removed; useful labels are noninteractive “Eastern Time”. New room inputs normalize to the configured timezone. Intl-based conversion handles EST/EDT without a fixed offset, including new demo schedules.

Availability editors and interviewer heatmaps render 52 quarter-hour cells per day, from 8:00 AM through 8:45–9:00 PM, on all seven days. Desktop/mobile use the same slot list and keyboard bounds. Drag add/remove, touch editing, scroll, recurring schedules and date exceptions remain in the existing components. Copy, clear and recurring-reset operations preserve previously saved coverage outside the visible window.

Both authenticated availability save actions validate newly added coverage inside their existing revision-checked transactions. Full-day storage schemas and the interval-based eligibility/Auto-Fill engine remain intact. Previously saved hours outside the window continue to be valid. Older schedules in other IANA zones retain their native recurrence; the editor projects them into Eastern Time and applies edits as native date exceptions, without silently changing their recurring timezone. Existing booking/assignment timestamps remain authoritative; calendar exports retain their original UTC instants.

Verification completed on October 13, 2026:

| Check | Result |
| --- | --- |
| `npm test` | 1,057 passed, 0 failed; 15 optional environment-dependent tests skipped |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with 0 errors and 28 existing warnings |
| `npm run test:migrations` | Passed in isolated PGlite; fresh/legacy preservation checks across all 43 existing migrations |
| Next production builds | Passed in isolated local application copies |
| Availability browser suite | Passed: desktop drag/remove, keyboard, autosave, recurring/exception persistence, copy/reset, confirmation, mobile tap/drag/scroll, exact first/last cells, no overflow |
| Scheduling quality browser suite | Passed: authenticated reads, save recovery, heatmap/eligibility, buffers/conflicts/locks, Auto-Fill, immutable published state before approval, atomic publication/rollback, notifications, mobile schedules |
| Scheduling workflow browser suite | Passed: requests/reminders/responses, private proposal editing, publication/revisions, cross-club concurrency; applicant reservations unchanged on desktop/mobile |
| Source/UI control audit | No timezone-changing controls remain in application UI; availability and booking browser assertions confirm absence |
| `git diff --check` | Passed |

Browser tests used disposable local Supabase/PostgreSQL and fictional accounts, with desktop browsers in Los Angeles and mobile browsers in Tokyo. Applicant booking displays were checked against New York formatting and persisted records were compared before/after viewing. Unit/database regressions cover March/November DST, winter/summer demo timestamps, the exact 9 PM endpoint, full following buffers, rejection of new hidden selections, retention of hidden recurring/exception data, and original UTC calendar-invitation instants.

No production migration, deployment, or live-data rewrite was performed. No migration or Prisma schema files changed. The disposable local test environment was cleaned up after verification.

Files changed:

Scheduling policy and validation:

- [actions/availability.ts](../actions/availability.ts)
- [lib/availability.ts](../lib/availability.ts)
- [lib/interview-rooms.ts](../lib/interview-rooms.ts)
- [lib/interview-scheduling-context.ts](../lib/interview-scheduling-context.ts)
- [lib/scheduling-config.ts](../lib/scheduling-config.ts)
- [utils/panel-planning.ts](../utils/panel-planning.ts)

Availability editor and heatmaps:

- [components/availability/admin-overview.tsx](../components/availability/admin-overview.tsx)
- [components/availability/availability.css](../components/availability/availability.css)
- [components/availability/my-availability.tsx](../components/availability/my-availability.tsx)
- [components/availability/weekly-calendar.tsx](../components/availability/weekly-calendar.tsx)

Interview scheduling and booking UI:

- [components/interviews/booking-picker.tsx](../components/interviews/booking-picker.tsx)
- [components/interviews/create-room-dialog.tsx](../components/interviews/create-room-dialog.tsx)
- [components/interviews/my-panel-schedule.tsx](../components/interviews/my-panel-schedule.tsx)
- [components/interviews/panel-preview-workspace.tsx](../components/interviews/panel-preview-workspace.tsx)
- [components/interviews/panel-publication-history.tsx](../components/interviews/panel-publication-history.tsx)
- [components/interviews/room-manager.tsx](../components/interviews/room-manager.tsx)

Platform displays, calendars, notifications and demo:

- [components/applications/application-status-card.tsx](../components/applications/application-status-card.tsx)
- [components/demo-workspace.tsx](../components/demo-workspace.tsx)
- [components/views/calendar-view.tsx](../components/views/calendar-view.tsx)
- [components/views/inbox-view.tsx](../components/views/inbox-view.tsx)
- [components/views/interviewer-dashboard.tsx](../components/views/interviewer-dashboard.tsx)
- [components/views/leader-dashboard/live-applicant-views.tsx](../components/views/leader-dashboard/live-applicant-views.tsx)
- [components/views/leader-dashboard/live-leader-workspace.tsx](../components/views/leader-dashboard/live-leader-workspace.tsx)
- [components/views/student-dashboard-view.tsx](../components/views/student-dashboard-view.tsx)
- [lib/calendar.ts](../lib/calendar.ts)
- [lib/campus-events.ts](../lib/campus-events.ts)
- [lib/communications-client.ts](../lib/communications-client.ts)
- [lib/demo/seed.ts](../lib/demo/seed.ts)
- [lib/recruitment-presentation.ts](../lib/recruitment-presentation.ts)
- [lib/student-agenda.ts](../lib/student-agenda.ts)
- [lib/student-calendar-data.ts](../lib/student-calendar-data.ts)
- [utils/calendar.ts](../utils/calendar.ts)
- [utils/interview-assignment-notifications.ts](../utils/interview-assignment-notifications.ts)
- [utils/official-panel-schedule.ts](../utils/official-panel-schedule.ts)

Regression tests and browser fixtures:

- [tests/availability-browser.cjs](../tests/availability-browser.cjs)
- [tests/availability-collection.test.cjs](../tests/availability-collection.test.cjs)
- [tests/availability-database.test.cjs](../tests/availability-database.test.cjs)
- [tests/availability-scheduling-browser.cjs](../tests/availability-scheduling-browser.cjs)
- [tests/availability.test.cjs](../tests/availability.test.cjs)
- [tests/interview-rooms.test.cjs](../tests/interview-rooms.test.cjs)
- [tests/panel-publication-core.test.cjs](../tests/panel-publication-core.test.cjs)
- [tests/panel-publication-database.test.cjs](../tests/panel-publication-database.test.cjs)
- [tests/scheduling-quality-browser.cjs](../tests/scheduling-quality-browser.cjs)
- [tests/student-agenda.test.cjs](../tests/student-agenda.test.cjs)
- [tests/student-home.test.cjs](../tests/student-home.test.cjs)
- [tests/student-journey.test.cjs](../tests/student-journey.test.cjs)

This report is saved in [docs/timezone-availability-update.md](timezone-availability-update.md).
