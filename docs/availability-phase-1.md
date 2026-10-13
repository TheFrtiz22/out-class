# Availability and interviewer eligibility — Phase 1

## Repository audit and decisions

- Prisma is the sole migration history (`docs/database-deployment.md`). Supabase supplies Auth and Storage; application reads and writes use authenticated server actions and the bounded Prisma runtime role. New private tables follow the existing RLS/revoked browser-grants pattern.
- `User` owns profiles and belongs to multiple clubs through `ClubMember`. Store one global availability document per **User**, independent of `StudentProfile` and club membership. A missing/unsubmitted schedule is unknown, never available.
- Membership has `accessRole`, legacy `role`, explicit capabilities, active status, and separate interview offices. Eligibility uses configurable **existing access roles**, a nullable membership override, then a nullable round override. It conveys no capabilities, interview offices, applicant evidence access, or admin rights.
- Production scheduling uses `PipelineRound → InterviewRoom → InterviewSlot → InterviewBooking` and explicit `InterviewPanelAssignment`/room approval. Reuse these for round selectors and staffing coverage. No new rooms, slots, bookings, or assignment model is introduced.
- `components/views/club-manager/interviewer-availability-view.tsx` and `interview-room-panel-matrix-view.tsx` were local-only prototypes. The latter's filler used hard-coded people and rooms. They have been removed and their entry route now opens the existing production interview management. Phase 1 supplies a read-only eligible/confirmed candidate pool; it neither runs a filler nor changes live panels.
- Existing interview participation/evidence authorization (`interviewCapabilities`, explicit panel grants, owner attestations) remains authoritative for interviewing. Scheduling eligibility and round participation are separate prerequisites for future staffing proposals.
- Extend `OrganizationMemberManagement` for role defaults, bulk/individual overrides, and round overrides. Extend `InterviewManagementTabs` for the admin overview. Link `/settings/availability` from the existing profile.
- Reuse existing typography, cards, buttons, focus styles, authentication, club transaction locks, and audit logs. Availability edits do not send mail or publish schedules. Existing `UserNotification` and notification email outbox are available for later opt-in reminders; Phase 1 needs no duplicate delivery infrastructure.

## Persistence and interpretation

`UserAvailability` contains a revisioned, compact JSON document: IANA timezone, seven Monday-first lists of merged half-open minute ranges, `weeklySubmitted`, and ISO local-date replacements. Each interval is aligned to 15 minutes. An exception replaces the entire local day; an empty exception means explicitly unavailable. Removing it restores recurrence. At most 400 exception days and 48 ranges/day are accepted.

`InterviewRoundParticipation` belongs to an existing club membership and round, with composite foreign keys ensuring both belong to its club. It stores a snapshot of the global document and private round-specific day replacements. Initial defaults come from the global schedule; members explicitly confirm their snapshot. Later global edits do not silently alter a confirmed round. “Use current global schedule” refreshes defaults and requires reconfirmation. Unconfirmed snapshots never count as confirmed staffing availability.

Dates refer to local days in the document timezone, not UTC dates. Recurrence follows local clock time through daylight saving changes. UTC intervals are checked for their **entire duration**, including day boundaries and DST. Both occurrences of a repeated wall time use the same declaration; nonexistent local times produce no interval. The overview marks ambiguous/nonexistent wall-time cells instead of guessing an instant.

Autosave is debounced and serialized, uses optimistic revisions, retains failed edits, and blocks departure with unsaved changes. Reads use bounded joined queries; all 672 cells resolve in memory. The overview returns only the selected week's eligible club members and this club's round state, never raw global documents or another club's participation data.

## Release and later phases

Migration SQL is committed for review only. Apply it to a disposable/staging database and regenerate Prisma Client before releasing these features. Production deployment remains subject to the existing migration/reconciliation and schema gate. No production migration, deployment, panel assignment, approval, booking, or scheduling publication is performed by this work.

The later panel filler must consume `getEligibleInterviewerPool` and check whole-session availability, conflicts, existing evidence permissions, panel approval, and staffing requirements before proposing assignments. Phase 1 adds coverage for existing room slots and a configurable headcount target; it does not infer final staffing needs from applicant capacity.

