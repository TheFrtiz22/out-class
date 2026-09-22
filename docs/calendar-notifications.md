# Student Calendar and Notifications

Calendar now opens to an agenda grouped by local Today, Tomorrow, Next 7 days, and Later boundaries. Current events remain visible; past and declined events have explicit toggles. Search, event-type filters, club visibility controls, and the existing month/week/day views remain available. The month grid scrolls within its container on narrow screens rather than widening the page.

The existing event details, calendar export, map/online links, RSVP/cancellation, application/notification handoffs, and local interview scheduler remain connected. Persisted bookings/attendance stay read-only because the existing local actions cannot change server records. The scheduler entry appears when future local slots exist. No deadlines or bookings are fabricated.

Attendance data has no event-type field, so persisted attendance now uses the generic Other category instead of claiming every event is an interest meeting. Known interest meetings, deadlines, coffee chats, and interviews retain explicit labels. This is a frontend presentation category, not a database migration.

Notifications use a restrained list with an optional detail pane, clear unread states, responsive reading, and keyboard focus on opened updates. Existing read/unread, bulk operations, delete/undo, search, filters, sorting, event links, and persistence are preserved. Priority is derived only from structured urgent/interview/location-change metadata; the UI does not infer decisions from text. Club sorting groups updates under club headings. Other chronological sorts retain their ordering. New rows and read-state transitions respect reduced motion.

## Data boundaries

Calendar continues using the shared application's real booking/attendance data and existing locally managed events. Notifications continue using the existing application-state store. Browser preview state keeps its existing localStorage persistence; authenticated state is not silently moved into shared browser storage. No server notification table, delivery service, fabricated decision messages, or deadline alerts were introduced. Those require backend support. The redesign does not change persistence semantics.

## Files

- `components/views/calendar-view.tsx`: agenda-first presentation and existing calendar actions.
- `components/views/inbox-view.tsx`: notification list, reader, and grouping.
- `lib/student-agenda.ts`: local-date grouping and metadata-based notification priority/grouping.
- `lib/data.ts`, `lib/student-calendar-data.ts`: generic Other event category for untyped records.
- `tests/student-agenda.test.cjs`: grouping, past events, deadlines, and notification ordering regression checks.

## Validation

Full suite: 46 pass, four existing club-customization fixture failures. Type checking retains the two existing nullable-context errors in `lib/club-customization.tsx`. ESLint is unavailable. Production build succeeds. Browser checks use isolated local fixtures; no live records are modified. Actual Supabase operations remain dependent on configured services.
