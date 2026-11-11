# Account deletion (Phase 1)

Settings → Account → Delete account. Needed for the Privacy Policy deletion right and App Store 5.1.1(v).

## Flow
1. The person types their university email or `DELETE`, confirms in the shared danger dialog and proves fresh authentication: the current password (checked on a throwaway Auth client, Turnstile-forwarded, 5 tries per 15 minutes) or, for university sign-in accounts, a sign-in within the last 10 minutes (`amr` claim).
2. `requestAccountDeletion` writes a `PlatformReport` (`kind = ACCOUNT_DELETION`, the existing admin Reports queue) and an `AuditLog` row `account.deletion.requested` with `scheduledFor` (+14 days), then emails a confirmation over the invitation SMTP path. Cancel is a signed-in button (no bearer link; the unsubscribe-token pattern from PR #277 isn't on `main`).
3. Refused: Demo Mode, administrator support sessions (view-as), active platform admins, and sole active owners of a club.
4. `cancelAccountDeletion` works until the due date (report → `DISMISSED`, audit `account.deletion.cancelled`).
5. Admin → Reports lists pending requests with due dates. **Complete deletion** requires fresh Admin verification (`requirePlatformAdmin({ fresh: true })`), a reason and an elapsed window. It runs `performAccountDeletion` (`utils/account-deletion.ts`), which a cron can call later.

## What the procedure does (no migration)
The User row stays as the tombstone: email becomes `deleted-<id>@deleted.outclass.invalid`, `disabledAt` is set, and the Supabase Auth user is deleted. Every User relation is mapped in `userRelationDeletionPlan` (`lib/account-deletion.ts`); `tests/account-deletion.test.cjs` fails if the schema gains an unmapped one.

- **Deleted:** StudentProfile (+ experiences), résumé/headshot/attachment objects under `<userId>/` in `resumes` and `headshots`, task submissions and their `task-submissions` objects, RSVPs, saved events/clubs, tutorials, availability, drafts, calendar feed token, notifications, email deliveries, preferences, private club conversations, recipient-group entries, pending club claims, admin challenges, inactive admin grant. There are no push-subscription tables on `main`.
- **Withdrawn:** in-progress applications with no club records depending on them.
- **Anonymized:** other applications keep the row and lose their answers and anonymous-review text. Memberships with evaluations, interview records, panel assignments, annotations, ballots or overrides become `LEFT` with roles, permissions, titles and groups cleared; the rest are deleted. Decided claims lose their explanation. Club tasks and roster-row matches are unlinked.
- **Retained, pointing at the tombstone:** attendance, ballots (through the member row), decisions/letters, audit logs, reports, announcements and messages sent for a club, invitations sent, roster imports, panel and scheduling history.

Each step is idempotent. Storage removal and the Auth deletion are outside the DB transaction, so an interrupted run leaves the request `INVESTIGATING` and is finished by running it again.

## What needs a migration (not done)
- **SchoolIdentity.userId**: `outclass_school_identity_guard` forbids unlinking verified ownership. A migration must allow `userId → NULL` when the User is a tombstone (or add a `deletedAt` on User the guard can check).
- **Personal data in immutable or retained rows**: `RosterImportRow.input` (immutable by trigger), `ClubInvitation.email`/`invitedName` addressed to the person, `SchoolIdentity.identifier`, `PlatformReport.summary` text they wrote, `ClubMessage.body` they sent for a club. Scrubbing these needs trigger changes or new nullable columns.
- **A true tombstone**: Restrict FKs from authored club records (ApplicantObservation, ClubAnnouncement, ClubMessage, panel/schedule history, InvitationDelivery, RosterImport and others) block deleting the User row. A shared tombstone user, or nullable FKs, would let the row itself go.
- **Request model**: the request reuses `PlatformReport`. A dedicated `AccountDeletionRequest` table would let a cron query due requests directly.

## Not verified here
Real Storage, Auth admin and SMTP calls, and DB triggers on a disposable database. The unit tests mock them.
