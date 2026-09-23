# Voting Mode: board review and local voting preview

## Real applicant workspace

The authenticated leader table has a Voting mode entry that snapshots the current filtered selection and order. It presents one authorized candidate at a time in a focused fullscreen dialog: photo/initials, identity and education, current round/status, actual bio/experience, résumé/LinkedIn links, and per-round average evaluations on the backend's 1–10 scale. Evaluation notes can be expanded for discussion. Missing data remains explicitly absent.

This is facilitated board review, not a multi-device ballot service. Presidents can confirm Accept or Not selected using the existing final status semantics (ACCEPTED/REJECTED). Recruitment leads can present and navigate but cannot issue decisions. The server still requires president membership in the candidate's club. Final decisions do not move pipeline rounds or send email.

Confirmation explicitly identifies the applicant, current status, and the student-visible effect. Candidate advancement happens only after server success. Failed saves keep the candidate and confirmation in place. The status mutation includes the status originally shown and conditions the update on it, club ownership, and the application ID; a stale status cannot overwrite a different current status. Other existing callers remain backward-compatible when expectedStatus is omitted. Close the presentation and refresh the applicant list to resolve a conflict.

Counts reflect actual accepted, rejected, and unresolved application records in the selected pool. There is no persisted round target, so none is invented. The original filtered table remains intact when the presentation closes. All real candidate data stays in the authenticated view and is never sent to the local BroadcastChannel demo.

## Existing local preview

The existing voting launcher, lobby, member pad, PIN/session routes, strict-majority rule, one-vote rule, stale-slide protection, and local quota calculation are preserved. Presentation and member-pad visuals now share restrained navy controls, warm backgrounds, editorial candidate typography, and a short opacity/transform transition disabled for reduced motion.

The entry is explicitly labeled Voting preview. `/vote` and `/live-voting` retain their routes. This transport synchronizes same-browser tabs and embedded views only. It has no authenticated multi-device transport or durable ballots. Preview quotas are user-entered local session settings; they do not represent saved club round targets. No preview vote mutates real application decisions.

## Changed files

- `components/live-voting/board-decision-mode.tsx`: authenticated focused review and confirmed decision workflow.
- `components/views/leader-dashboard/live-leader-workspace.tsx`: launch from the current filtered real applicant pool and synchronize confirmed statuses back to the table.
- `actions/crm.ts`: optional expected-status guard on existing president-only status updates.
- `lib/board-review.ts`: real status summary.
- `components/live-voting/voting-mode.css`: professional candidate transition with reduced-motion fallback.
- Existing launcher, proctor, member pad, and join page: visual refinements and clearer preview labeling; transport/reducer logic unchanged.
- `tests/board-review.test.cjs`, `tests/leader-isolation.test.cjs`: summary and stale-decision regression tests.

## Validation

Build passes. Full suite: 57 passing, four existing club-customization fixture failures. Existing voting reducer and isolation tests pass. Two existing nullable-context TypeScript errors remain in `lib/club-customization.tsx`; ESLint is unavailable.

Browser checks use isolated transport fixtures and cover desktop/tablet/mobile presentation, confirmation cancellation, failed-save retention, expected-status writes, advancement after success, progress counts, reduced motion, return to table, and presentation-only controls for non-presidents. No real applicant decisions are written by these tests. Live database integration remains unverified locally without configured services.

See [voting-backend.md](voting-backend.md) for the separate infrastructure work required for real ballots.
