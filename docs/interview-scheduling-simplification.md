# Scheduling usability release

The manager now follows **Set interview times → Confirm interviewers → Publish
booking**. Existing configured rounds open their saved schedule; published and
paused rounds open bookings. Explicit URLs, round selection, back/forward and
refresh retain the selected context, including legacy scheduling section links.

The existing room form retains dates, location/meeting link, configured duration,
staffing requirement, buffers, capacity and optional panels. A room name initially
fills the location so it need not be typed twice; a customized location remains
independent. The redundant round selector is absent when the dialog is scoped to
one round. Demo now includes round configuration in the same DTO as live.

Assignments appear as compact day/room/time rows. One accessible side panel
contains add, replace, move, swap, lock/remove, session requirements, regeneration,
availability explanations and president override. Keyboard buttons remain
available alongside optional dragging. Advanced duty rules, revalidation,
discard, published history and recovery remain available on demand. An explicit
owner review/approval still separates proposed staffing from official access.

Booking publication appears only in its own step, with server-calculated
readiness and links to affected slots. Policies and pause are secondary; pausing
requires confirmation and retains reservations. Room closure also explains that
confirmed reservations keep their time/location. No unpublish capability was
invented: the existing service supports publish/resume, pause and policy changes.
Applicant eligibility, capacity, duplicates, notices, cancellation/rescheduling,
privacy and authorization remain in their existing services.

## Evidence

- Actual-component browser tests use loopback HTTP, the real isolated Demo store
  and adapters, and bundled application CSS. No hosted database/Auth/Storage is
  used. The unchanged team-availability component is mocked in this fixture.
- The ordinary one-room, one-day, fully available setup required **7 button
  actions before and 6 after**, excluding field entry. Both retain explicit
  interviewer approval and separate booking publication. The old room/location
  fields required duplicate entry; the new form initially fills location.
- The old comparison uses `b1cb3295d47a7cd17a4918b8e15a59e9f52e696b` and actual
  pre-change room, panel, form and publication components. It is opt-in to avoid
  requiring historical Git objects in shallow CI checkouts.
- Browser coverage: create times with saved round defaults, assign, approve,
  publish, eligible applicant reserve/reload, full state, issue-to-slot editor,
  president availability override, subsequent approval, pause, edits preserving
  exact reservations, existing published entry, loading failure versus empty,
  390px layout, keyboard activation and focus return. Demo live-action counter
  must remain zero. Physical touchscreen is not claimed.
- Focused SQL-backed tests: 11 passed using disposable PGlite fixtures, covering
  capacity, retries, office/owner checks, access revocation, approval/history and
  reservation preservation. Seven focused round/context/Demo checks passed.
- Repository lint: zero errors, 28 existing warnings. Final integrated type,
  build, CI, preview and live results are recorded in the release PR.

Run `node --test tests/scheduling-simplification-browser.test.cjs` for the current
flow. Set `OUTCLASS_SCHEDULING_SCREENSHOTS` to an artifact directory to save desktop
and phone captures. To compare the old path, also set
`OUTCLASS_SCHEDULING_BASELINE=b1cb3295d47a7cd17a4918b8e15a59e9f52e696b` and run
the test with `--test-name-pattern=comparison:`.

## Release and recovery

No schema or migration is needed. No production applicant mutation, credential
rotation, new vendor or infrastructure is involved. Required PR validation and
the existing Vercel Git preview must pass before merging; main's existing Git
integration produces production. Record the previous deployment as a compatible
application rollback, confirm the production alias matches the merged revision,
then verify the rendered scheduling workflow in isolated live Demo Mode. Hosted
real-account booking writes are not implied by Demo or disposable SQL checks.
