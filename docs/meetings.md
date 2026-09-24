# Unified meetings and secure attendance

## Shared model and migration

`Meeting` is the single Prisma model for both recruitment/interest and member meetings. It maps to the existing `Event` table with `@@map("Event")`; IDs and `EventAttendance` relations are preserved. Existing `Club.events` and attendance `event` relation names remain compatibility names, not separate systems. Existing public events backfill to RECRUITMENT; private events backfill to MEMBERS.

Apply `20260924030000_meetings` after earlier migrations. It adds audience, optional end time, agenda, recap, linked resources, revision, and a separate short-lived token table. Database constraints keep audience/public visibility aligned and end time after start. The token table has RLS enabled and no public/browser grants. Existing attendance is not rewritten. Live deployment requires DATABASE_URL and the existing-database baseline procedure in `authorization.md`; no live migration was performed in this task.

## Visibility and permissions

- Recruitment meetings are available to authenticated UVA prospects, including subscribed students. There is no persisted subscription authorization model today, so following a club is not required and is not treated as a server-side permission.
- Member meetings require a current `ClubMember` row. This includes ordinary members and invited managers represented by that existing model. Missing a meeting does not remove access to permitted agendas, resources, or recaps. Removing club membership removes private meeting access, including historical calendar details.
- `meetings.manage` controls creation and editing. Revision checks reject stale edits. Saving audits the change and invalidates current QR codes.
- `meetings.attendance` controls QR issuance/closing and attendance history. It does not independently grant meeting editing.
- Authenticated meeting queries apply audience/membership filters on the server. Public club pages expose only existing recruitment metadata; they do not expose member meeting resources.

`/meetings` provides a shared list with audience filters, and `/meetings/[id]` provides the shared detail/editor/attendance UI. Club settings and club profiles link to these pages. The student calendar includes eligible meetings and links to their agenda/resources/recap.

Resources use labeled HTTP(S) links with link/file/slides types. This supports documents/slides hosted elsewhere; no new binary-upload bucket or upload UI is claimed. Member-only external documents must also have restricted sharing at their provider. OutClass controls access to the resource listing, not an external provider's file access policy.

## QR protocol

An authorized leader opens attendance during the meeting window: from one hour before its start through six hours after its end, or start when no end is specified. The server creates a cryptographically random 256-bit token and stores only its SHA-256 hash with the meeting, issuer, and expiry. No new signing-secret environment variable is needed.

The displayed QR refreshes every 60 seconds. Tokens expire after 90 seconds, leaving a short overlap for a student scanning during rotation. Expired codes are rejected server-side regardless of the browser countdown. Closing check-in revokes all current codes for the meeting; other authorized open dashboards can issue subsequent codes. Leaving a dashboard lets its outstanding codes expire naturally.

The token is carried in a URL fragment, avoiding ordinary URL query logs/referrers. The check-in page reads it into memory and removes the fragment. Signed-out students sign in and rescan the current code; the app does not extend token validity for a lengthy login. Refreshing the check-in page requires a new scan.

The server checks the logged-in UVA identity, meeting eligibility, matching unexpired token, and issuer's current permission/active account. Meeting-row locking serializes scans and close/edit operations. The existing unique event/student constraint prevents duplicates. Repeated valid scans return Already checked in with the original timestamp; they never refresh it. Invalid/expired/member-ineligible states are shown explicitly. Static attendance URLs and tokenless legacy server calls fail closed.

A valid QR can be relayed during its brief lifetime; this verifies authenticated access to a current code, not physical location. No geolocation or device tracking is invented. Use supervised display for attendance-sensitive meetings.

## Recruitment review

Applicant detail and Interview Mode show a numeric summary: attended X of Y recorded interest meetings held to date. The denominator is all persisted public recruitment meetings for that club up to the current time, not a fabricated semester/cycle. Member meetings and future meetings are excluded. Attendance does not change scores, sort order, ranking, or decisions.

Review-summary access follows existing applicant permissions and anonymous-round rules. Only aggregate counts are returned; student IDs or meeting-by-meeting history are not attached to anonymous applicant payloads. Attendance history replaces the names/emails of current anonymous applicants with Anonymous applicant. Checked-in timestamps are retained for attendance management.

## Demo and validation

The demo contains recruitment/member meetings, agendas, resources, recaps, attendance, and local expiring QR tokens. The same student identity retains MII-only management. Demo calendar attendance comes from these records, not subscription-derived fabricated check-ins. Older saved demos receive the new fixtures without resetting applications.

Demo QR is explicitly local to one browser, not simulated cross-device infrastructure. Demo leaders may open sample meetings outside the production date window for presentation; token expiry, member eligibility, duplicate handling, and management scope still apply. Live operations require the deployed database and auth services.

Validation covers audience-scoped queries, safe resources, hashed expiry, duplicate/concurrent scans, issuer revocation, close/edit invalidation, anonymous attendance, factual aggregate counts, demo isolation, and isolated PostgreSQL data-preservation/permission checks. TypeScript and production build pass. Lint cannot run until ESLint is installed. Actual cross-device Supabase sign-in/check-in should be verified after deploying migrations and configuring the live services.
