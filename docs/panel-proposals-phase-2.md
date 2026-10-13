# Panel proposals — Phase 2

## Architecture and audit

Production scheduling remains `PipelineRound → InterviewRoom → InterviewSlot → InterviewBooking`, with explicit owner-approved room panels and `InterviewPanelAssignment` granting interview access. Phase 1 removed the hard-coded panel-matrix prototype and provided a read-only eligible interviewer pool. There is no other production optimizer or compatible saved scheduling draft to reuse. Phase 2 extends that pool and the existing room manager with one deterministic proposal engine; it creates no rooms or parallel session model.

Room staffing requirements use `InterviewRoom.interviewersNeeded` (1–8, default 2). An optional `InterviewSlot.interviewersNeeded` overrides its room for a particular session. Staffing revisions prevent concurrent setting edits from overwriting one another. Applicant capacity remains a separate existing field. Changing requirements does not edit panels, approvals, bookings, room opening state, or notification intent.

`InterviewPanelProposal` stores an **UNPUBLISHED** document for an existing club/round: session snapshots, staffing requirements, proposed member IDs, source and lock flags, planning limits, source fingerprint, current validation, creator/modifier, timestamps and optimistic revision. There is one saved draft per round. No proposal relation is used by applicant booking, room access, interview calendars, panel grants or notification delivery.

Every proposal action authenticates and rechecks `interviews.manage` under the existing club serialization lock. Proposal transactions set a transaction-local unpublished flag. Database triggers then reject any write to official rooms, slots, bookings, panel assignments, notifications or email outbox/delivery records from that transaction. The proposal table itself only accepts UNPUBLISHED status. No finalization server action exists in Phase 2.

## Availability and commitments

The shared Phase 1 candidate loader resolves role defaults, membership/round overrides, active accounts, confirmed round participation and existing identified-review access. Availability uses the round's confirmed snapshot of global defaults and local-date exceptions, preserving Phase 1's explicit reconfirmation contract. Unknown/unconfirmed availability fails closed. Required availability includes the entire interview and its following room buffer.

Official commitments are read in batches across all clubs: approved room panels, active panel grants associated with booked interviews, and the interviewer's own applicant bookings. Only assignments to sessions covered by the replacement proposal may be ignored when considering future staffing; applicant bookings and commitments outside that window are never ignored. Other clubs' names, applicants and schedules are not exposed in the preview. Candidate details use a generic commitment-conflict reason.

## Planning and editing

The deterministic engine evaluates the complete requested window. It combines constrained-first planning with global branch-and-bound search, coverage bounds, workload balancing and continuity preferences. Locks and, for fill-missing, existing proposal positions are fixed. It maximizes valid coverage first and balances workloads before preferring panel/room continuity. A deterministic search budget bounds runtime; if reached, the best feasible plan is retained with a visible search-limit warning rather than an optimality claim. No LLM or random selection is used.

Optional consecutive-duty limits include buffers and existing commitments. A break of at least 15 minutes starts a new duty block. Overlaps follow the existing scheduler's maximum-room-buffer rule. Locked assignments which become invalid remain visible as conflicts until an administrator fixes or unlocks them; they are never silently replaced.

Manual edits are preview-validated against current eligibility, availability and commitments without persisting or granting access. Save Draft persists those edits with optimistic revision checks. Reopening refreshes validation and reports changed sessions/requirements/availability. Regenerate replaces unlocked proposals only; Fill Missing preserves current proposals. Discard deletes only the proposal. Finalize Panels is visibly disabled until Phase 3 adds explicit revalidation, approval and publication.

## Release boundary

Migration SQL is committed for review, with Prisma remaining the sole migration history. Apply it to staging through the existing reconciliation process and regenerate Prisma Client before release. Production migration, deployment, scheduling publication and notification delivery are outside this work.

## Changed files

