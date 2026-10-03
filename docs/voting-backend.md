# Persisted recruitment voting (Prompt 34)

Prisma/PostgreSQL is authoritative. The production entry is **Recruitment voting** in the applicant workspace. The legacy PIN/member-pad routes and BroadcastChannel reducers remain isolated local previews; they never receive production applicants or determine published decisions.

## Data and lifecycle

`VotingSession` belongs to a club and recruitment round. It stores the advisory target, explicit auto-advance rule, ordered application/status snapshot, frozen participant roster, current pass, revision, lifecycle dates, creator and publisher. `VotingParticipant`, `VotingCandidate`, `VotingPass`, `VotingPassCandidate` and `VotingBallot` retain the complete history. The additive `20261003010000_durable_voting` migration changes no historical application statuses.

Create a draft from submitted applicants in one round. Start a pass to open voting. Pause/resume an open pass without changing ballots. Completing a pass closes it and asks leadership to choose another pass or finish. The default next pass includes Hold and Unresolved candidates; leadership can instead choose any nonempty subset of the original snapshot. An included candidate's latest pass determines their current outcome; excluded candidates retain their previous outcome. Prior passes remain available for review.

Finishing requires a completed pass and prevents further ballots. Leadership can reopen an unpublished completed session for review and additional passes. Published sessions are sealed; further review uses a new session. No target size automatically closes a pass, admits applicants, or ends a session.

## Ballots and outcome rules

Ballots are immutable: one participant/application/pass ballot, enforced by a unique index and a database update/delete rejection trigger. Corrective leadership overrides require a reason, preserve every ballot and record an AuditLog event. Ballot timestamps and override actor/timestamp are retained.

Decisions are **Pass**, **Hold / Fringe**, and **Do Not Pass**. With the default rule, all frozen participants must vote before a strict majority resolves the candidate; a completed split/tie becomes Hold. Incomplete ballots remain Unresolved. Closing an incomplete pass is explicit and preserves these unresolved candidates. Revoking membership blocks further participation but does not erase historical ballots or silently change the roster denominator; leadership can resolve the candidate with an audited override.

Optional rules are explicit: unanimous Pass, or a configured 51–100% Pass threshold of **all** frozen participants. Threshold advancement can occur before all ballots arrive, appears in the board, and emits `voting.candidate.auto-advanced` in the existing AuditLog. It changes only the vote outcome. Leadership can override it with a reason. Rules and participants are fixed after creation; the target can be edited until completion.

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

The board polls server actions every **5 seconds**, refreshes immediately after its own successful write, and reloads from persisted state after reopening or refresh. Candidate navigation/filter selection is local UI state; votes, history and counts are server state. There is no realtime service dependency. A device may display an old view for up to one polling interval; the server still validates every write. Failed reads clear the displayed session.

Publication requires a completed session and explicit candidate selection/confirmation. Pass maps to ACCEPTED, Hold to WAITLISTED, and Do Not Pass to REJECTED, matching existing final status semantics. Unresolved candidates cannot publish; unselected candidates keep their status. The entire publication fails if any selected application changed status or round since the session snapshot. No round advancement or email is implied. Each published candidate records the session, producing pass, prior status, outcome, final status and actor in AuditLog. The session records publisher/time, and candidate records retain published status. Ballots are never erased.

## Display, filtering and demo

The focused board reuses `ApplicantDisplayPanel` and round `applicantDisplay` configuration for profile, academics, experience, evaluations and Pros/Cons. The shared configuration now also supports résumé and LinkedIn links, withheld in anonymous mode. Filtering covers graduation year, current session round, latest outcome, current user's ballot state, and historical pass. Counts include total, processed, remaining/unresolved, Pass, Hold, Do Not Pass, target and graduation years. No gender field exists in the profile/display architecture; gender filtering/counts remain unavailable. No gender inference or demographic recommendations are implemented.

The existing Demo Mode boundary routes voting exclusively to a saved, isolated demo adapter. **Load sample two-pass voting session** provides deterministic Pass, Hold, Do Not Pass, incomplete follow-up voting and target progress using existing demo applicants. Refresh preserves the example; reset clears it. Demo Mode never invokes production voting actions and is not evidence of server durability.

## Validation and rollout

Tests exercise server authorization, immutable/replayed ballots, refreshed reads, preserved multi-pass Hold history, advisory targets, finish/reopen, explicit atomic publication, rule behavior, demo refresh/isolation and shared display privacy. PGlite executes the actual migration and verifies SQL constraints, foreign keys, immutable ballots and browser-role isolation. Action tests use a serialized transactional harness with rollback; they do not substitute for a production PostgreSQL deployment/two-device smoke test.

Deploy through the repository's existing Prisma-only migration path after the reconciliation checks in [database-deployment.md](database-deployment.md), then generate the client. Local implementation does not apply a remote migration. Validate two authenticated devices, capability revocation and publication conflicts in staging before rollout.
