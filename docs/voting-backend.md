# Real multi-device voting: required backend work (not implemented)

The existing BroadcastChannel demo is not an authentication boundary and must not receive real applicant data. Production board review currently records only explicit president-confirmed application decisions; it does not collect individual ballots.

A production ballot system needs:

1. **Persisted sessions and eligibility.** Store club, round, facilitator, ordered candidate snapshot, eligible voter membership IDs, quorum/majority policy, active candidate revision, and lifecycle state. Derive membership from authenticated accounts rather than entered email/PIN. PINs may locate a session but cannot authorize access.
2. **Durable, atomic ballots.** Enforce uniqueness for session/candidate/member, validate club and voter eligibility server-side, and bind every ballot to the active candidate revision. Define whether votes may change, handling of abstentions, ties, missing voters, and session closure. Preserve current strict-majority behavior unless the product explicitly changes it.
3. **Authenticated realtime delivery.** Authorized private subscriptions, reconnect snapshots, acknowledged commands, idempotency keys, and monotonically ordered revisions. Broadcast only necessary candidate information to authorized members. A client broadcast must never count as a persisted vote acknowledgement.
4. **Decision finalization and audit.** Separate a ballot outcome from an application decision. Require the authorized finalizer and an atomic version check before changing the application. Keep actor, timestamp, previous state, final state, and session/outcome audit references. Specify which outcomes mean round advancement versus final acceptance/rejection.
5. **Persisted round targets.** Add targets to a real round/cycle model if wanted; define whether they are advisory or enforceable. Do not promote the preview's browser-only quota into a production rule implicitly.
6. **Operational validation.** Test concurrent votes, duplicate/replayed requests, cross-club access, revoked memberships, facilitator disconnect, stale slides, closed sessions, competing finalizations, data retention, and recovery. Define notification delivery separately from saving a decision.

No new library is selected by this redesign. The eventual transport should fit the existing Supabase/Postgres deployment and enforce authorization at every read, write, and subscription boundary. Policy choices about voter eligibility, quorum, ties, ballot visibility, and decision release require product agreement before that backend is implemented.
