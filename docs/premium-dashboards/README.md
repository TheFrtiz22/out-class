# Premium dashboard design

Recruiting and Club now share OutClass's foundations while expressing different jobs. This is a presentation refinement of the operational dashboards merged in `f7a79b5`; the existing data sources, authorization, mutations, navigation and domain components remain authoritative.

## Design audit and direction

The baseline was rendered before application UI edits using real verified local accounts, PostgreSQL, server actions and a production Next server. Both dashboards were captured at 1440, 1280, 1024, 768 and 390 pixels. The baseline's authenticated dashboard scenario passed.

| Baseline finding | Design response |
| --- | --- |
| Both overviews used the same headings, separators and rows | Recruiting uses a dense operations console; Club uses a warm personal header and an editorial calendar |
| Independent pipeline cards gave each count the same weight | One connected, horizontally scrollable configured-round selector with a stable selected edge, sequence labels and compact counts |
| Review records competed with explanatory copy | Stronger queue surface, compact numbered records, clear action alignment and shorter eligibility copy |
| Club officer work and personal work appeared interchangeable | Personal assignments first; an explicitly labeled officer desk and separate aggregate team pulse |
| Meetings appeared as ordinary stacked text far down mobile pages | Date objects, clear time/location, explicit event RSVP affordance and meetings immediately after personal work in DOM order |
| The applicant evaluation was below the fold beside a mostly empty anonymous résumé column | Existing evidence and existing evaluation/decision controls share a desktop split; mobile keeps the same reading order |
| Loading was a line of text | Shared accessible skeleton foundation with different Recruiting pipeline / Club calendar silhouettes |

## Two personalities, one identity

**Recruiting — precision, momentum, control.** Sans-led operational typography, a connected configured-round pipeline, a white review console with a navy rule, compact record numbers, a muted blue interview/milestone rail and restrained booking-blocker accents. Bookings remain unvalidated until the canonical preparation read completes. Pending review volume never becomes an invented urgent deadline. Intake, cycles and the actual deadline are retained; no global recruitment phase or trend is fabricated.

**Club — community, clarity, progress.** The existing Caslon display voice and warm surface introduce the personal day. Task markers and due dates provide a quiet organizational structure. Meetings get editorial month/day treatments, full accessible timestamps, location, agenda and event-specific RSVP entry. The officer desk separates submission review from personal assignments; the team pulse uses compact, factual aggregates. Recipient-scoped announcements form a lightweight activity stream. Missing activity collapses to short, actionable empty states.

Both use the same Source Sans 3 / Libre Caslon Text fonts, semantic color tokens, Phosphor icons, small/medium radius tokens, button/input primitives, floating navigation shell and workspace switcher. No dependencies, database migrations or API requests were added for the redesign. No artwork or remote interface icons were introduced.

## Real operational surfaces

- Applicant review: existing profile, anonymous projection, résumé, evaluation autosave/finalization, next review and recruitment controls; only composition and styling changed.
- Interview preparation: a compact context block and canonical panel-validation surface; existing approval, staffing, availability, assignment and entry checks remain unchanged.
- Voting: the same exact-session navigation and voting board; session metrics use a definition list and the Recruiting console's navy edge. Projector fit, polling, ballots and publication behavior are unchanged.
- Tasks: the existing task detail and submission-review components, resources, feedback and actions are reused inside the shared drawer. Success styling appears only after the existing server-confirmed response.
- Meetings and event RSVP: the existing authorized detail/edit/attendance component and public registration controls remain in place. Ordinary member meetings still have no invented RSVP action.
- Announcements: the same recipient-scoped content opens in the shared drawer.

Controls retain native button semantics, keyboard activation, visible focus, dialog containment, Escape behavior, draft flushing and focus restoration. Hover/selection transitions are 140ms; drawers use 220ms motion and confirmed feedback uses a brief 200ms fade. Reduced-motion preferences disable these effects, including skeleton pulsing. There are no delayed content entrances or added polling timers.

## Screenshot-driven refinement

