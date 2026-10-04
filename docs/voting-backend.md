# Persisted recruitment voting (Prompt 34)

Prisma/PostgreSQL is authoritative. The production entry is **Recruitment voting** in the applicant workspace. The legacy PIN/member-pad routes and BroadcastChannel reducers remain isolated local previews; they never receive production applicants or determine published decisions.

## Data and lifecycle

`VotingSession` belongs to a club and recruitment round. It stores the advisory target, explicit auto-advance rule, ordered application/status snapshot, frozen participant roster, current pass, revision, lifecycle dates, creator and publisher. `VotingParticipant`, `VotingCandidate`, `VotingPass`, `VotingPassCandidate` and `VotingBallot` retain the complete history. The additive `20261003010000_durable_voting` migration changes no historical application statuses.

Create a draft from submitted applicants in one round. Start a pass to open voting. Pause/resume an open pass without changing ballots. Completing a pass closes it and asks leadership to choose another pass or finish. The default next pass includes Hold and Unresolved candidates; leadership can instead choose any nonempty subset of the original snapshot. An included candidate's latest pass determines their current outcome; excluded candidates retain their previous outcome. Prior passes remain available for review.

Finishing requires a completed pass and prevents further ballots. Leadership can reopen an unpublished completed session for review and additional passes. Published sessions are sealed; further review uses a new session. No target size automatically closes a pass, admits applicants, or ends a session.

## Ballots and outcome rules

Ballots are immutable: one participant/application/pass ballot, enforced by a unique index and a database update/delete rejection trigger. Corrective leadership overrides require a reason, preserve every ballot and record an AuditLog event. Ballot timestamps and override actor/timestamp are retained.

Decisions are **Pass**, **Hold / Fringe**, and **Do Not Pass**. With the default rule, all frozen participants must vote before a strict majority resolves the candidate; a completed split/tie becomes Hold. Incomplete ballots remain Unresolved. Closing an incomplete pass is explicit and preserves these unresolved candidates. Revoking membership blocks further participation but does not erase historical ballots or silently change the roster denominator; leadership can resolve the candidate with an audited override.

Optional rules are explicit: unanimous Pass, or a configured 51–100% Pass threshold of **all** frozen participants. Threshold advancement can occur before all ballots arrive, appears in the board, and emits `voting.candidate.auto-advanced` in the existing AuditLog. It changes only the vote outcome. Leadership can override it with a reason. Rules are fixed at creation. Eligible members may join the open lobby; the participant roster freezes when the first pass starts. Invited participants count toward outcomes whether or not they have checked in. Late check-in reuses invited records and never changes that denominator. The target can be edited until completion.

## Authorization

All reads require active membership and `applications.review`, plus `decisions.vote`, `decisions.view` or `decisions.manage`. Voters can read only sessions listing them as participants; viewers/managers can review club session history. Writes re-read and share-lock the current membership within the transaction.

- `decisions.vote`: immutable ballot submission, only for an explicitly listed participant in the current open pass of an open session.
- `decisions.view`: view club session history (requires review access).
- `decisions.start`: start/complete passes and pause/resume.
- `decisions.reopen`: reopen an unpublished completed session.
- `decisions.finish`: finish a session after the pass completes.
- `decisions.manage`: create/configure and audited overrides. Creation also validates every participant's review/vote capability and identification permission for non-anonymous rounds.
- `decisions.publish` plus `applicants.identify`: explicit publication. These capabilities are included in the manager permission template; existing memberships need explicit grants (owners retain all capabilities).

The Prompt 33 applicant-display panel independently enforces review and identification/anonymous restrictions on each fetch. Configured résumé links use the existing private download endpoint; inactive reviewer memberships cannot download. No PIN or entered identity authorizes a production action.

## Concurrency, refresh and publication

Conflicting session writes use a PostgreSQL row lock. Lifecycle commands require the revision last reviewed by leadership; ballots independently serialize on the session and increment its revision. Duplicate requests never overwrite a ballot. Transactions atomically create passes, save ballots/audit events, and publish decisions. Browser roles have no grants or RLS policies on the voting tables.

The board polls server actions every **5 seconds**, refreshes immediately after its own successful write, and reloads from persisted state after reopening or refresh. Active candidate navigation is persisted on VotingSession and serialized with other session writes. All member screens follow it on the next poll; stale ordinary-member ballots for a different candidate are rejected. Filters and historical review selection remain local UI state. Votes, history and counts remain server state. There is no realtime service dependency. A device may display an old view for up to one polling interval; the server still validates every write. Failed reads clear the displayed session.

Publication requires a completed session and explicit candidate selection/confirmation. Pass maps to ACCEPTED, Hold to WAITLISTED, and Do Not Pass to REJECTED, matching existing final status semantics. Unresolved candidates cannot publish; unselected candidates keep their status. The entire publication fails if any selected application changed status or round since the session snapshot. No round advancement or email is implied. Each published candidate records the session, producing pass, prior status, outcome, final status and actor in AuditLog. The session records publisher/time, and candidate records retain published status. Ballots are never erased.

## Display, filtering and demo

