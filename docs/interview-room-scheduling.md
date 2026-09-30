# Interview rooms and applicant booking

The live manager path is Club workspace → Recruiting → Interviews → Rooms & Booking. Create a room, select its recruitment round, add up to 14 dates, set the time zone, length, buffer and capacity, and optionally assign panel members. The preview shows exactly how many complete slots will be created; unused trailing minutes stay free. Add dates reuses a room's details. Pausing stops new bookings and preserves reservations. Copy booking link creates a shareable entry point; the recipient must sign in with an invited applicant account.

Applicants whose saved application is **INTERVIEWING** in the room's round see the booking calendar in Applications → their club. Other applicants cannot reserve slots. Applicants can change or cancel future reservations. Rescheduling releases the previous slot only in the same successful transaction as the replacement. Manager preview never makes a booking. Panel identities and other candidates are excluded from applicant responses. Manager candidate names respect `applicants.identify` and anonymous-round settings.

## SQL to run

The SQL artifact is:

`prisma/migrations/20260930000000_interview_rooms/migration.sql`

This is an additive migration against the existing OutClass Prisma schema, not an independent database bootstrap. It adds InterviewRoom, slot-room associations, booking-round associations, one-booking-per-round uniqueness, indexes, row-level security, browser-role privilege revocation, and a booking-integrity trigger. Existing standalone slots/bookings remain intact with null room/round references. No existing booking is assigned to a guessed round or deleted.

For a database with the repository's Prisma migration history already aligned:

```sh
npx prisma migrate status
npm run db:deploy
npx prisma generate
npm run build
```

`db:deploy` applies all pending migrations, including any earlier feature migrations. Review the pending list first. For a new empty application database it also installs the prerequisite tables. Follow `docs/database-deployment.md` for existing installations with schema drift.

If applying this exact SQL manually in the Supabase SQL editor, run it **once** as the database owner, after verifying the prior schema and migrations. After successful execution, record only this verified migration in Prisma history:

```sh
npx prisma migrate resolve --applied 20260930000000_interview_rooms
npx prisma generate
```

Do not run both manual SQL and `migrate deploy` for the same unrecorded migration. The file is transactional; it deliberately fails on a second application rather than masking drift. No storage bucket, API key, cron job, or new environment variable is required. The existing server-only Prisma connection performs guarded writes; do not grant browser roles access to these tables.

## Checks and behavior

- Date/time inputs use explicit IANA time zones. Nonexistent/ambiguous daylight-saving times are rejected. Slots display in the applicant's chosen time zone.
- Capacity, ownership, invitation status, matching round/club, past times, duplicate-round bookings, and overlapping student interviews are checked in serializable transactions. Serialization conflicts retry up to three times.
- Room creation checks overlapping room/location windows and panel assignments, including buffers. Reopening a room checks newly introduced conflicts.
- SQL also enforces round/capacity/student-conflict invariants for new room bookings. API guards enforce the current signed-in identity and club permissions.
- Demo rooms use the isolated demo store and persist in browser storage; no live action is called. Existing seeded demo appointments remain visible through the existing application/calendar adapter.
- Production email delivery, external calendar syncing, and video-link generation are not configured by this feature. Managers supply their meeting URL; saved bookings appear in the existing application data/calendar flow after refresh.

After deployment, smoke-test with an interviews manager and an invited applicant: create a future room, refresh, book, refresh both accounts, reschedule, cancel, fill the last seat, and attempt a concurrent extra booking. Local SQL/action tests do not claim that a remote database has been migrated.
