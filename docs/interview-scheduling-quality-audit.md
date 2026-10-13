# Interview scheduling quality audit — 2026-10-13

The complete quality journey passed against dedicated local Supabase Auth, native PostgreSQL and a production build of the real Next application. Browser actions used the actual UI and server authorization. Additional concurrency and failure injections used authenticated HTTP server actions and database assertions. Nothing was deployed and no production database was accessed or migrated.

## Fixture and isolation

`npm run test:scheduling-quality:e2e` creates Scheduling Quality Audit with an owner and a second authorized administrator, eight eligible interviewers, two ineligible members, three existing rooms and three interview rounds. Staffing requirements are 2, 3 and 1; sessions include overlaps and a transfer buffer. Availability includes full and partial schedules, a missing response, a decline and role/individual eligibility overrides. An applicant has an existing booking with an official, owner-published panel before the audit begins. A separate synthetic club supplies an official conflicting commitment; it exists only to exercise the required cross-club boundary.

All accounts are randomly generated synthetic test identities. The test runner excludes application `.env` files, binds to local-only ports 3126/57321/57322, disables the outbound email provider and guards the dedicated project ID before writes or cleanup. It applies only existing migrations to this disposable database. `--keep` retains the fixture; `--cleanup` removes only this test project. Do not use retained `config.json` or Supabase startup logs as public artifacts: they contain local test credentials.

## Bugs fixed

| Finding | Fix | Evidence |
| --- | --- | --- |
| Applying the same timezone or copying the same global schedule made a confirmed response look unsubmitted, while the database stayed confirmed. | Ignore unchanged schedules and preserve the visible confirmation on a no-op refresh. Actual edits still withdraw confirmation. | Browser probe asserts both visible confirmation and an exactly unchanged participation row. |
| A save could commit while its acknowledgement was lost, leaving local edits stuck against a stale revision. | Recover only an exact next revision with matching account, schedule and round confirmation state. Offline, mismatched and later concurrent writes retain the original error and edits. | Browser aborts the response after `route.fetch()` commits; unit cases cover unsafe recovery boundaries. |
| Panel planning could remain on its loading screen after other workspace actions, without starting its reader request. | Use the existing authenticated, private, uncached JSON read endpoint for availability and panel readers, outside the serialized Server Action queue. Mutations remain original server actions; the existing reader has a bounded timeout and useful failure state. | The previously stalled browser journey reaches planning; ordinary members receive 403 for overview, coverage and panel reads, and mutation dispatch is rejected. |
| The heatmap counted a participant with an overlapping official assignment in another club, disagreeing with full-session capacity. | Apply private planner access/commitment checks to round heatmap cells without serializing foreign details. | Fixture shows four available for five positions; the conflicting member is excluded. Database regression verifies foreign details remain private. |
| Each overlapping room appeared to have enough candidates, hiding their shared shortage. | Match distinct interviewers to simultaneous positions and show shared capacity shortages in overview, progress and room cards. Include trailing duty buffers. | Native overview warns about the simultaneous shortage; tests also catch subset shortages even when total candidate union is sufficient. |
| Switching rounds retained an unrelated week/date, potentially showing an empty overview for a configured round. | Reset to the earliest open future session in that round's local timezone; preserve explicit URL context and clear the previous date filter. | Browser creates a room in a different round and verifies the selected week; unit test covers room ordering, paused rooms and a DST/local-date boundary. |
| Auto-Fill on a published round opened its working revision without filling it. | Explicit Auto-Fill creates and fills the private revision. Edit Published Panels opens a revision for manual work; an existing draft is preserved. | Browser generates 10/12 feasible positions across two shortages, with every official table unchanged before approval. |
| A lost publication response put the error behind the still-open approval dialog. | Show the error inside the dialog and retain approval for an idempotent retry. | Browser commits publication, drops its response, verifies the visible alert, retries and asserts no additional version, grant or notification. |
| Long round choices expanded the mobile availability page beyond the phone viewport and disrupted touch targeting. | Constrain the selector/editor and wrap the long empty-week submission control. | Emulated iPhone has a 390px viewport without horizontal overflow; tap and native CDP touch-drag persist correctly. |

Additional workflow improvements: clear filtered bulk selections when changing member roles; calculate Select All from actual visible member IDs; guard Reload Draft against losing unsaved edits; provide a direct Go to Rooms recovery when no future sessions exist; replace misleading per-room Auto-Fill buttons with Review Panels/Edit Published Panels and remove duplicated team-availability navigation.

## Executed scenarios

