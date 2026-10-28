# Live voting room — Part 1 handoff

Implementation branch: `codex/live-voting-foundation`, based on main `78402ee`. Part 1 is local implementation only: no merge, deployment, remote database connection, production migration or applicant mutation. Existing historical voting sessions are preserved.

## Agreed contract and routine decisions

- One club, existing recruitment cycle and stable pipeline round per session. Candidate order is the explicitly selected order, not display-name matching. Initial candidates must have a submitted/reviewable application in that exact scope. A changed application context prevents further votes/confirmation for it.
- Public choices are **Accept, Hold, Reject**. Stored values reuse existing `PASS`, `HOLD`, `NOT_PASS`; no second decision system or new membership roles.
- Voting is explicitly opened and closed for one applicant/pass instance. Voters may replace their own choice until closure. Even leaders cannot vote for a different applicant or pass. Votes never automatically confirm an outcome.
- The leader explicitly confirms the outcome after closure. The existing all-roster majority calculation is a recommendation only. A different outcome, including resolving an incomplete ballot, requires a reason. The frozen roster denominator does not silently change when a voter is revoked.
- Accept/Reject leave the review queue; Hold and Unreviewed remain eligible for the next pass. An unfinished revisit preserves the previous confirmed Hold. Previous instances and ballots remain intact. Target size is advisory; it never stops voting.
- Ending preserves unresolved candidates. **Finalization seals the session's confirmed outcomes**, separately from ending; it does not change `Application.status`, create membership offers, publish letters or send notifications. A later, deliberate recruitment-decision/communications workflow is separate. Part 4 must not wire session finalization to the existing notification-producing publication helper automatically.
- Eligible voters and explicit session leader member IDs are persisted at creation. Part 1 does not allow a QR holder to enroll themselves or change this roster. Creation requires `applications.review`, `decisions.manage`, `decisions.start`; creator must be an explicit leader. Other leaders require current start permission; voters require current vote permission. Identified rounds require identification permission. Anonymous projection remains authoritative.
- End additionally requires `decisions.finish`; correction requires `decisions.manage`; finalization requires `decisions.publish` and `applicants.identify`. Owners use existing permission rules, not a newly invented office. `decisions.view` permits authorized observation/history, but never leader commands or someone else's individual ballot.
- Fields are selected at creation using the existing voting display schema. The established snapshot guard freezes them when started. Further setup-edit UX is not part of this foundation.

## Architecture and state machine

Extend `VotingSession`, `VotingParticipant`, `VotingCandidate`, `VotingPass`, `VotingPassCandidate` and `VotingBallot`. `mode=LEGACY` is the default for all historical rows. Only new `mode=LIVE` sessions use these commands. Existing legacy screens, Demo previews and immutable legacy ballots retain their previous semantics. Legacy session/ballot/join/publication paths cannot mutate or disclose LIVE room payloads. Scheduled decision selection also excludes LIVE sessions.

Session transitions:

| Command | Preconditions | Result |
|---|---|---|
| START | DRAFT | First pass, first candidate selected; voting still PENDING |
| OPEN_VOTING | OPEN session, PENDING current instance | Instance OPEN |
| CLOSE_VOTING | OPEN current instance | Instance CLOSED; totals may be projected |
| CONFIRM | CLOSED current instance | CONFIRMED outcome and actor/time |
| ADVANCE | CONFIRMED current instance | Next pending candidate; after last candidate pass COMPLETED/session PAUSED |
| NEXT_PASS | PAUSED/completed pass | New instances for Hold/Unreviewed only |
| END | Unfinished session | Close any open ballot; session COMPLETED; unresolved candidates retained |
| CORRECT | Latest confirmed instance, unfinalized session, reason | Audited correction; ballots unchanged, older passes not rewritten |
| FINALIZE | COMPLETED session | finalizedAt set; read-only, no publication/notification |

Instance states: `PENDING → OPEN → CLOSED → CONFIRMED`. Reopening a closed ballot is not supported; a Hold revisit has a new pass number. Confirmation/corrections are provisional until finalization. No scattered client flags determine server transitions.

## Server API for Part 2

`actions/voting-room.ts`:

