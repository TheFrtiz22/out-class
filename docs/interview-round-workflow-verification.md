# Recruitment round to interview setup

Baseline: 2ae68d4. Scope: connect saved PipelineRound IDs to existing interview setup, live and isolated Demo. No schema or migration change.

Confirmed disconnects:
- Demo pipeline editing was disabled instead of using an isolated adapter.
- Settings-only interview setup deliberately omits Scheduling. Its scheduling link dropped roundId, while generic setup links could request an unavailable scheduling tab in settings.
- Access setup ignored round context, room list lacked a round filter, and mounted setup loaders did not observe pipeline saves.
- Type/removal guards did not protect a kit-only round or booking publication without other interview history.

Changes: Demo pipeline read/save adapters retain stable IDs, optimistic pipelineVersion, configuration extensions and existing kit versions. New rounds initialize only the existing empty kit/version defaults. Live already uses Prisma defaults on PipelineRound; no additional configuration row, draft panel, room, time, assignment, publication or notification is created by choosing/saving Interview. Saved pipeline emits setup invalidation. Links carry the round into the actual scheduling route. Access and room filters retain that ID. Existing server authorization still controls every operation.

Compact status is a read-only projection: published and unpaused booking is Booking published; Ready to publish uses the canonical current booking coverage (including panel approval, eligibility, availability, buffers, conflicts and overrides); otherwise show the next missing setup item. Kit guidance does not add a new publication gate. Failed reads are explicit errors with retry. Publishing still runs all existing current server checks.

Duration: RoomManager already passes only its selected round into CreateRoomDialog. A new room reads that round's duration; adding dates to an existing room retains its explicit duration. No existing room or reservation is rewritten by pipeline saves.

Validation completed before release:
- 34 focused domain/action regressions passed: save/discovery/kit IDs, full synthetic new-round → approved panel → published booking → eligible applicant booking → exact authorized room entry; unchanged rounds/history, repeated save/reload, no duplicate initialization; type protection for kit-only/published/history rounds; scoped status/denied/unavailable reads; existing overrides and booking/privacy tests. Zero live calls in Demo adapter tests.
- Rendered browser regression: new Interview round saved with25 minute default; immediate Setup needed and exact round link; saved question/answer key survives reload; scheduling/access/room filters select the same ID; new scheduling dialog inherits25 minutes; desktop1280 and mobile390 no horizontal overflow. Existing exact-room entry/back/refresh browser regression retained with explicit all-round reset before switching rounds.
- Browser fixtures use actual React components and isolated Demo adapters through a loopback server; durable editor-draft persistence hook and unrelated review settings are mocked only there. Actual kit autosave is exercised. Domain tests cover the real Demo snapshot persistence, authorization and publication flow. No hosted Auth/Storage or real-applicant writes claimed.
- Local lint: zero errors,26 existing warnings. Type/build and protected final CI results recorded in private release receipt when complete.

Production: existing automatic main/Vercel pipeline, protected PR merge, compatible application rollback to the prior deployment. No database change, credential rotation or maintenance needed. Physical touchscreen not tested. Hosted verification and exact deployed revision must be recorded before calling release live.
