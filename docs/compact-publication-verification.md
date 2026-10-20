# Compact scheduling publication status

The confirmation step uses one compact status summary. Booking labels use the round's actual booking publication/pause settings, separately from interviewer approval. A pending-change label compares the effective merged proposal with approved assignments/session details/duty rules; opening an unchanged revision, changing bookkeeping revisions or locking an assignment does not falsely imply a schedule change.

Review changes opens one comparison dialog without calling review/approval/publication actions. The existing explicit Confirm interviewers → approval-token review → Approve interviewers path remains canonical, including current validation, permissions, revision checks and failure recovery. The approval dialog links to the same comparison, using its server-reviewed change list. Existing staffing/stale/availability warnings remain beside the actions and issue links.

Publication history has its own quiet link and accessible dialog containing versions, approvers, times, notification counts, override reasons and historical assignment differences. Existing restore-as-draft controls and safeguards remain. The redundant Edit Panels control and duplicate official assignment table were removed; Edit interviewers and slot editing remain in the schedule. When a draft exists, a small schedule view switch exposes either its draft or the approved assignments, with approved rows read-only. Switching views does not write or discard edits. Validation redirects to the draft view when necessary.

Both dialogs restore keyboard focus to their originating control. They use existing responsive, scrollable dialog components. Live and Demo share the interface and actions. Demo's approval/history projections now calculate assignment differences with the existing comparison helper instead of returning empty arrays; historical stored records are retained.

## Verification

- Focused status regression: unpublished, awaiting initial approval, published without changes, unchanged revision, real pending changes, paused, partial-window merge, metadata/rule changes and bookkeeping-only changes.
- Actual scheduling components and isolated Demo adapters in Chrome: initial generation and approval, booking publication, nonmutating comparison/history, history versions and restoration guard, keyboard close/focus, unchanged revision, draft requirement/member edits, approved assignments remain unchanged, schedule view switching, separate approval/comparison, injected approval failure and retry, later history, pause, restricted approval UI, desktop/mobile overflow, zero live calls.
- Existing scheduling/date-section and panel core regressions pass (16 checks), preserving reservations, availability overrides, bulk scope, validation focus, permission/eligibility/conflict rules, publication history and notifications.
- Type checking passes; lint has zero errors and 26 existing warnings. Production build and final protected CI/release results are recorded in the PR and private release receipt.

No schema, migration, dependency or infrastructure changes. No real applicant/club writes for testing. Physical touchscreen testing and authenticated hosted role testing are not claimed; authorization/database checks run in existing isolated suites. Production verification uses browser-local synthetic Demo data.