- `createLiveVotingRoom({clubId,sessionId,cycleId,roundId,leaderMemberIds,participantIds,applicationIds,targetSize,displayConfig})`: caller-generated UUID `sessionId` is the creation retry key. Exact retries return the existing ID; changed content/actor cannot reuse it.
- `listLiveVotingRooms({clubId,cycleId?,roundId?})`: authorized metadata only, newest first, bounded to 100. No applicant names, ballots, roster or totals.
- `getLiveVotingRoom({clubId,sessionId})`: authoritative state, permissions, selected display config, outcomes/remaining queue, per-pass instance history. Own ballot and revision are included; another member's choice is never returned. Open totals are **absent**, not CSS-hidden. Totals are returned only for CLOSED/CONFIRMED instances.
- `getLiveVotingPresentation({clubId,sessionId,applicationId})`: existing `getApplicantDisplay` projection with independent live-session, candidate, cycle and role authorization. Ordinary participants/observers may present only the current applicant; explicit leaders can preview the selected queue. Existing anonymity, selected-field, private-file and submitted-review restrictions remain in force. No private note projection was added.
- `castLiveVotingBallot({clubId,sessionId,requestId,applicationId,passNumber,choice,ballotRevision})`: `ballotRevision=null` for first vote; otherwise the last own ballot revision. One current row per voter/instance. CAS rejects stale competing edits; client cannot silently overwrite a newer vote.
- `commandLiveVotingRoom({clubId,sessionId,requestId,revision,action,applicationId?,passNumber?,choice?,reason?})`: use last observed session revision. `applicationId`/`passNumber` select only explicit corrections; ordinary navigation acts on the server current instance.

Ballot/leader mutations return `{ok:true,result}` or a safe `{ok:false,code,message}` for expected conflicts: `STALE_STATE`, `STALE_BALLOT`, `VOTING_CLOSED`, `APPLICANT_CHANGED`, `REASON_REQUIRED`, `CORRECTION_REQUIRED`, `EMPTY_QUEUE`, `END_REQUIRED`, `FINALIZED`. Authentication/authorization or unexpected failures reject; UI should show a safe retry/error state and keep input. Never display arbitrary exception internals.

Keep the same request UUID and exact payload when retrying a lost response. A receipt is checked only **after current authorization**. A replay of an earlier accepted vote acknowledges that request without replacing a later choice; refresh afterward. A new late vote is rejected even if its client was previously open. Distinct commands at the same revision cannot advance twice. Failed transactional work produces no receipt or partial vote/outcome/audit.

Submit the top-level `passNumber` and `currentApplicantId` from the latest snapshot. An outcome row's pass number identifies its confirmed source (a prior Hold may survive an unfinished revisit), not permission to vote in that historical pass.

## Coordination, privacy and restoration

Reuse existing voting's **five-second authorized polling**, not the local legacy BroadcastChannel preview or a public Supabase topic. This is bounded-latency coordination, not a WebSocket guarantee. Every poll rechecks active membership/account, capabilities and session roster/leadership. Read permissions are revalidated before returning. The club/session lock order and revision checks serialize writes and closure.

`hooks/use-live-voting-room.ts` and `lib/voting-room-subscription.ts` provide immediate initial fetch, non-overlapping polling, explicit refresh, online/focus reconnect and cancellation of late responses. Call refresh after successful commands. Failed reads clear sensitive state and show an error; old data is never retained as though authorized. Supply the actual current authenticated user ID so account/session/club switches hide the prior snapshot immediately. No ballot choices are broadcast. Pages are not implemented in Part 1.

Audit entries cover creation, cast/change metadata (no private choice), close, confirmation/override indication and reason, correction with previous confirmed outcome, advancement/passes, end and finalization. Existing append-only AuditLog remains canonical. Retry receipts store only a hash and minimal result, not private presentation/ballot content.

## Forward-only migration

Pending: `20261027220000_live_voting_foundation`.

