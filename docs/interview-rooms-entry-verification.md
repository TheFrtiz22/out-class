# Assigned interview-room entry

Recruiting → Interviews defaults to **Interview rooms** for members with existing identified interviewer access. Other tabs retain their explicit URLs. The old generic entry section is removed. Tabs scroll horizontally on narrow screens. A secondary assigned-candidate queue remains inside Interview rooms for supported unscheduled assignments.

The list reads existing official panel schedules, bookings, current personal panel grants and this interviewer's records. Each booked link carries club, round, application, booking, room and slot IDs. Scheduling booking details and current assignment-notification projections reuse that destination. Unbooked slots do not open a candidate. Cancelled rows omit candidate data. Anonymous contexts receive an anonymous label; active identified interview entry remains subject to existing anonymity policy. Explicit leadership can open permitted anonymous completed reviews through the existing closing-review projection with identifying text withheld.

The exact-entry server action reauthorizes membership, club/round, grant, room approval, booking and current/historical eligibility. Stale/cancelled/replaced URLs fail closed; they never fall back to a recovered candidate. Refresh retains destination IDs. In-room revalidation on focus/every 15 seconds clears an unavailable room without reloading valid drafts. Existing actions remain the authority for notes, documents, annotations, shared questions and submission. No new timing gate is introduced.

Back returns to the originating interview tab and retained date/session filters. Next-applicant navigation keeps its existing authorization and keyed draft reset, updating the URL rather than retaining the previous booking IDs. Entry does not write a score or phase: new personal drafts remain active, and post-interview restores only from that personal record.

Demo uses isolated adapters and the same UI. An additive, idempotent fixture upgrade adds two explicitly fictional sample rounds, applicants, booked rooms and unbooked slots using the existing Demo graph. It does not change existing applicants, rounds, reviews, notes, reservations or denials. The legacy slot reference is retained for snapshot validation. Unchanged reads do not persist or notify.

## Verification

- Server/mock-transaction and Demo regressions cover exact IDs, simultaneous sessions in different rounds, cancelled/replaced bookings, revoked grants, cross-club/round denial, safe anonymous projection, unchanged read persistence, personal phase/draft restoration, immutable completion and notification destination equivalence.
- Real Chromium regression renders the actual tabs/list and room selection controller with synthetic Demo adapters. It verifies one-click destination, refresh, invalid-link denial, Back, independent room/round URLs, horizontal keyboard-accessible mobile tabs and no page overflow. Its child writing surface is mocked; existing dedicated interview browser regressions cover the actual question editors and persistence separately.
- Existing scheduling, room-layout/recovery, privacy/moderation and Demo persistence checks are retained and updated only for the new default tab, return destination or newly imported component/API.
- Screenshots and final type/lint/build, protected CI, merged revision, deployment and hosted synthetic results are recorded in the release PR and private `%LOCALAPPDATA%/OutClass-staging-verification/interview-entry-20261018/` receipt. Local screenshots are explicitly isolated synthetic previews, not real applicant data.

No schema/dependency changes or migrations. No production fixture writes. Physical touchscreen testing and production database-backed applicant writes are not claimed. Application rollback is compatible with the previous deployment; it needs no database reversal.
