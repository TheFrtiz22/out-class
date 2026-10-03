# Final product integration audit — Prompt 36

This pass expands the existing deterministic presentation and fixes observed integration defects. No new production feature system, dependency, schema, or migration was introduced. Prompt 34 voting and Prompt 35 Explore/Corkboard remain authoritative.

## Product map and boundaries

| Experience | Connected implementation | Persistence / authorization |
| --- | --- | --- |
| Student authentication and onboarding | Auth view, registration wizard, callback/password recovery, unified profile | Supabase verified UVA identity; Prisma profile; guarded account changes. Demo uses a fictional identity after the server-authorized demo gate. |
| Student browsing | Explore, shared directory cards and club profiles, search/category/filter/sort/public events | Existing public-only directory projection; no applicant information in discovery. Legacy Discovery/Categories bookmarks canonicalize into Explore. |
| Student saved clubs | Shared Corkboard provider/buttons/profile links | Owner-scoped server saves in `CorkboardClub`; demo-only saves through the same adapter. Saving does not apply, subscribe, or join. |
| Applications and tracking | Club → application form → draft/save/submit → tracker/Home | Session-owned applications and answers, validated questions/test requirements/attachments, idempotent draft start and guarded submission. Student views do not expose reviewer Pros/Cons or interview kits. |
| Student scheduling/calendar | Tracker invitation → ApplicantBooking → room picker → calendar projection | Own invited application/round, transactional capacity/conflict checks, persisted booking/reschedule/cancel. Public/member meetings and historical attendance use existing meeting records. Local scheduler previews remain separate. |
| Club setup and management | Organization setup/claim/invitation/checklist, profile editor, roster import, memberships, meetings, tasks | Existing owner and capability checks; transactional invitation/import/outcome history. Demo MII ownership is synthetic and never grants platform privileges. |
| Recruitment review | Club workspace → rounds/rules/applicants → configured display and observations | Current membership/capabilities, anonymous-round redaction, server-filtered applicant DTO; author-only Pros/Cons writes with audits. Screening flags do not silently decide applications. |
| Interviews | Recruitment interviews → kits/rooms → candidate queue → Interview Mode | Versioned kits, per-reviewer/per-application/per-round draft snapshots, privacy checks, optimistic revisions, atomic completion/evaluation link. Same applicant-display panel as review/voting. |
| Voting and outcomes | Recruitment voting → session/pass queue → ballots/history → finish/reopen → explicit review/publication | Server sessions, immutable unique ballots, locked transactions, distinct view/vote/manage/start/finish/reopen/publish capabilities, snapshots and expected-status/round conflict checks. Target is informational. Only explicit publication mutates application statuses; histories remain sealed and auditable. |
| Platform administration | `/platform`, user/club/resource inspection, audited controls, customer support | Server allowlist + active DB grant + Supabase AAL2; no club/demo role grants admin. Current support impersonation uses the target's capabilities, preserves original login, logs actor/effective identity/reason, expires after 30 minutes, and blocks privileged account changes. See `support-impersonation-tutorials.md`; older read-only snapshot descriptions are historical. |

Primary production application state is database-backed. The remaining browser previews, notification presentation/read states, local subscriptions, calendar preview scheduling, and demo store are not admissions, ballot, or production booking authorities. No replacement database or parallel voting system was created.

## Demo coverage and presentation sequence

The same `workspace-api` boundary delegates to live actions while off and the existing isolated demo graph while on. Middleware and server authentication deny live mutations while the demo cookie is active. The authorization endpoint for turning demo on/off remains live and independently gated.

New/reset presentations retain 20 clubs, 200 fictional people, connected applications/rounds/evaluations, meetings/attendance/tasks, and two saved clubs. Jordan has education, work, research, a project, skills, GPA and test scores; other applicants retain varied completeness. MII has a sample marketing profile, screening thresholds, configured display fields, reviewer Pros/Cons, kits, completed and draft interviews, a historical room booking and future availability. GMG, already on Corkboard, has Jordan's unbooked interview invitation and future room slots for booking/rescheduling/cancellation.

MII voting starts with two sessions: a sealed published history whose candidate statuses match final application outcomes, and an open second pass with Pass, Hold/Fringe, Do Not Pass and unresolved candidates. Its target is already reached, demonstrating that leadership can continue. Initial IDs, ballots, timestamps, decisions and links are deterministic for the stored season anchor. Ballots do not pre-publish the open session's outcomes.

Suggested walkthrough:

1. Student Profile → Explore categories/search → Corkboard → GMG profile and interview invitation; use Applications to book/change/cancel a GMG time and inspect Calendar.
2. Open AIF's existing draft, complete required answers, save and submit; refresh and inspect tracking.
3. Switch to MII Recruiting; inspect round/rule configuration and an identified applicant's configured information/Pros/Cons. Anonymous Review still withholds identifying/free-text information.
4. Open Interviews; inspect kits and rooms, resume the second seeded interview draft, and complete an evaluation. Existing drafts keep their kit snapshot after kit edits.
5. Open Recruitment voting; review Pass 1 and the live Pass 2, finish ballots, complete the pass, start another pass for held/unresolved candidates, finish/reopen if needed, and explicitly review/publish. Switch to Student to see Jordan's resulting application status.
6. Use Tutorial help in either perspective; reset from the demo menu and repeat.

Repeated reset returns the full graph (including Corkboard, voting history, Pros/Cons, rooms, kits, drafts, evaluations, configuration and tutorial progress) to byte-equivalent initial data. Existing saved presentations retain edits until reset. Older admin templates receive missing defaults on both hydration and reset; their existing records are preserved. There are no live uploads, real student records, messages, invitations, external calendar synchronization, recordings, or AI-generated evaluations in the demo. Sample résumé links open only the bundled fictional document.

