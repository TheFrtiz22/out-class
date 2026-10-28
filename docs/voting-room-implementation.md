# Live voting room - Parts 1-2 handoff

## Current status - Part 2 (October 28, 2026)

Implemented locally on `codex/live-voting-foundation`, continuing Part 1 commit `9fc354d` (main base `78402ee`). No merge, push, deployment, hosted database connection or production test mutation was performed for Part 2. The Part 1 record below is historical; its `Part 2 should build` list is superseded by this section.

### Entry points and completed behavior

- Existing applicant decision controls now offer **Live voting room** to current authorized creators; **Voting history** preserves legacy functionality. New setup is `/voting/rooms/new?clubId={clubId}`.
- Setup reads active authoritative cycles/rounds, exact-scope eligible applications and current eligible club members. It offers permitted presentation fields, a positive optional target, and saved resume-highlight choices. **Prepare and preview** creates an idempotent persistent DRAFT; leaders preview its applicants before the separate **Start session** action. Prepared configuration is a snapshot; there is no post-start setup editor.
- `/voting/rooms/[sessionId]?clubId={clubId}&view=leader|present|member` shares one persistent room. The audience route contains no leader controls. Legacy `/voting/[sessionId]/join` routes remain unchanged.
- The QR contains only the current-origin session destination (club/session IDs and view, plus an explicit isolated Demo flag when appropriate). Normal `/login?next={sessionPath}` preserves it. Server-side join-info distinguishes denied, expired, ended, ready and joined; database/transport failures remain errors. Joining checks the preselected roster and current permissions; it never grants eligibility. Repeating check-in does not increment revision/audit again. Joined names are returned only to leaders.
- Leader controls separately start, open, close, confirm and advance; override/incomplete-ballot confirmation retains the existing reason requirement. Ending preserves unresolved candidates. Neither setup, joins nor these controls change recruitment decisions or notify applicants. Finalization/correction UI is deferred to Parts 3-4.
- Members see only their current choice, pending/saved/error state and safe exact-request retry. Changed choices use the latest own-ballot revision. A lost acknowledged response can be retried without overwriting a subsequent choice. Stale/closed context is never silently rebound to the next applicant. Inputs/buttons remain guarded by both synchronous client locks and existing server receipts/CAS.
- Every refresh/poll reauthorizes. Existing nonoverlapping five-second polling, focus/online reconnect, failure-state clearing and identity-keyed cleanup remain authoritative. Participation counts include only currently eligible voters; this is distinct from the frozen historical roster denominator used for outcome recommendations. No open choice totals or other members' individual ballots are sent to participants. Closed totals are supplied only after closure.

### Presentation privacy and layout

- Basic fields reuse canonical `getApplicantDisplay`/`projectApplicantDisplay`; anonymous rounds exclude name/photo/major and identifying resume/score extras. No private notes, file answers or raw applicant objects are introduced into the UI data contract.
- A resume excerpt is **an explicitly selected existing TEXT_HIGHLIGHT annotation ID** from a preserved document. Selection is validated against club/application scope and current source-round resume authorization. Reads recheck those same permissions for each viewer. Returned data is only annotation ID, document version ID, page and quote; never annotation comments, authors, general notes, a newly uploaded resume or generated achievements. Without the saved highlight or viewer access, the field reports unavailable.
- Cumulative interview score reuses `submittedScoreSummary`, the same finalized-review/leadership/own-submission gates as interview scores, stable round IDs, submitted-only evaluations and per-round reviewer deduplication. It is a review-count-weighted mean across the viewer's authorized identified interview rounds. Anonymous linked records are excluded. The UI labels authorized round/review counts and provides the exact scope in Details. Missing scores stay null/"Not scored"; historical values are not rounded to new-entry increments. A voting role alone grants no additional interview evidence access.
- Audience presentation uses a bounded two-row grid at normal laptop/projector sizes, restrained OutClass colors and typography, progress, participation, provisional accepted count and separate advisory target. Long text has a concise preview plus a full accessible Details dialog. It is not discarded or clipped. At narrow/zoom-equivalent sizes the layout reflows and can scroll. The phone ballot's own status and three large actions remain together in a sticky area. QR/Details dialogs restore focus on Escape/close; reduced-motion preferences are respected.

### Implementation map

