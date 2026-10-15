# Applicant interview booking and availability overrides

The existing room, panel proposal, publication, booking and interview-assignment flows remain authoritative. Booking publication is explicit, separate from panel publication and from opening a room. Its saved slot snapshots and recruitment-cycle selection prevent new or changed times from becoming bookable accidentally. Pausing blocks new reservations while retaining confirmed appointments and their interview access.

Only a currently authorized President can attest to unknown, unavailable or unconfirmed participation for one exact session. The server records the actor, time, conditions and optional reason. It does not edit personal availability. Membership, interview access, owner panel approval, capacity and official conflicts (including buffers) remain mandatory. Revoking an override blocks new bookings if coverage becomes insufficient; confirmed reservations are retained.

Applicants reach booking from their application detail, dashboard or publication notification. Reservation confirmation rechecks owner, club, cycle, round, publication snapshot, current panel coverage and conflicts under the existing shared scheduling lock and transaction. Slot locking serializes last-seat contention. Rescheduling cannot discard the original reservation when the replacement fails. Clubs explicitly choose cancellation and rescheduling policies. Existing SQL notification triggers remain the canonical confirmation path; retries do not create duplicate reservations or publication notices.

Demo uses the same UI with isolated local adapters, migration of older saved fixtures, private panel publication receipts, and no live action calls.

## Database change

Only `20261014230000_interview_self_booking` is new for production. It adds booking settings/snapshots and the private append-only availability-override table. It extends existing SQL publication/notification functions, with browser-role access denied and bounded runtime access retained. Existing migrations are unchanged.

Staging-only prerequisites explicitly authorized by the owner: `20261012171752_admin_session_bound_elevation`, `20261013002253_recipient_audiences`, `20261013005624_scheduled_communications`, `20261013014837_decision_letter_controls`, `20261013014950_recruitment_cycles`, `20261013015200_scheduled_decisions`, `20261013140024_scheduled_invitation_emails`, and `20261013141510_scheduled_availability_requests`. These were already applied to production. Staging's unrelated historical ledger gaps are outside this change and must not be replayed or falsely registered.

## Verification and release state

- Fresh and legacy disposable migration tests: all 52 migrations, 75 tables with RLS/browser CRUD denial.
- Focused existing SQL room/panel regression suite: 10 passed.
- New SQL-backed tests cover office checks, approval/publication/booking, retry notification deduplication, policy/pause/snapshot changes, revoked overrides and immutable audit history.
- New Demo tests cover the manager-to-applicant flow, saved-session recovery, repeated publication and zero live calls.
- Final integrated validation, native concurrency, hosted acceptance, recovery rehearsal and production promotion are pending. Do not treat this document as evidence that the feature is live.

Before production: validate the isolated preview, verify a fresh consistent backup through a disposable restore, inspect current production ledger/checksums, then apply only the new migration before merging the matching application through protected checks. Coordinate the existing Vercel Git pipeline. No database reset, archive replay or credential rotation is required.

The migration is additive. Before any new override-bearing panel documents exist, the prior application can be restored. After those documents exist, older strict parsers may reject their additional proof IDs: retain a compatible reader/writer build for recovery or block affected scheduling traffic and use a forward fix. Do not blindly reverse schema changes or restore over live data. Auth/Storage provider-wide recovery and physical touchscreen testing are distinct from local SQL and browser evidence.
