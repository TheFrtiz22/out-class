# Panel approval and publication — Phase 3

## Architecture decisions

The existing `InterviewRoom → InterviewSlot → InterviewBooking` remains the only schedule. Phase 2 proposals remain private working documents. Official per-session membership is stored on the existing slot, with an immutable publication/version reference. Room-wide legacy approval continues to govern slots which have not adopted a published session panel. Booking-managed `InterviewPanelAssignment` grants are reconciled through the existing sync helper; direct manual evidence grants and manual revocations retain their existing semantics.

An immutable version history records each explicit publication, predecessor, author/time, reviewed source, staffing override and meaningful changes. The round's monotonic publication counter identifies the active aggregate revision. Unaffected slots and their grants remain intact; version documents include unchanged prior scope for recovery and audit. Older history can seed a draft, but cannot be activated without current validation and a new confirmation.

Scheduling administrators with `interviews.manage` can generate and edit drafts. Publication retains OutClass's existing **owner-only panel-access approval** rule. A ready draft requires an owner-bound review token; generation, edits, saving and regeneration clear approval readiness. No transport request from those paths can publish.

Publication acquires a global scheduling advisory lock before reading at Read Committed isolation, then rechecks club authorization and locks candidate identities. This ensures a waiting cross-club publication sees the first publisher's committed schedule. Preview/review operations use Serializable transactions with bounded retries. Full current interval/buffer availability, confirmed participation, active eligibility and evidence permissions are mandatory. Other clubs' commitments are checked in batches. Only a successful transaction writes slots, active-version metadata, reconciled grants, audit records and idempotent notification/outbox intent. Provider sends remain the existing post-commit worker's responsibility.

Incomplete coverage requires an explicit recorded override. Hard conflicts cannot be overridden. A booked session must retain at least one qualified interviewer; a published session with no staff is excluded from applicant booking and rejected by the booking action. Applicant capacity remains unchanged. Published staffing changes happen in drafts, rather than live setting edits.

Notification changes are grouped per affected interviewer and publication with unique event keys. Unaffected people receive no schedule-change notice. Existing email preferences, outbox leases, retry window and provider idempotency are reused. Identifiable schedule details are resolved under current membership; drafts never enter inboxes, calendars or interviewer views. Existing calendars support links/downloads, not remotely managed invitations, so updates change the in-app official projection without inventing external invitation synchronization.

## Workflow and states

The existing Rooms & Booking interface opens Auto-Fill into the private proposal editor. Administrators can move, swap, add, remove, lock and unlock interviewers, change a session's staffing requirement, regenerate selected sessions or fill missing positions, and save an unfinished draft. Validation explains conflicts and missing coverage. Saving or editing always clears approval readiness.

Finalize Panels validates and opens an owner review containing club/round, room/session counts, required/filled/unfilled positions and assignment changes. Returning to editing retains the draft. Only **Confirm & Publish Panels** writes official assignments. A review token binds the owner, proposal revision and active publication base. Failed/stale approval retains both the draft and current official schedule.

`UNPUBLISHED` represents DRAFT. `READY_FOR_APPROVAL` is still private. An active immutable version represents PUBLISHED; an active version plus a draft represents PUBLISHED WITH PENDING CHANGES. Replaced history is marked SUPERSEDED. The interface displays these states without a second scheduling state machine.

Edit Panels creates a working revision of upcoming official sessions. The editor and confirmation show Currently Published versus Proposed Changes, including additions, cancellations, moves, time changes and staffing changes. The prior version stays authoritative while editing. Restoring history creates another private draft and requires current availability/conflict validation before publication.

## Changed file groups

| Area | Main files |
| --- | --- |
| Schema and additive migration | `prisma/schema.prisma`, `prisma/migrations/20261012190000_panel_schedule_publication/migration.sql` |
| Draft, review, publication and validation | `actions/panel-proposals.ts`, `actions/panel-publication.ts`, `lib/panel-proposals.ts`, `utils/panel-planning.ts`, `utils/panel-publication.ts` |
| Existing booking, room approval and evidence access integration | `actions/interview-rooms.ts`, `actions/interview-access-setup.ts`, `actions/organization-members.ts`, `actions/scheduling.ts`, `utils/interview-scheduling-access.ts`, `utils/official-panel-conflicts.ts`, `lib/interview-rooms.ts` |
| Scheduling UI | `components/interviews/panel-preview-workspace.tsx`, `components/interviews/panel-publication-history.tsx`, `components/interviews/room-manager.tsx`, `components/interview-access-setup.tsx`, `lib/demo/interview-access-setup.ts` |
| Own official schedule and calendar | `app/settings/interviews/page.tsx`, `components/interviews/my-panel-schedule.tsx`, `actions/official-panel-schedule.ts`, `utils/official-panel-schedule.ts`, `actions/applications.ts`, `lib/student-calendar-data.ts`, `lib/calendar.ts`, `lib/data.ts` |
| Existing inbox/email integration | `actions/communications.ts`, `utils/notification-delivery.ts`, `lib/notification-email.ts` |
| Verification | `tests/panel-publication-{core,database}.test.cjs`, `tests/helpers/panel-publication-fixture.cjs`, `tests/panel-publication-browser.cjs`, shared SQL harness, affected existing scheduling/server-boundary regression tests, `scripts/run-availability-e2e.cjs`, `package.json` |