- `actions/voting-room-setup.ts`: scoped setup, saved-highlight choices, generic join eligibility and idempotent check-in.
- `actions/voting-room.ts`: optional target/options persistence, role-safe participation/check-in projection and supplementary canonical presentation reads; existing ballot/command implementation retained.
- `utils/voting-room-presentation.ts`: authorized preserved quotes and canonical submitted-score aggregation. Unexpected database errors propagate rather than masquerading as withheld/empty data.
- `lib/voting-room-projection.ts`: the existing pure role/projection logic extracted from the server loader so isolated Demo can reuse it without bundling Prisma/Node crypto. Server callers retain the same checks.
- `lib/voting-room-api.ts`, `hooks/use-live-voting-room.ts`: real server action boundary plus explicit isolated Demo dispatch. Passing a Demo identity to a live request is rejected.
- `components/live-voting/room-{setup,view,presentation}.tsx`, `room.css`, `app/voting/rooms/...`: setup, check-in, leader/audience/member pages.
- `lib/demo/voting-room.ts`: persisted fictional LIVE sessions and receipts, same public projection/state rules, Web Locks serialization where available, no live action fallback. Demo has one explicitly labelled virtual recruitment cycle because the existing Demo graph has no cycle table. Other members require explicit existing vote permissions; no real membership grants are invented. Saved excerpts require existing isolated documents/annotations. Unchanged reads and rejected/replayed writes do not persist redundant snapshots. This adapter does not claim cross-device Demo synchronization: local storage is scoped to one browser profile; real rooms use the server.

### Forward-only Part 2 migration

Pending, **not applied to staging/production**: `20261028130000_live_voting_setup`, after `20261027220000_live_voting_foundation`.

- Adds `VotingSession.targetUnset` and `presentationOptions` with legacy-safe defaults. Nullable LIVE targets map to existing non-null `targetSize=1` plus `targetUnset=true`; projections expose null. Legacy targets remain untouched.
- Adds an object constraint, optional-target scope constraint and a trigger freezing new presentation settings once started/check-in opened.
- Replaces the Part 1 roster guard to allow only same-identity presence updates after start, while preserving frozen eligibility/club scope. Ended/finalized sessions remain frozen. This fixes the prerequisite that otherwise prevented a selected voter from checking in late.
- No new tables, browser grants, public realtime topic, RLS relaxation, data deletion or decision/status changes. Existing private-table RLS/grants remain in force. Generate Prisma client after migrating. Apply both pending migrations before deploying the new readers/writers; do not use reset, db push or fabricated ledger entries.

### Verification and limits

Final local results follow. Tests use disposable PGlite and loopback synthetic fixtures, never applicant production data. Two independent Chromium browser contexts exercise real room/setup actions through a serialized rollback-capable action harness; **Auth and the canonical base presentation are fixture boundaries**, not hosted Supabase claims. Supplementary excerpt/score authorization has separate actual-helper regression coverage. Browser screenshots use local fallback fonts.

- Focused server/Demo/legacy suites: **69 tests passed**, zero failures/skips. Includes scope/anonymous restrictions, optional target, exact QR Auth return path, late/idempotent joins, revoked access, open count-only projections, score scope/null handling, saved quote permissions, command/ballot retries and all retained Part 1 regressions.
- Rendered browser test: setup and all selected fields, persistent draft preview/start, member check-in/waiting, changing ballots, lost-response retry, reload, hidden open totals, closure, denied/revoked access, ended/expired states, unauthenticated return link, audience-only controls, long-text Details, QR focus return, 1280x720 fit and 390px phone/640px zoom-equivalent reflow. Independent local contexts are not independent Supabase-authenticated devices.
- Actual migration regression includes a negative control demonstrating that Part 1 rejected late presence updates, followed by Part 2 permitting check-in while still denying identity/roster changes and finalized writes. Full fresh/legacy chain: **59 migrations / 79 RLS-private tables**.
- Final type checking and production build pass. Full repository lint exits zero with 21 existing warnings and zero errors. The build uses a dummy local database URI with the production release gate unset; no credentials or local environment files were changed. The final isolated Demo regression also passes after eligibility/error-state refinements. No dependencies added. Physical QR scanning, physical touchscreen, actual browser zoom, hosted Auth sign-in/return, private Auth/Storage access and native multi-connection PostgreSQL concurrency remain **unverified**. Docker is unavailable on this workstation; no staging credentials or live accounts were repurposed for this local-only implementation.
- Local screenshots: `C:\Users\arden\AppData\Local\OutClass-staging-verification\voting-part2-local` (`presentation-desktop.png`, `leader-desktop.png`, `member-phone.png`). Run `node --test tests/voting-room-browser.test.cjs` with `VOTING_SCREENSHOT_DIR` to regenerate.

### Exactly what Parts 3-4 should do next

1. Build deliberate outcome/history/correction and finalization UX on the existing commands. Keep correction reasons/audits, immutable prior passes, provisional acceptance and notification-free End/Finalize intact. Do not reuse notification-producing legacy publication as automatic finalization.
2. Rehearse both pending migrations on disposable native PostgreSQL/staging; run distinct authenticated leader/member/outsider devices through setup, QR sign-in return, live vote changes, reconnect, simultaneous leader commands/closure and membership revocation. Verify private photo/excerpt gates using synthetic preserved documents and actual Auth/Storage. No production release is authorized by this part.
3. Run physical phone/QR/touch/projector and 200% browser-zoom acceptance. The local 640px layout check is reflow evidence, not a claim of physical hardware testing.
4. Preserve the current role-safe polling protocol and API receipts; improve transport only if separately justified. Do not duplicate the existing session/ballot models or broaden presentation permissions.

## Historical Part 1 record

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
