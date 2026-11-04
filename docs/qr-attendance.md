# QR codes and recruitment attendance

The existing application is a static Next.js export with sample identities and
browser-local data. The new UI follows that architecture; it does not claim that
email verification, production attendance, or cross-device persistence exists.

- Club Settings → QR Codes & Links exports a real profile QR as SVG or 2048px PNG.
- Club Settings → Events & Meetings creates public dated events and shows their
  individual check-in QR. Private and recurring meetings are excluded.
- `/club/[clubId]/` is statically generated for each discoverable club.
- `/check-in/?eventId=...` resolves an event only after persisted state loads.
  Logged-out visitors see sign-in/create-profile. The existing “Explore the demo”
  action checks in the sample student; later scans in that tab reuse that demo
  session. Unverified email entry never confirms attendance.
- CRM has Interested Leads and Active Applicants views. Attendance is unique per
  student/event and scoped by club. Seed CRM identities are joined by email in
  this preview because the existing fixtures use separate applicant IDs.
  Production must use immutable authenticated student IDs.
- Attendance is saved before success is shown. Failure offers a retry. Duplicate
  scans do not change the original timestamp or inflate event counts.

## Production integration boundary

`database/attendance.sql` is a reference PostgreSQL schema, function, and CRM view,
not an applied migration. It enforces the event/club relationship and atomic
deduplication, and derives the Lead/Applicant segment without losing attendance.

To make mobile scans update a leader's CRM across devices, connect event creation,
event lookup, check-in, applications, and CRM reads to the same authenticated
backend. Replace `recordDemoAttendance` with an authenticated POST of **only** the
event ID; the server derives the student from its verified session and the club
from the stored event, calls `recruitment.check_in`, and returns the saved row.
Enforce club executive membership for event creation and CRM reads. Grant access
only to the server's least-privilege database role; the supplied function is not
an anonymous/browser RPC. Keep production keys off the client.

Preserve the event ID across the real sign-in callback, then perform check-in
automatically after verified authentication. Replace the demo session marker with
the auth provider's session. Use the `recruitment.crm` view for both segments,
including draft applications, and retain cancelled events with check-in disabled
so historical counts remain available.

Until this backend is connected, newly created events are available only in the
browser where they were created. Downloaded profile codes work on the deployed
origin; localhost codes require a reachable host before use on printed flyers.

## Universal Branded QR Architecture

All QR codes across OutClass use the centralized branded QR system located in `@/lib/qr` and `@/components/qr/outclass-qr-code`:
- **Visual Identity:** Deep OutClass Navy (`#142d4e`), organic rounded modules with smooth connected pill/capsule shapes, circular concentric finder patterns (1:1:3:1:1 radial ratio), and the official OutClass interlocking OC monogram centered in an Apple-style squircle badge (rx ~20.5%).
- **Error Correction:** QR error correction level H (~30% recovery) is strictly enforced to protect data payload integrity while accommodating the center monogram badge.
- **Short-link Optimization:** Internal event, meeting, and recruitment flows automatically use compact OutClass short URLs (`/q/[code]`) stored securely in `PlatformContent`. This keeps QR matrix dimensions compact (e.g. 33x33) with large, highly legible modules for reliable mobile, projection, and print scanning.
- **Export Capabilities:** 2048px high-resolution PNG downloads, vector SVG downloads, and presenter full-screen view.
- **Standard Component:** Developers must always use `<OutClassQRCode value={url} ... />` from `@/components/qr/outclass-qr-code` rather than introducing external or generic QR code libraries.