- Adds mode, cycle FK, explicit leaders and finalization to existing sessions; legacy mode/default and all historical values remain unchanged.
- Adds explicit ballot-instance state/timestamps/confirmed outcome and ballot revision/update time.
- Adds server-only append-only `VotingRoomCommand` retry receipts.
- SQL-only guards: club/cycle/round/leader scope; candidate and roster scope/freeze; valid instance transitions; fixed ballot identity, monotonic revision and open-current-instance enforcement; legacy ballots remain immutable; finalized session/instance writes and receipt changes denied.
- New table enables RLS, denies PUBLIC/anon/authenticated CRUD with restrictive policy. Uses the established conditional ownership transfer to `outclass_production_app`; no browser grants or realtime publication. Migration role needs the established owner/DDL authority. Generated Prisma client is required.
- Additive columns do not rewrite applicant decisions. Existing legacy writers retain semantics. New application requires this migration before release; new LIVE writers must not run against the old schema. No schema reset, db push, fabricated ledger or archive replay.
- Validated only in disposable in-process PostgreSQL (PGlite): fresh and legacy full migration chains, preservation of prior ballot values, constraints/triggers and browser-role denial. No hosted or native multi-connection PostgreSQL rehearsal is claimed.

## Completed work and test evidence

Focused suite results are recorded after the final run below. Tests cover permission/scope denial, current-role revocation/disablement, canonical anonymous presentation, changed ballots, hidden open totals, duplicate/reused request keys, both vote/closure orderings, leader revision conflicts, pass isolation, Hold history, advisory target, end/finalization, rollback and reconnect restoration. Transaction action tests use a serialized rollback-capable harness; this is not a native two-device concurrency claim. SQL executes the actual new migration in a disposable database.

Full migration validation: all **58 migrations** apply on fresh and legacy databases; all **79 tables** enforce RLS and deny browser-role CRUD. Existing voting tests remain included. Type/lint/build results are appended after completion. No browser UI acceptance is claimed for screens that Part 2 has not built.

Final local verification, October 28, 2026:

- **44/44 focused checks pass**, zero skips/failures: new foundation/migration, legacy durable voting, join/board/display and decision-schedule tests. The display suite includes a privacy-change-between-lookups regression; reads reload canonical privacy under the authorization lock. A separate three-test retry/closure/leader replay run passes after typed receipt validation.
- Final migration regression passes after adding SQL history/roster deletion guards; full fresh/legacy migration validation passes again (58 migrations/79 private tables).
- Prisma schema validation and client generation pass. The schema-validation process uses a dummy local connection URI; no live environment file or production credential was loaded.
- Type checking passes; full repository lint exits zero with 21 existing warnings, zero errors. Targeted final lint passes.
- Final production build passes using a dummy local database URI and no Vercel production environment. This is a build check, not a hosted deployment or database-backed browser verification.
- No new dependencies, browser security changes, hosted test mutations, production migration, push, merge or deployment. Deliberate failure injection stays in rollback-capable test harnesses/disposable databases. The full unrelated platform suite was not repeated.

## Exactly what Part 2 should build

1. Setup/list/join routing for LIVE sessions using the APIs above. QR contains only a session link; authenticate and authorize every device. Do not reuse the legacy PIN identity or let QR scanning add eligibility. Keep old links working for LEGACY sessions.
2. Leader presentation with one authoritative current applicant and explicit Open/Close/Confirm/Advance controls; dedicated safe override/correction reason UI; member Accept/Hold/Reject composer using own ballot revisions. Use canonical display output, not raw applicant objects.
3. Pending/error/retry states with retained inputs and exact request-key reuse. On conflict refresh and require deliberate review/retry; never automatically apply a stale command to the next applicant. Keep totals unavailable until server projection includes them.
4. Integrate the polling hook, refresh/reconnect and account-switch cleanup. Display target as guidance and confirmed outcomes as provisional. Show held/unreviewed queue and pass history; session ending/finalization must remain explicit and separate from applicant communications.
5. Add the isolated Demo adapter for these new APIs before exposing LIVE controls in Demo. Existing Demo legacy fixture defaults were updated, but **no new LIVE Demo page/adapter exists yet**. Fictional IDs must never reach server actions.
6. Browser tests on disposable/staging accounts: multiple independent devices, revoked access, rapid vote changes/closure, lost responses, anonymous fields/files and mobile accessibility. Native PostgreSQL multi-connection lock rehearsal and staged Auth/Storage remain release prerequisites.

Parts 3–4 can then refine presentation/history and deliberate finalization/recruitment integration without duplicating these models. Any future notification-producing publication must be separately explicit; END/FINALIZE must stay notification-free.