1. **Baseline:** [Recruiting desktop](evidence/before/recruiting-1440.png), [Club desktop](evidence/before/club-1440.png), [Recruiting mobile](evidence/before/recruiting-390.png), [Club mobile](evidence/before/club-390.png).
2. **First render:** [Recruiting](evidence/pass-1/recruiting-1440.png), [Club](evidence/pass-1/club-1440.png), [applicant drawer](evidence/pass-1/applicant-drawer-1440.png). Screenshot review found a calendar grid creating excessive space before the officer queue and evaluation controls hidden below the fold.
3. **Second refinement:** [Club](evidence/pass-2/club-1440.png), [applicant drawer](evidence/pass-2/applicant-drawer-1440.png), [ordinary member mobile](evidence/pass-2/member-home-390.png). Fixed intrinsic grid rows and moved existing review controls beside evidence. Retained every workflow control and permission message.
4. **Final verification render:** tightened voting session metrics and checked the final surfaces, state treatments and five-width composition. [Voting session](evidence/after/voting-session.png), [submission review](evidence/after/submission-review.png), [interview preparation](evidence/after/interview-preparation.png), [mobile task](evidence/after/task-drawer-390.png), [meeting](evidence/after/meeting-detail-390.png), [RSVP confirmation](evidence/after/rsvp-confirmed-390.png), [announcement](evidence/after/announcement-390.png), [empty](evidence/after/empty-recruiting.png), [loading Recruiting](evidence/after/loading-recruiting.png), [loading Club](evidence/after/loading-club.png), [failure/retry](evidence/after/overview-error.png).

| Width | Recruiting before / after | Club before / after |
| --- | --- | --- |
| 1440 | [before](evidence/before/recruiting-1440.png) / [after](evidence/after/recruiting-1440.png) | [before](evidence/before/club-1440.png) / [after](evidence/after/club-1440.png) |
| 1280 | [before](evidence/before/recruiting-1280.png) / [after](evidence/after/recruiting-1280.png) | [before](evidence/before/club-1280.png) / [after](evidence/after/club-1280.png) |
| 1024 | [before](evidence/before/recruiting-1024.png) / [after](evidence/after/recruiting-1024.png) | [before](evidence/before/club-1024.png) / [after](evidence/after/club-1024.png) |
| 768 | [before](evidence/before/recruiting-768.png) / [after](evidence/after/recruiting-768.png) | [before](evidence/before/club-768.png) / [after](evidence/after/club-768.png) |
| 390 | [before](evidence/before/recruiting-390.png) / [after](evidence/after/recruiting-390.png) | [before](evidence/before/club-390.png) / [after](evidence/after/club-390.png) |

All screenshots show actual application components and a disposable local test dataset. They do not represent production account data. Full-page captures include the existing fixed navigation at the capture viewport; ordinary scrolling keeps content reachable above the bottom inset. Baseline and final fixtures have equivalent operational states but independently generated IDs and timestamps. The setup checklist and tutorial launcher remain existing shell features.

## Verification

Final local checks (October 23, 2026):

- Full regression suite: 1,353 tests, 1,317 passed, 36 environment-gated skips, zero failures. The real dashboard integration scenario ran separately and passed without skips.
- Existing accessibility suite: 27 passed, zero failures.
- TypeScript and production build passed. ESLint: zero errors, 22 existing hook warnings.
- Both dashboards and applicant drawers passed WCAG AA / overflow checks at 1440, 1280, 1024, 768 and 390px.
- React review confirmed that hooks, lazy workflow loading, mutation callbacks, guards, focus restoration and existing form primitives are retained. The new presentation helpers add no effects or network access.


The production build and real authenticated dashboard scenario passed after the final UI changes. The scenario covers owner/member/reviewer/assigned-reviewer access, anonymous masking, outsider and revoked-member denial, round selection, exact voting-session entry, evaluation/finalize/next, task submit and approval, pending-offer preview/rescind, recipient-only updates, meeting details, RSVP, slow reads, initial skeletons, failure/retry, and concurrent task/evaluation/decision writes. PostgreSQL assertions confirm saved results.

WCAG AA scans and overflow checks cover both overviews and applicant drawers at all five widths; the ordinary member homepage is also scanned. Keyboard round selection and both motion preferences are asserted. The [verification receipt](evidence/after/verification.json) records the executed scenario and local response samples; these are not production performance claims.

Run `npm run test:dashboards:e2e` to rebuild and verify using the reserved disposable project. If another local fixture owns the default 593xx ports, use `OUTCLASS_DASHBOARD_E2E_PORT_PREFIX=613 npm run test:dashboards:e2e`. The helper validates the dedicated project ID, loopback URLs and matching port range. The application remains on port 3115; existing stacks are not stopped. The ordinary test run still requires no historical Git objects.

The existing design-preview fixture contract is exercised through both actual overview components, and demo regression coverage remains in the full suite. No production schema, authorization or mutation changes were necessary.
