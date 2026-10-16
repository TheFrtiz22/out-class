# Event creation and flyer storage

Events retain the canonical `Meeting` / SQL `Event` start and end timestamps. The only scheduling addition is `allDay`, defaulting to false for existing events. All-day events use New York local midnight boundaries and an **exclusive** end date, so a single day crossing the spring/fall clock change is correctly 23/25 elapsed hours. The editor displays inclusive dates and “All day”; ICS uses `DTSTART;VALUE=DATE` and exclusive `DTEND;VALUE=DATE`.

Timed events offer 15, 30, 45, 60, 90, 120 and 180 elapsed-minute presets and a retained custom ending. Presets recalculate without effects or a second stored end-time representation. The student calendar, agenda and public club event summaries also retain canonical end times and all-day labels. Existing off-quarter times and exact fall-fold instants survive editing. New ambiguous fall times use the first occurrence; nonexistent spring times produce an inline error. Autosave stages private editor content only; applying or submitting remains explicit and preserves existing moderation requirements.

## Storage

Reuse the existing private `event-flyers` bucket and `EventFlyer` / `EventPublication.flyerId` references. No new public bucket or browser upload capability is introduced. Publicly approved images stream through `/api/event-flyers`; unpublished previews require manager permission. Direct anonymous/authenticated Storage access stays denied by the existing restrictive policies. Credentials stay in server modules.

The migration updates bucket MIME restrictions to PNG, JPEG and WebP and its size limit to 10 MiB. The upload action independently enforces size and verifies binary signatures using the established image validator. Paths remain `club UUID/event UUID/random UUID.extension`. Uploads reauthorize `meetings.manage` inside the serialized event transaction and compare the revision. File selection, drag/drop, an indeterminate upload progress indicator, preview, replacement, removal and retry are supported. No flyer is required for saving or submission. Both views use the event title and club name for their branded fallback, including when an image fails to load.

Flyer replacement/removal deletes the old database reference and queues its Storage path in `EventFlyerDeletion`. Cascading event/club deletion also queues files. Failed transactions attempt immediate object removal and enqueue failed removals. Queue items are removed only after provider deletion succeeds. Saves/uploads attempt to drain the queue; provision a recurring trusted server job running `node scripts/cleanup-event-flyers.cjs` to retry failures and handle event deletions that do not pass through the editor. The job uses the server database URL, Supabase URL, and secret/service-role key. Run it hourly (or more frequently); monitor nonzero exits and queue age. It is intentionally not installed against production automatically.

## Deployment

1. Review `prisma/migrations/20261016020000_event_scheduling_flyer_limits/migration.sql` and follow the existing database deployment procedure. Prisma remains the sole migration history; do not enable a second Supabase migration chain.
2. Apply the migration to the intended staging database before releasing the app. It preserves existing timed events, updates the existing bucket idempotently, adds the all-day check, expands the flyer size constraint, and adds the private deletion queue/triggers. Historical unselected flyer rows are queued for cleanup.
3. If Supabase Storage is installed after the application migrations, apply the existing server-only Storage policy setup and replay the bucket upsert block from this migration. Confirm bucket privacy, limits, MIME types and both restrictive policies before enabling uploads.
4. Configure the cleanup job and run authenticated staging smoke tests. The existing 12 MB server-action request limit accommodates a 10 MiB file plus multipart overhead. Any reverse proxy must allow the same request size.
5. Approve and deploy using the normal release process. No production schema changes or deployment are performed by this implementation.

## Verification

`npm test`, `npm run test:migrations`, `npm run lint`, `npm run typecheck`, and `npm run build` cover repository checks. New tests cover scheduling/DST/date-only exports, server image validation, and the actual editor in a browser on desktop/mobile (including custom-end retention, all-day toggling, optional flyers and upload failure recovery).

`tests/event-storage-native.test.cjs` is opt-in against a separately provisioned disposable local Supabase stack, explicitly restricted to API port 57321 and database port 57322. Set `OUTCLASS_EVENT_STORAGE_TEST_CONFIG` to the local CLI status JSON file and run that test. It exercises the actual server actions, native database authorization/constraints, Storage provider and image route; the identity seam is synthetic, while live membership authorization is real. It verifies no-flyer publishing, manager/outsider access, MIME/size rejection, public-only serving, unique paths, preserved/replaced/removed images, all-day persistence, cascade deletion and drained cleanup. Never point it at production.

Verified locally on October 16, 2026: full suite **1,189 passed, 28 environment-gated tests skipped, zero failures**; the opt-in native Supabase test was also run separately and passed. Migration tests applied all 55 migrations on fresh and legacy databases and confirmed RLS on all 78 tables. Desktop/mobile editor tests passed. Typecheck, lint and production build passed; lint retains pre-existing warnings. The disposable Storage stack was isolated from the application development stack and removed after verification.