| Requested area | Executed and passed |
| --- | --- |
| Discoverability | Ordinary-user primary navigation, dashboard request → direct round response, editing/submission without profile settings; mobile navigation to availability. |
| Availability reliability | Weekly drag selection and removal, keyboard toggle/extension, day/week copy, date-specific empty overrides, refresh, actual UI logout and a new authenticated sign-in; offline failed save retains painted state and leaves DB unchanged, retry succeeds; lost acknowledgement recovers; UTC/New York projection agrees with backend. DST gaps/repeats are covered by automated core tests rather than a browser travel simulation. |
| Admin visibility | Request all eligible nonresponders, submit through a test account, correct eight-eligible/six-confirmed counts, exact heatmap/list/session capacity; ineligible, missing, declined and foreign-committed interviewers excluded; unauthorized requests and identifiable reads rejected. |
| Rooms | Real room creation dialog in a second round, persisted room/session staffing requirements and planner integration; headcount edits do not alter official assignments. |
| Auto-Fill | Eligibility, participation, partial availability, shared room pools, official foreign commitments, transfer buffers, workload distribution and a nonempty locked assignment preserved by Fill Missing and Regenerate; no official writes or panel notices during generation/editing. |
| Review and publication | Manual lock/edit, Save Draft, refresh/reopen, retained unsaved edits during internal navigation; simultaneous administrator saves permit exactly one revision; explicit approval dialog and safe understaffing reason; publication writes the official version, assignments and affected-member notification intents. |
| Later edits | Private revision leaves the old publication active; one session requirement and member removal are approved; exactly the intended cancellation changes and only that member receives a new notice. |
| Failures | Offline availability, lost save/publication responses, concurrent stale edits, eligibility revoked after review, room closed after review; a local trigger fails publication after work begins and rolls back versions, slots, grants and notifications; idempotent publication retry creates no duplicate notices. Mobile no-room recovery and published personal schedule have no overflow. |

The existing collection, proposal and publication journeys also passed: request/reminder cooldown, mobile decline, applicant and manager API invariance before publication, booking regression, stale owner approval, affected-only notifications and a simultaneous cross-club publication race that permits exactly one conflicting plan. Physical device/Safari and live email delivery are not represented as browser passes.

## Verification

- `npm test`: 1,041 passed, 15 pre-existing conditional skips, 0 failures (1,056 total).
- `npm run test:migrations`: all 43 existing migrations applied on fresh and legacy fixtures; all 70 tables enforce RLS and deny browser-role CRUD.
- `npm run typecheck`, `npx prisma validate`: passed.
- `npm run lint`: no errors; 28 existing repository warnings.
- Standalone availability browser regression: desktop drag/remove, keyboard, copy, overrides, confirmation, real mobile tap/drag, concurrent saves, overview and club-scoped bulk eligibility passed.
- Complete quality browser journey: passed, using native local Auth/Next/Prisma/Postgres, desktop and emulated iPhone. No unhandled page errors.
- Final isolated Next production build and existing collection/proposal/publication scheduling regression journeys: passed.

The 15 default-suite skips belong to separately gated native integration harnesses (Admin/MFA, storage, communications, onboarding, collaboration, recruitment/decision flows, native interview transactions and PDF processing). They were not counted as passes. Scheduling-specific native browser/database journeys were executed separately as described here.

## Changes and database impact

| Area | Changed/new files |
| --- | --- |
| Private readers and coverage | `actions/availability.ts`, `app/api/workspace/route.ts`, `lib/availability-workspace-read.ts`, `lib/availability.ts` |
| Availability and requests | `components/availability/my-availability.tsx`, `dashboard-requests.tsx`, `admin-overview.tsx`, `lib/availability-save-recovery.ts` |
| Existing scheduling workflow | `components/interviews/room-manager.tsx`, `panel-preview-workspace.tsx`, `lib/interview-scheduling-context.ts`, `lib/interview-staffing-capacity.ts` |
| Test infrastructure and regressions | `tests/scheduling-quality-browser.cjs`, `availability-save-recovery.test.cjs`, `availability-collection.test.cjs`, `interview-scheduling-context.test.cjs`, `interview-staffing-capacity.test.cjs`, `scripts/run-availability-e2e.cjs`, `package.json` |

No schema changes or new migrations were needed for this audit. The existing global schedule, club membership eligibility, round participation, rooms/slots/bookings, private proposals, immutable official versions and existing notification outbox remain authoritative. No duplicate scheduling or room infrastructure was introduced.

Sanitized receipts, screenshots and validation logs are retained at `~/.codex/artifacts/outclass-scheduling-quality-20261013/`; credentials and database dumps are excluded. Desktop/mobile screenshots were visually inspected.

## Release assessment

Ready for staging. Production release still needs an approved application of any previously pending migrations, staging smoke checks with the actual notification worker/provider, and a physical mobile/Safari smoke check. Outbound email delivery was deliberately disabled, so mailbox delivery and provider retry behavior were not tested here; durable notification creation/idempotency and existing retry unit tests were verified.

No unresolved reproducible failure remains in the completed quality journey. Shared-capacity warnings are an early staffing check, not a proof of whole-window schedulability: Auto-Fill additionally checks symmetric transfer buffers, locks and duty limits, and its bounded-search limitations remain visible in proposal warnings.