## Database changes and query behavior

The additive migration introduces `InterviewPanelScheduleVersion` as audit/recovery history, extends the existing proposal with approval/base-version metadata, adds official panel member IDs/version to existing slots, and adds the round's monotonic publication counter. Existing rooms, slot capacities, bookings and manual interview-access records retain their identities.

History has unique approval tokens and `(roundId, clubId, version)` uniqueness. Composite round/club foreign keys prevent scope mixing. A GIN index supports interviewer slot membership lookups; version references and club/publication-time lookups are indexed. Triggers require a reviewed owner approval for official panel writes, preserve immutable version content, and enforce version progression. History is inaccessible to browser database roles and usable by the bounded server runtime role.

Legacy room-attestation edits revoke only legacy slot grants; they cannot revoke separately published session grants. Pausing a room, disabling the approving owner, or losing the approving owner's membership authority still revokes affected booking-managed access. Existing manual grant/revocation semantics remain independent.

The planner loads membership/participation, availability and commitments in batches and resolves intervals in memory. Publication preloads booked applicants and their grants once, groups identical slot writes, and bulk inserts new booking-managed grants/audits. Unchanged grants retain their IDs and grant timestamps. No calendar-cell database queries or provider calls occur in the publication transaction.

## Local verification

- Full suite (`node --test --test-concurrency=4 tests/*.test.cjs`, same files as `npm run test`): 1,032 passed, 15 skipped, zero failures (1,047 tests). Skips are existing environment-dependent native/provider checks; the dedicated publication runner separately exercises native PostgreSQL concurrency.
- `npm run test:migrations`: all 42 migrations applied to fresh and legacy fixtures; all 70 tables enforce RLS and deny browser-role CRUD.
- `npm run lint`: zero errors, 28 existing warnings.
- Prisma schema validation, TypeScript checking and the isolated production Next build pass. Changed-file lint and `git diff --check` also pass.
- `npm run test:panel-publication:e2e` uses a dedicated localhost Supabase project, real authenticated browser/server actions, native Prisma/PostgreSQL and an isolated production Next build. It never loads application `.env` files or sends provider email. The fixture is cleaned up after completion.

The database tests cover recurring/confirmed availability integration, private drafts, manual swaps, saved drafts, explicit atomic approval, idempotent retries, working revisions, affected-only notices, unchanged grants, immutable history, safe understaffing, zero-staff booking rejection, applicant rescheduling/cancellation, eligibility/permission loss, revoked approval authority and notification privacy. Calendar regressions cover the second repeated hour of the fall daylight-saving transition for both panels and existing applicant bookings; exports preserve exact stored UTC instants. Existing Phase 1/2 tests remain regression coverage for timezone/DST, global availability across clubs and proposal generation.

The browser runner exercises scenarios A–K: generate, swap, save/reopen, return from review, publish, reopen/edit, publish a replacement, inject a post-review conflict, race two owners, reject unauthorized/eligibility-lost approval, and verify unchanged applicant bookings. It also races pre-reviewed conflicting plans across two clubs (exactly one may publish), verifies interviewer-only official schedule output and real ICS downloads, and edits/discards on an iPhone-sized touch viewport with no page overflow.

## Release requirements and limits

No production migration, live panel publication, email send or deployment was performed. Follow the existing [database deployment procedure](database-deployment.md): inspect/reconcile installation history on a restored staging copy, review the new additive SQL, apply it using the migration role, regenerate Prisma Client, then deploy matching application code. Verify bounded runtime ownership/privileges and browser-role isolation in staging.

The existing optional email worker needs its normal `COMMUNICATIONS_EMAIL_ENABLED`, Resend, sender and canonical-site configuration. Delivery preferences still apply; outbox/history report queued, sent, suppressed, failed or uncertain status. Actual provider delivery and a physical mobile-device smoke test remain release checks. Locally, publication queues intent exactly once and native browser verification runs with provider sends disabled.

OutClass currently offers calendar downloads/links and in-app events, so there is no existing remote calendar-invitation update API to integrate. ICS downloads use stable session IDs; users' previously imported external events are not managed by OutClass. Scheduling-admin access does not grant private applicant identity permissions or owner publication authority.