- `prisma/schema.prisma`, `prisma/migrations/20261012160000_unpublished_panel_proposals/migration.sql`: additive room/session staffing fields, revisions, one private proposal table, scope/revision constraints, GIN membership lookup index, RLS/runtime ownership and unpublished transaction guards. Existing panels are not backfilled or replaced.
- `utils/interviewer-pool.ts`, `utils/panel-planning.ts`, `actions/availability.ts`: reuse the Phase 1 membership/participation boundary; batch existing sessions and cross-club commitments; resolve intervals in memory; strip private commitments from responses.
- `lib/panel-proposals.ts`, `actions/panel-proposals.ts`: deterministic full-window optimizer, indexed overlap checks, bounded search, validation, lock preservation, optimistic edits/save/discard, audit events and backend separation from publication.
- `components/interviews/room-manager.tsx`, `create-room-dialog.tsx`, `panel-preview-workspace.tsx`, `lib/interview-rooms.ts`, `lib/workspace-api.ts`, `lib/demo/interview-rooms.ts`: existing room configuration, per-session inheritance/overrides and the unpublished matrix with accessible editing alternatives, touch controls and navigation guards. Proposal generation uses real authenticated data; the demo directs users to a signed-in club workspace.
- `tests/panel-proposals*.cjs`, `tests/helpers/interview-sql-harness.cjs`, `scripts/run-availability-e2e.cjs`, `package.json`: pure scheduling, actual action/migrated SQL and real-browser/native Prisma acceptance coverage; `npm run test:panels:e2e` reuses the existing isolated availability runner.

## Verification

The pure scheduler tests include exhaustive comparison against all 512 three-member/three-session eligibility graphs, simultaneous differing requirements, scarcity, full buffers, duty limits, global lookahead, deterministic repeated generation, balance/continuity, invalid locks and bounded-search warnings. Migrated PostgreSQL/WASM tests execute the actual actions for permission/scope/revision boundaries, manual edits and provenance, confirmed exceptions and snapshot independence, cross-club commitments, safe save/reopen/discard, runtime ownership/browser isolation, and rollback of attempts to mutate official or notification tables.

The full suite passed locally: **1,020 tests passed**, **15 environment-dependent tests skipped**, and no failures. This includes **14 focused panel tests**, plus existing availability and scheduling regressions. Typecheck, Prisma validation/client generation, lint, migration-path checks, whitespace checks and an isolated production build passed. Lint retains 28 existing repository warnings and no errors; the new components have no warnings. Migration verification replayed all 41 migrations on fresh/legacy disposable databases and verified browser-role isolation across all 69 tables.

The real browser acceptance test passed on an isolated local Supabase Auth/Postgres stack and production Next build, using synthetic accounts and existing rooms, confirmed interviewers, a cross-club official commitment, an applicant booking and an existing approved panel grant. Clicking Auto-Fill yielded 5 of 6 positions covered across two simultaneous rooms, with visible insufficiency. The browser locked and removed positions, saved/reopened the draft, filled missing positions, regenerated unlocked positions, edited on an emulated mobile viewport and discarded the draft. Database snapshots of rooms, slots, bookings, actual panel grants, notifications, email outbox and delivery records stayed exactly equal throughout. Authenticated manager and applicant schedule API responses also stayed equal, and the local mail capture count did not increase. Finalize Panels remained disabled.

Run `npm run test:panels:e2e` with Docker and Chrome (macOS) or Playwright Chromium. It uses only the dedicated `outclass-availability-e2e` project on ports 57321/57322 and copied app on 3126, excludes application `.env` files, and cleans its own stack by default. A retained fixture can be removed with `npm run test:availability:e2e -- --cleanup`. Screenshots, acceptance JSON and logs are written to the OS temporary `outclass-availability-e2e` directory.

A local synthetic benchmark with 500 sessions, five simultaneous rooms, two required positions each and 40 confirmed candidates generated 1,000 positions in approximately 1.1 seconds. Constraint-heavy searches use a deterministic size-adjusted node budget and report when coverage optimality was not established. This is a local benchmark, not a production latency guarantee.

## Remaining integration

Review and apply the additive Prisma migration to staging through the repository's existing reconciliation/release checks, including the established server runtime's access to scheduling tables. No hosted migrations or deployments were performed. Phase 3 must revalidate current sessions, requirements, eligibility, confirmations, all-club conflicts and draft/source revisions inside explicit approval/publication transactions, then deliberately reconcile existing official grants and notification intent. It must not treat a saved or fully staffed draft as approval. Native mobile-device and hosted provider smoke checks remain release verification.
