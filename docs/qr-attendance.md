# QR codes and recruitment attendance

> **Updated 2026-11-04.** The browser-local design this file previously described
> (static export, `recordDemoAttendance`, `database/attendance.sql`,
> `/check-in?eventId=`) is superseded. The current server-backed flow is below.
> `lib/attendance.ts` and the signed-out leader preview remain **demo-only**.

## Meeting and event check-in (current main)

Campus events and club meetings share one table (`Meeting` → `"Event"`), so both
use the same path.

1. **Issue.** A leader with `meetings.attendance` opens the attendance QR
   (`components/meeting-workspace.tsx`). Every 60s it calls
   `issueMeetingCheckIn` (`actions/meetings.ts`), which locks the club and event,
   enforces the window (1h before start → 6h after end), stores only the SHA-256
   of a random 64-hex token in `MeetingCheckInToken` (90s lifetime), and creates
   a compact `/q/<code>` link in the same transaction
   (`lib/short-link-store.ts`). Links whose tokens can no longer be valid are
   deleted on rotation.
2. **Scan.** `/q/<code>` (`app/q/[code]/page.tsx`) resolves server-side and
   redirects to `/check-in?meetingId=…#token=…`. The token is in the fragment,
   so it is not sent in requests or logs; the check-in page reads it and strips it
   from the address bar.
3. **Check in.** `checkInMeeting` requires a verified session and takes the
   student from the session, never the URL or body. Under an event row lock it
   checks visibility (members-only meetings need active membership), the token
   hash and expiry, and that the issuer is still enabled and still holds the
   permission. `EventAttendance` is unique per `(eventId, studentId)`; repeat
   scans return the original timestamp.
4. **Close.** `closeMeetingCheckIn` deletes the meeting's tokens and revokes its
   short links, removing the raw token from storage; the `/q` link then shows
   "Check-In Closed".
5. **Report.** `meetingAttendance` and `recruitmentAttendanceSummary` read
   `EventAttendance` from the database for leaders with the attendance
   permission and redact anonymous applicants.

**Known limits.** A signed-out scanner is sent to sign in with only the meeting
ID and must scan again afterwards (tokens are short-lived by design). There is no
database-backed end-to-end test of issue → `/q` → check-in → leader report yet;
current coverage is `tests/meetings.test.cjs` and
`tests/qr-branded-system.test.cjs` with mocked Prisma.

## Short-link security boundary

- `actions/short-links.ts` exports a single browser-callable action,
  `createShortLink({ target })`. It requires a verified session and accepts only
  the exact shapes of shareable links (`votingJoinPath`, `liveRoomPath`,
  `/club/<slug>`; see `shareableShortLinkType` in `lib/short-links.ts`). Type,
  expiry, scope and metadata are set by the server. The destination still
  enforces its own authorization.
- Resolution, check-in link creation and revocation live in
  `lib/short-link-store.ts`, which is **not** a `"use server"` module. Do not
  add exports to `actions/short-links.ts` without an identity and permission
  check: every export there is a public endpoint.
- `isValidRedirectTarget` rejects ASCII control/whitespace characters and
  backslashes (browsers strip or normalize these into protocol-relative URLs),
  `//` prefixes, pseudo-protocols, and any host outside the allow-list.
  `localhost`/`127.0.0.1` are accepted only outside production.

## Universal Branded QR Architecture

All QR codes across OutClass use the centralized branded QR system located in `@/lib/qr` and `@/components/qr/outclass-qr-code`:
- **Visual Identity:** Deep OutClass Navy (`#142d4e`), organic rounded modules with smooth connected pill/capsule shapes, circular concentric finder patterns (1:1:3:1:1 radial ratio), and the official OutClass interlocking OC monogram centered in an Apple-style squircle badge (rx ~20.5%).
- **Error Correction:** QR error correction level H (~30% recovery) is strictly enforced to protect data payload integrity while accommodating the center monogram badge.
- **Short-link Optimization:** Meeting check-in and voting-join QR codes use compact OutClass short URLs (`/q/[code]`) stored server-side in `PlatformContent` (see the security boundary above). This keeps QR matrix dimensions compact (e.g. 33x33) with large, highly legible modules for reliable mobile, projection, and print scanning.
- **Export Capabilities:** 2048px high-resolution PNG downloads, vector SVG downloads, and presenter full-screen view.
- **Standard Component:** Developers must always use `<OutClassQRCode value={url} ... />` from `@/components/qr/outclass-qr-code` rather than introducing external or generic QR code libraries.
