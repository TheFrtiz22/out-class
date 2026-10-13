# Availability and scheduling UX audit

The existing UserAvailability document, InterviewRoundParticipation snapshot, PipelineRound → InterviewRoom → InterviewSlot, private InterviewPanelProposal, and immutable InterviewPanelScheduleVersion remain authoritative. No parallel room, booking, or scheduling models are introduced.

## Disconnections found

- Availability was only linked from profile; round requests and declines had no persisted state or dashboard entry.
- Scheduling and availability tabs had independent round/date context. Unmounting panel review discarded unsaved manual edits.
- Coverage used an arbitrary target and checked only slot duration, while the filler checks saved session requirements, buffers, interview access and official commitments.
- Room creation reset round/date filters, and published headcount controls offered no clear path into a private revision.
- The global and round editors rendered together; direct request links did not select the round. Unknown days looked like unavailable days.

## Decisions

Extend participation with request/reminder/decline timestamps and a reminder sequence; derive response state from explicit confirmation/decline/request. Editing withdraws round confirmation until resubmitted. Global declarations remain distinct from round attestations. Requests are idempotent, reminders limited to awaiting responses once per 24 hours. Insert UserNotification in the same locked transaction; its existing trigger queues optional INTERVIEW email through Resend. Recheck current membership/eligibility/response before email delivery.

Keep the existing RoomManager and PanelPreviewWorkspace in a round-centered scheduling workspace. Sections stay mounted so unsaved drafts survive internal navigation. Round/date/section/session use URL parameters and browser history. Changing scope uses the existing unsaved-change guard. The shared panel planning scene supplies full-session capacity and saved requirements; foreign-club details remain private. Eligibility never changes permissions. Publication still requires owner approval and complete server revalidation; requests, headcount edits and draft generation never publish panels.

The additive Prisma migration is local-only until explicitly approved. No production migration, deployment, scheduling publication or live request is part of this task.

## Implemented experience

- Shared desktop/mobile application navigation and account menu expose My Availability for all signed-in accounts. Profile remains a secondary entry.
- Compact dashboard requests link directly to the club/round response, with awaiting/submitted/declined status. The editor selects the requested round, prefills global availability and opens the next session’s week. Global and round editing are separate; round submission is above the calendar.
- Calendar paint previews stay local until pointer release, then use the existing debounced, revision-safe queue. Unknown days have a distinct striped treatment. Keyboard, mobile tap/drag, recurrence, date overrides, copy and clear controls remain supported.
- Scheduling uses one round/date context and URL-backed Availability → Rooms → Fill Panels → Review & Publish sections. Draft review remains mounted during navigation and browser back/forward. Fresh Auto-Fill respects the selected date; a saved draft retains its own window. Room creation retains the round/date context.
- Collection supports selected members or all eligible members, durable in-app requests and optional interview email, response tracking and bounded reminders. Declining excludes a participant; editing a confirmed response requires resubmission.
- Heatmap selection lists participants and session needs, with links into room/session configuration. Room rows use round-wide planner coverage, including full interview/buffer availability, interview access and official conflicts. Headcount saves immediately update values/revisions, fixing rapid successive edits. Published requirements use working revisions.
- Existing owner approval, immutable history, conflict revalidation, affected-only notifications, published revision editing and applicant booking rules are preserved.

## Changed files

| Area | Files |
| --- | --- |
| Persistence and collection | `prisma/schema.prisma`, `prisma/migrations/20261012200000_availability_collection/migration.sql`, `actions/availability.ts`, `lib/availability.ts` |
| Navigation and requests | `components/shell/product-shell.tsx`, `components/views/student-dashboard-view.tsx`, `components/availability/dashboard-requests.tsx`, `app/settings/availability/page.tsx` |
| Availability UI | `components/availability/my-availability.tsx`, `weekly-calendar.tsx`, `availability.css`, `admin-overview.tsx` |
| Existing scheduling workspace | `components/interview-management-tabs.tsx`, `components/interviews/room-manager.tsx`, `create-room-dialog.tsx`, `panel-preview-workspace.tsx`, `utils/panel-planning.ts` |
| Existing communications | `actions/communications.ts`, `utils/availability-request-notifications.ts`, `utils/notification-delivery.ts` |
| Verification | `tests/availability-collection.test.cjs`, `tests/availability-scheduling-browser.cjs`, existing availability/proposal/publication browser tests, `scripts/run-availability-e2e.cjs`, `package.json` |

## Database change

One additive, transactional Prisma migration adds `requestedAt`, `lastReminderAt`, `reminderSequence` and `declinedAt` to InterviewRoundParticipation, with nonnegative reminder and mutually exclusive confirmed/declined constraints. Existing unique member/round and club/round indexes, composite foreign keys, private-table RLS and bounded runtime ownership remain intact. There are no new scheduling tables or public Data API permissions.

## Local verification

- `npm run test`: 1,035 passed; 15 existing conditional skips; no failures.
- `npm run test:migrations`: all 43 migrations applied to fresh and legacy fixtures; all 70 tables retain RLS and deny browser-role CRUD.
- `npx prisma validate`, `npm run typecheck`, `npm run lint`: pass; lint retains 28 existing warnings, no errors.
- `npm run test:availability:e2e`: native Supabase Auth → Next server actions → Prisma/Postgres, desktop drag/remove, keyboard, copy, exceptions, confirmation, mobile tap/drag, concurrent saves, overview and bulk eligibility: pass.
- `npm run test:scheduling-ux:e2e`: requests/reminders → dashboard deep links → independent round response → mobile decline → existing headcount configuration → unpublished Auto-Fill → unsaved internal navigation/back → save/discard; also runs existing proposal refill/regenerate/mobile and publication A–K regression suites: pass. Official data stayed unchanged throughout proposal edits; publication/revision safety, notifications, booking regression and cross-club concurrent conflict rejection passed.
- Final Next production build from current sources: pass in the isolated local fixture. No application `.env` files or hosted database credentials were copied; outbound email provider delivery was disabled.
- Screenshots were reviewed on desktop and an emulated iPhone. Receipts/screenshots are retained outside the repository in `~/.codex/artifacts/outclass-scheduling-ux-20261012/`.

## Release requirements

No production migrations, deployment, live requests or live panel assignments were performed. The new Prisma migration requires explicit approval before a production release; the existing production build gate will reject an unmigrated database. Optional email uses the existing Resend/outbox worker and interview email preferences. Live provider delivery and a physical phone smoke check remain release checks; all automated local journeys passed.