## Changed files

- `prisma/schema.prisma` and `prisma/migrations/20261012120000_global_availability/migration.sql`: two private tables, club role defaults/revision, membership override, composite scope foreign keys, interval/confirmation checks, indexes, RLS, browser grant revocation, and runtime ownership/execute grants.
- `lib/availability.ts`, `lib/availability-save-queue.ts`, `actions/availability.ts`: compact interval validation, date/timezone resolution, optimistic serialized saves with account binding, participation snapshots, audited eligibility changes, bounded overview projections and the read-only future filler boundary.
- `app/settings/availability/page.tsx`, `components/availability/*`, `components/views/unified-student-profile-view.tsx`: the personal page and profile links, pointer/touch/keyboard calendar, autosave/error/retry states, copy/clear/restore operations, timezone editing, round confirmations, heatmap and eligibility controls.
- `components/interview-management-tabs.tsx`, `components/organization-member-management.tsx`, `components/views/interview-scheduler-view.tsx`: integration with existing interview and member navigation. `components/club-members.tsx` keeps the old demo membership projection compatible with the additive field.
- `tests/availability.test.cjs`, `tests/availability-database.test.cjs`, `tests/availability-browser.cjs`, `scripts/run-availability-e2e.cjs`: unit, migrated PostgreSQL/WASM, runtime-grant and actual browser/server-action/Prisma tests. The shared SQL harness now supports availability relations and correctly parses Prisma UTC timestamps; existing UI harnesses stub the new overview and distinguish real form changes from eligibility scope selection.
- `package.json`, `pnpm-lock.yaml`: pinned Playwright dev dependency and the browser validation command.

## Local verification

`npm test` passed **1,006 tests**, with **15 environment-dependent tests skipped** and no failures. This includes 14 availability tests covering recurrence, day replacements and removal, explicit empty/unknown schedules, DST gaps/folds, cross-midnight intervals, fractional-offset and southern-hemisphere zones, cross-club isolation, authorization, bulk/round overrides, revocation, stale revisions, snapshot independence, serialized autosaves and exact preservation of existing panel grants/room approval. Existing scheduling regressions also passed.

`npm run test:migrations` replays all 40 migrations on fresh and legacy disposable databases and verifies RLS/browser isolation for all 68 tables. Availability-specific tests also start with permissive default grants and verify the bounded runtime role can use the new tables without obtaining schema CREATE permission. `prisma validate`, `npm run typecheck`, `npm run lint`, `git diff --check`, and the Prisma migration-path guard are checked locally. Lint retains the repository's existing warnings; the new availability components have no lint errors or warnings.

`npm run test:availability:e2e` requires Docker and a browser (`Chrome` on macOS; install Chromium with `npx playwright install chromium` on other platforms). It starts **only** `outclass-availability-e2e` on local ports 57321/57322 and a copied production application on 3126, without copying application `.env` files or overwriting running app builds. It applies migrations only to that dedicated local stack, creates synthetic confirmed Auth accounts and clubs, and exercises desktop drag/remove, keyboard painting, autosave request counts, copy-day/previous-week, date replacements/restoration, round confirmation/invalidation, mobile tap/drag, responsive overflow, existing session coverage and bulk eligibility. Direct authenticated HTTP actions additionally verify a real concurrent-save race, member/outsider denials and foreign-round rejection. No mock Auth, database, action handler or calendar persistence is used in that browser flow. The production build and browser flow passed locally.

The runner cleans up its dedicated test server and stack by default. For inspection, use `npm run test:availability:e2e -- --keep`; remove a retained fixture with `npm run test:availability:e2e -- --cleanup`. Screenshots and logs remain in the OS temporary directory's `outclass-availability-e2e` folder. The runner never stops another local Supabase project.

Hosted Supabase token/API smoke tests and native-device touch testing remain release checks. The local Chrome mobile test emulates touch and viewport behavior. Before a production release, review/apply the additive Prisma migration through the existing staging/reconciliation process and regenerate Prisma Client. No additional email transport or notification migrations are required.
