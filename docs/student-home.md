# Student Home

## Presentation

Home answers what is happening and what to do next: a contextual greeting, small counts, one next-action panel, application rows, a compact agenda, actual inbox updates, and a secondary discovery link. Mobile reading and keyboard order are applications → agenda → updates → discovery. There are no invented recommendations, completion percentages, or empty success claims.

`components/views/student-dashboard-view.tsx` composes the page and preserves existing application, event, notification, and discovery handoffs. `student-home.css` scopes its warm-white/navy presentation and reduced-motion-aware entrances. Existing buttons, status badges, club logos, skeletons, and the shared shell are retained.

`lib/student-home.ts` derives the ordered application list, active count, agenda, updates, and next action. The closest deadline/meeting within 48 hours takes priority; otherwise a draft, future event, or discovery is offered. The page displays at most five applications, four agenda entries, and three updates, with access to the full existing views.

## Data integration

- Home reads persisted applications from the existing auth response and server-loaded dashboard data. An empty real array never falls back to browser demo drafts. Server-loaded answers provide an actual saved-response count where available; no total or percentage is invented.
- `lib/student-calendar-data.ts` maps the interview bookings and attendance events already returned by `getStudentDashboardData`. It preserves times, locations, duration, and stable event IDs for both Home and Calendar. It accepts Date instances and serialized timestamps.
- `components/app-shell.tsx` passes existing server data and session context through. `lib/application-state.tsx` prevents the shared demo localStorage cache from replacing server state or collecting authenticated-session records. Preview-only local persistence continues to work. Unowned old browser demo state is not migrated into real accounts.
- Persisted calendar entries are read-only because existing RSVP/cancellation controls only mutate browser state. Calendar still provides details, application navigation, map links, and event export. Local/demo booking controls remain available for their original entries.
- Missing account/agenda data has an explicit retry state. Available-but-empty data has a quiet empty state.
- No server action, API, database schema, authentication flow, or dependency manifest was changed. Persisting remaining client-only recruitment operations and implementing personalized recommendations remain separate work.

## Validation

- Production build passes (the repository's build skips lint/type validation, so both were also attempted independently).
- TypeScript has three pre-existing diagnostics: a profile membership role mismatch and two nullable club-customization-context errors. Removed the unused invalid `scheduleLocations` import in the touched provider; no new diagnostics.
- Lint remains unavailable: the existing script invokes ESLint, but the dependency/configuration is absent.
- Node suite: 23 passing / 27 total, with the same four pre-existing club-customization failures. All six new tests pass: real-data precedence, decision sorting, agenda filtering, next-action priority, persisted booking conversion, and notification ordering.
- Chromium checks cover empty/populated views at 1440, 1024, 768, and 390px; application/event/inbox handoffs; keyboard navigation; reduced motion; and a real-account response remaining empty despite saved browser fixtures. Fixtures exist only in isolated test-browser storage, not in application defaults or the database.
- Live authenticated/database operations cannot be exercised without the actual Supabase/database environment. Local preview uses the existing nonproduction placeholder configuration.

Preview: `http://localhost:3000/preview` (empty unless that browser already has local preview state).