The focused board reuses `ApplicantDisplayPanel`. New sessions store a selected displayConfig snapshot; general round display settings no longer alter a running or historical voting presentation. Interview and applicant review retain their round configuration. Compact live fields include photo, name, major, graduation year, GPA, SAT, ACT composite, résumé, LinkedIn and application context. Other existing Applicant Display fields (experience, non-file answers, Pros/Cons and evaluation feedback) can be selected if the rendered preview fits. There are at most eight information cells; long values are not truncated. Résumé and structured experience cannot be selected together, preserving the shared display rule. The shared configuration now also supports résumé and LinkedIn links, withheld in anonymous mode. Filtering covers graduation year, current session round, latest outcome, current user's ballot state, and historical pass. Counts include total, processed, remaining/unresolved, Pass, Hold, Do Not Pass, target and graduation years. No gender field exists in the profile/display architecture; gender filtering/counts remain unavailable. No gender inference or demographic recommendations are implemented.

The existing Demo Mode boundary routes voting exclusively to a saved, isolated demo adapter. **Load sample two-pass voting session** provides deterministic Pass, Hold, Do Not Pass, incomplete follow-up voting and target progress using existing demo applicants. Refresh preserves the example; reset clears it. Demo Mode never invokes production voting actions and is not evidence of server durability.

## Validation and rollout

Tests exercise server authorization, immutable/replayed ballots, refreshed reads, preserved multi-pass Hold history, advisory targets, finish/reopen, explicit atomic publication, rule behavior, demo refresh/isolation and shared display privacy. PGlite executes the actual migration and verifies SQL constraints, foreign keys, immutable ballots and browser-role isolation. Action tests use a serialized transactional harness with rollback; they do not substitute for a production PostgreSQL deployment/two-device smoke test.

Deploy through the repository's existing Prisma-only migration path after the reconciliation checks in [database-deployment.md](database-deployment.md), then generate the client. Local implementation does not apply a remote migration. Validate two authenticated devices, capability revocation and publication conflicts in staging before rollout.

## Session setup, QR join and projector (Prompt 38)

Setup creates a DRAFT with candidate/participant selections and a shared display configuration. Leadership can edit it until **Open session for joining** sets joinOpenedAt. The UI requires saved changes and a fitting preview before opening. Display changes are locked once the lobby opens, including after finish/reopen; a database trigger also protects the snapshot. **Start pass** freezes the roster and persists the first activeApplicationId. Pausing, completing passes, finishing, reopening and publication retain their existing semantics. A reopened unpublished session allows existing roster members to check in, but cannot add voters to historical passes.

The QR uses the existing QrCodeCard/qrcode.react library and contains only `/voting/<random-UUID>/join`. No credentials, applicant information or results are encoded. The textual link is the accessible alternative. Unauthenticated users sign in through the existing safe return-path flow. Server checks require active same-club membership, applications.review and decisions.vote, plus applicants.identify for identified rounds. The composite VotingParticipant key prevents duplicate joins. JoinedAt records check-in separately from invitation; leadership sees appropriate member names and joined/invited state. Nonmembers, revoked capabilities, closed sessions and uninvited late arrivals are denied. Joining is transactional and audited.

Setup offers only the fields from the canonical Applicant Display contract, including existing structured review information; it never exposes Bio or ACT subsections. The projector uses the slide layout of the canonical ApplicantDisplayPanel/ApplicantSlide. Identity is above a two-row, four-column grid; controls and live counts stay in the desktop frame. The setup preview uses the same component and checks rendered height against the 1280×720 content budget, warning/blocking lobby opening if selected content is too large. A candidate-preview selector lets leadership review the pool. Slides never truncate values or add inner scrolling. Member pages use the same projection with a responsive two-column layout and may scroll vertically. Extremely long values can require fewer selected fields or a larger presentation viewport; the projector warns and disables its voting controls when its content budget is exceeded.

Migration 20261004000000 adds displayConfig, joinOpenedAt, activeApplicationId and VotingParticipant.joinedAt. Existing sessions did not have historical display snapshots: migration captures the **current** round configuration once; earlier historical settings cannot be reconstructed. Broad legacy snapshots remain available through the review layout, while projector mode requires a new, fitting session configuration. This preserves existing presentation fields instead of silently dropping them. It preserves every ballot/pass and backfills active candidates. The snapshot trigger also rejects active-candidate values outside the current pass. No hosted migration is performed during local development.

Demo QR links add `?demo=1` and cannot fall through to production. The isolated adapter supports sample-member selection, idempotent check-in, setup, snapshots, synchronized candidate selection, passes and publication; reset restores deterministic seeded state. A newly created Demo session exists only in that browser's isolated store; scanning it on a separate device does not synchronize Demo state. Production uses database polling across devices.

Local verification includes transactional action tests, actual PGlite migration execution, shared projection privacy tests, UI hook tests, deterministic Demo workflow/reset tests and Chrome layout fixtures at 1366×768, 1280×720 and 390×844. Browser fixtures use fictional data, the shared slide and existing QR library; they do not establish hosted authentication, QR scanning on a physical phone, or two-device PostgreSQL behavior.