## Tutorials and regressions fixed

Student/leader tutorials retain eight/six step indices and schema version 1, preserving completed/skipped progress. Copy now covers Explore, Corkboard, applications/statuses/calendar, configured applicant information, Pros/Cons, interview kits/notes/evaluations, voting passes/holds/targets and explicit publication. Demo tutorial progress goes through the existing adapter and isolated snapshot; starts skipped so presenters choose Tutorial help. Student anchors now target visible navigation; tutorial controls sit above mobile navigation.

Concrete fixes:

- Suspended/former reviewers could satisfy the old application-attachment capability query. It now also requires ACTIVE membership, matching résumé downloads; signing is never reached for inactive reviewers.
- Demo perspective/reset retained stale student view/section parameters. Manual perspective changes now clear stale parameters, while explicit student bookmarks are preserved when changing perspective to open that bookmark. Reset navigates to canonical student Home, clearing Next’s cached route state and preventing a club route from immediately restoring leader mode.
- Demo room timestamps revived into Dates on reload, crashing the booking picker’s ISO-string sort. Demo room and booking DTOs now normalize timestamps to the same ISO contract as production, including saved bookings.
- Older admin template resets skipped defaults applied during initial hydration. Hydration and reset now share the same compatibility normalization.
- ApplicantBooking retained another application's data while loading a changed application. New requests now clear it and show the existing loading state.
- Configured demo applicant displays omitted their local sample résumé because the production projector correctly rejects public paths. Only the demo adapter adds the bundled link, and only when the field is selected and the round is identified.
- Demo publication accepted duplicate selections or applications moved to another round. It now rejects both atomically, matching production conflicts.
- Demo voting falsely said its data was saved on the server; copy now states the actual isolated-browser boundary.
- Interview notifications distinguished only status, falsely calling unbooked invitations scheduled; they now distinguish invitations from actual bookings.
- Snapshot validation now checks current configuration/observations, room panels/bookings/capacity, and duplicate voting history so damaged cross-club data cannot hydrate.

## Navigation/dead-code audit

The only production `discover`/`discovery`/`categories` view tokens are compatibility redirects. Shared DiscoveryCard/types/CSS and club category settings are reusable and retained. `LiveVotingLauncher`, PIN/member-pad routes, BroadcastChannel reducers, and the unauthenticated leader preview are still reachable, explicitly labeled local previews; they are not fed production applicants or used as persisted voting truth. The existing support-session BroadcastChannel merely signals context refresh and carries no credentials. Historical docs were marked or updated where they misleadingly described the current product.

## Verification and limits

Focused tests exercise Demo Mode, tutorial behavior, Explore/Corkboard, application save/submit, rooms/booking/cancellation, kit snapshots, interview completion/evaluations, applicant information/privacy, Pros/Cons, durable voting, attachment access and authorization. New connected adapter tests cover the full student and leader sequences, reloads, repeated reset, older templates, and publication conflict rollback; all assert zero production action calls.

Actual browser verification uses an isolated temporary local fixture with repository components and synthetic demo providers, without changing production authentication or adding a product test route. It checks 27 page layouts at 1440/768/390px, three voting boards, shared sample résumés, tutorial restart/advance/show/skip, booking/reload/cancellation, menu reset back to Home and seeded saves, no horizontal overflow, no runtime exceptions, and zero live server-action requests. Prompt 35 already verified Explore/Corkboard at 320px as well.

Verification results:

- Focused suite: 126 tests passed.
- `corepack pnpm test`: 434 tests, 432 passed, two existing environment-gated skips, zero failures.
- `corepack pnpm test:migrations`: all 20 migrations apply on fresh and legacy databases; all 43 tables enforce RLS and deny browser-role CRUD.
- `npx tsc --noEmit`: passed.
- `corepack pnpm build`: passed, with existing lint warnings.
- Focused ESLint for changed implementation files: passed.
- `git diff --check`: passed; no new TODO/FIXME or conflict markers.
- Production old-view search: only compatibility aliases remain; preview voting references remain intentionally isolated.

Acceptance updates an application decision; membership remains the club's explicit roster/joining workflow and is not silently created by publication. The two existing native-PostgreSQL/Supabase/MFA/SMTP integration tests remain environment-gated; this local pass does not certify hosted authentication, real email, storage upload, or deployed database behavior. Voting multi-device behavior remains server polling every five seconds; Corkboard refreshes on load/focus/manual refresh. Demo presentation remains one editing browser and anchored dates can age. Deployment must apply existing migrations (including Prompt 34/35) through the established workflow; no remote deployment was performed.

This is the final planned feature/integration round. No further product features were added or queued.

## Changed files

- `app/api/application-attachments/route.ts`
- `components/interviews/applicant-booking.tsx`
- `components/live-voting/board-decision-mode.tsx`
- `components/shell/product-shell.tsx`
- `components/tutorial-walkthrough.tsx`
- `contexts/demo-context.tsx`
- `docs/applicant-intelligence.md`
- `docs/demo-mode.md`
- `docs/platform-admin.md`
- `docs/product-integration-audit.md`
- `docs/support-impersonation-tutorials.md`
- `lib/demo/interview-rooms.ts`
- `lib/demo/seed.ts`
- `lib/demo/store.ts`
- `lib/demo/validate.ts`
- `lib/demo/voting.ts`
- `lib/tutorials.ts`
- `lib/workspace-api.ts`
- `tests/api-application-attachments.test.cjs`
- `tests/demo-mode.test.cjs`
- `tests/demo-provider.test.cjs`
- `tests/helpers/demo-harness.cjs`
- `tests/product-integration.test.cjs`
- `tests/support-tutorials.test.cjs`
