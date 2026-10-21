# Club workspace refinements

The overview and recruiting overview omit duplicate action bars. Decisions no longer repeats the recruitment-review toolbar. The remaining Applicants review toolbar is above the view and filter controls.

Members supports reversible column sorting, with academic-year order rather than alphabetic year labels. Managers can filter the roster, select matching active members (up to 100 per batch), and add or remove a group without opening individual profiles. Group updates preserve roles, capabilities, cohorts, and other labels. Updates are atomic, version checked, club scoped, and audited.

Announcements and meeting invitations share shortcuts for everyone, Boys, Girls, years, roles, stored groups, and custom rules. Boys and Girls are explicitly assigned roster labels, with no inferred gender. Tasks use the same roster labels. Meeting invitations publish through the existing announcement system after recipient preview; meeting visibility remains governed by the existing meeting audience.

Applicants shows sortable GPA, SAT, ACT, rating, round, and status columns. Ratings use the server-authorized round summary, including the existing review visibility rules. Missing values sort last in either direction. Any table cell opens the wide side drawer, with the profile and scoped résumé preview alongside one another on desktop.

Kanban cards support dragging between allowed status lanes and an equivalent Move to selector. Moving into Closed requires an explicit accept/deny choice. Status writes retain expected-status checks and canonical reloads. Final outcomes cannot be silently reopened by dragging.

Quick review is gated by decision and identity permissions. It walks the current filtered queue, offers Skip, Accept & next, and Deny & next, and explicitly identifies immediate decision publication. Failed writes leave the candidate open. A failed refresh after a successful write clears retained applicant data and asks for a reload.

The overview uses four proportioned cards, including Club updates (or meeting resources when announcement management is unavailable). Setup introduction dismissal is remembered locally per club.

## Verification

- TypeScript check and production build passed.
- Targeted ESLint passed with zero errors; one pre-existing recruitment focus-effect dependency warning remains.
- 76 regression tests passed, including migrated PostgreSQL-compatible database constraints, atomic group updates, stale-version and audit-failure rollback, authority checks, quantitative sorting, and quick-review navigation.
- Browser regression passed using real React components and isolated synthetic API fixtures: sortable headings, table-cell profile entry, wide drawer and scoped PDF response, drag/drop with confirmation, quick accept/deny progression, year-filtered bulk groups, meeting audience selection and send payload, four-card proportions, persisted dismissal, and mobile overflow.
- No production applicant decisions, roster changes, or messages were created during verification.
