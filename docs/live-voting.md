# Local voting preview

For the authenticated board-review workflow, see [voting-mode.md](voting-mode.md). Real multi-device infrastructure is separately scoped in [voting-backend.md](voting-backend.md).

In the local preview CRM, select **Voting preview**. The session snapshots the current
filtered applicant pool and its order. The setup modal validates a target range
and voting member count. Use **Preview voting pad** for an embedded demonstration
or **Open member tab** for the separate mobile layout at
`/vote/?session=<session-id>` (`/live-voting/` remains an alias). Setup now opens
a waiting room; applicant slides remain hidden until **Begin Voting**.

## Voting rules

- Each member can vote once per applicant; revisiting a slide retains its votes.
- A strict majority of the configured voting members decides Pass or No Pass.
  For five members, three matching votes are required. No-vote, incomplete, and
  tied applicants remain unresolved. The UI does not silently break ties.
- The first N roster members to join fill the configured N member places. Identity
  comes from the demo roster, so repeat joins and multiple tabs for the same email
  share one participant and one vote. A tab caches its demo member session in
  sessionStorage for automatic rejoin.
- Progress counts applicants with a Pass majority, not individual Pass votes.
  Remaining excludes both Pass and No Pass majorities. The quota is advisory:
  the bar clamps to 100%, while the actual count and Above target label continue
  to reflect excess passes.
- Navigation increments a slide revision, so a delayed vote for an old slide is
  rejected even if the proctor has since returned to that applicant.
- Ending a session rejects further votes. Results remain on screen until the
  proctor returns to CRM. Closing/reloading the proctor discards this simulation;
  it does not modify applicant stages or save decisions to a database.

## Components and data

`ProctorPresentationView` accepts an initial `VotingSession` and `onClose`.
`MemberVotingPad` accepts its `sessionId`; `embedded` selects the inline preview.
`LiveVotingLauncher` supplies setup, an immutable pool snapshot, and the fullscreen
presentation. `VotingLobby` displays the QR, short URL, six-digit PIN, and live
roster. `MobileJoinScreen` supplies UVA email/PIN entry and the waiting state. `lib/live-voting.ts` contains the independently tested reducer and
quota calculations. `lib/use-live-voting.ts` is the replaceable mock transport.

Applicants support optional headshots, resume highlights, and per-round scores.
The existing fixtures do not include headshots or applicant-specific round
grades; missing values show initials and explicit empty states. Existing CRM
cumulative scores are retained. Jordan's resume highlight comes from the existing
student experience fixture. The unrelated interview workspace's sample scores
are not attributed to other applicants.

## Simulation boundary

The proctor is the sole state writer. Member tabs send vote commands over
BroadcastChannel; the embedded pad uses same-document events. The proctor
broadcasts authoritative snapshots and a heartbeat. Members request a snapshot
on connection and poll for reconnect; they disable voting after a stale heartbeat.
No confirmation means no success state. Distinct sessions use distinct channels.

This transport connects tabs on the same origin in the same browser profile,
**not separate physical devices**. It is not an authentication or security boundary.
For deployment, replace it with a WebSocket service that authenticates club
members and the proctor, stores sessions and votes, checks active slide revisions,
enforces `(sessionId, applicantId, memberId)` uniqueness, and applies the same
majority rules atomically. Do not broadcast sensitive applicant data to clients
without authorized club access. Candidate IDs and member IDs must come from the
authenticated service rather than demo roster identities.

## Checks

Run `node --test tests/live-voting.test.cjs` for majority, ties, quota bounds,
duplicate/stale votes, membership capacity, navigation, and ended sessions.

## QR lobby and presence

- A random session UUID makes the QR URL unique. A six-digit random PIN supports
  `/vote/` fallback entry. A separate mock directory channel resolves a PIN only
  while its proctor is active. No match shows a retryable error; a PIN collision
  asks the user to use the exact QR URL rather than picking an arbitrary session.
- A manual join validates UVA email format, PIN, demo roster membership, session
  status, and capacity. The displayed Priya email is a sample account. This is
  **simulated admission, not email authentication**: neither a UVA address nor
  knowledge of a PIN proves identity.
- A previously admitted demo identity rejoins automatically, with the proctor
  checking club membership again. The existing signed-in student demo marker maps
  to Jordan's sample VVF membership. Never use those client markers in production.
- Each mounted pad has a distinct connection ID. Multiple tabs for a member count
  once. Presence heartbeats use proctor timestamps every two seconds. Page exit
  sends a leave; missing heartbeats expire after ten seconds. Offline members
  remain on the roster and retain their votes/places for reconnection.
- Begin Voting requires at least one currently connected member, enforced both in
  the UI and reducer. The configured voting-member count remains the electorate;
  beginning early does not silently reduce the required majority.
- Lobby votes are rejected. Beginning broadcasts the new live state and mobile
  pads show the first applicant automatically. Ended sessions reject new joins.

Production must replace demo sessions with verified sign-in and a server-side
club-membership lookup. Treat the PIN as a room locator, not an auth credential.
The mock snapshots include fixture data and must not be used for private production
records. Use authenticated, authorized, role-specific snapshots and a server-owned
PIN directory with expiry and collision handling for physical-device QR joining.
