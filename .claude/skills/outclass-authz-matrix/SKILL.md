---
name: outclass-authz-matrix
description: Use for any change touching identity, club capabilities, applicant data, resumes, notes, ballots, Storage, admin impersonation, invitations, short links or cron routes, and for the pre-release cross-user and cross-school access review.
---

# OutClass authorization matrix

Answers one question per resource: can someone who should not see or change it do so by changing an ID, a URL, a session, or a school?

## Actors (create in disposable infrastructure only)
- Student A and student B, same school. Student C at a second school.
- Leader with full capability on club X. Member of club X without review capability. Leader of club Y.
- Suspended-club reviewer. Platform admin with and without session-bound elevation. Logged-out visitor. Expired session.

## Operations to cover for each resource
Read, list or search, create, edit, delete, download or Storage read, export, background job or cron side effect, notification or email content.

## Steps
1. Pick the resources the change touches (for example `Application`, `InterviewRecord`, `VotingBallot`, resume files, `MeetingCheckInToken`, `/q/[code]`).
2. For each resource × operation × actor, state the expected result: allow or deny, plus what a denial must not leak (existence, counts, names, timing).
3. Find the existing test in `tests/` that proves each cell. Add a missing cell as a test that runs on disposable Postgres (`scripts/run-disposable-postgres.cjs`) before changing code.
4. Check that the server derives scope from the validated session, never from a client-supplied club, school or user ID alone. Hidden UI controls are not authorization.
5. Run the targeted tests and `pnpm run test:migrations`.

## Output
A matrix appended to `docs/agent-ops/authz-matrix.md`: rows = actor, columns = operation, cells = allow, deny or untested, each with a test file reference. The count of `untested` cells is the release metric. It must reach 0 for P0 resources before pilot.

## Stop conditions
- Any cell where a denied actor gets data: stop all other work, write the reproduction as a failing test, and tell the owner. Do not hot-fix production.
