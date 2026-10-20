# Collapsible interview dates

Your interview rooms reuses its authorized rows and existing Radix Collapsible components. Every local schedule date has a button heading, chevron and slot count. Dates and slots sort chronologically, independently of booking status. Cards, exact room links, adapters, permissions and backend actions are unchanged.

The first load opens today in the schedule timezone, or the nearest upcoming day when today has no slots. Past-only lists start collapsed. Multiple dates may be open; all may deliberately be closed. Selecting the existing date filter expands that date without discarding other choices.

Expanded date keys are stored in the existing list URL (`interviewDays`, including an explicit empty value). Existing exact-room/return helpers preserve that context. Background refreshes do not reset choices, and returning from a room or refreshing the page restores them. No applicant data or additional browser storage is introduced. A fresh list URL without these choices starts with the default date again.

Headers use native button keyboard activation, Radix expanded/control semantics, visible focus and a 44px minimum target. Closed panels are inert and aria-hidden even during the short closing transition, then unmounted. Height and chevron transitions respect reduced motion.

## Verification

- Unit tests: chronological dates/slots, deterministic ties, schedule-timezone today, missing today/nearest upcoming, past-only/empty lists and absent versus deliberately empty URL choices.
- Actual-component Chromium: multiple dates, keyboard activation, no accidental interview entry, hidden collapsed actions, background reads, refresh, exact-room return, specific-date filtering, all-collapsed restoration, desktop/mobile overflow/target size and reduced-motion animation behavior.
- Existing room-entry regression retains exact applicant/round/booking navigation and scheduling/configuration separation.
- Isolated desktop/mobile screenshots inspected. Fixtures remain fictional and loopback-only; no live database actions are used by those browser tests.

No migration, dependency, permission, database or infrastructure changes. Final lint/build, protected CI, merged revision and hosted Demo observations are recorded in the PR and private `OutClass-staging-verification/interview-date-sections-20261019/` release receipt. Physical touch and real-applicant production writes are not claimed.
