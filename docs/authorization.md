# Identity, club capabilities, and platform administration

## One identity, contextual workspaces

Supabase Auth owns the login. `User.id` remains the Supabase user ID. Every account retains its personal/student profile and applications while belonging to any number of clubs. No student or club-leader account conversion occurs.

`User.role` and `ClubMember.role` remain for data compatibility and historical titles. **Neither grants authorization.** Club workspaces are derived from database memberships with capabilities or ownership. The account menu lists Personal / Student and each available club. Switching changes the selected club, not cookies, login, profile, or identity. Current permissions are reloaded on every protected server operation; hiding a control is not authorization.

## Capabilities

`lib/permissions.ts` is the shared vocabulary. `utils/auth.ts` enforces server access through `requireClubPermission`. Owners have all club capabilities. Everyone else receives an explicit set; missing/empty means no management access.

| Capability | Enforcement / behavior |
| --- | --- |
| `club.settings` | Save club name, tagline, description |
| `members.manage` | List/add ordinary members; remove only ordinary members without review history |
| `meetings.manage` | Create official meetings/events |
| `meetings.attendance` | Read attendance identities within that club |
| `tasks.manage` | Create/edit club tasks and projects; see assignment progress; review submissions. Members independently access their own assigned work. |
| `recruitment.manage` | Move an applicant between that club's rounds |
| `applications.review` | Save a reviewer’s evaluation |
| `applicants.identify` | Read identified applicant records, answers, evaluations and pipeline/search results |
| `interviews.manage` | Create interview slots |
| `decisions.manage` | Issue actual application decisions, independent of historical president title |
| `decisions.vote` | Reserved capability for a future persisted ballot service; local voting previews are not authoritative ballots |
| `leaders.manage` | Invite, revoke invitations, and edit workspace capabilities |

Evaluation, applicant moves and final decisions also require `applicants.identify`: the current interfaces expose identity and free-text responses. Granting a workflow capability alone does not silently grant identity access. Templates are optional checkbox starting points, not authorization roles. Interview workspace requires review and identity access; slot administration independently requires interview-management access.

### Access sharing

`/club-access/[clubId]` lists members and pending invitations. Invitations are bound to an exact UVA email, expire after seven days, and are accepted at `/invitations/[id]` after authentication. The ID is not a bearer credential: acceptance verifies the signed-in email, current inviter permissions, expiration and revocation. Acceptance adds capabilities without stripping existing access. Share the generated link manually; no email delivery is pretended.

A delegated access manager cannot grant capabilities they do not possess, edit higher-authority memberships, or appoint/remove owners. Only an owner can appoint another owner. Club-row locks serialize access changes and the last-owner check. The last owner cannot be demoted. Editing a membership’s access also revokes outstanding invitations for that account/club, so old links cannot restore revoked capabilities. Clubs with no historical president remain without an owner until a platform administrator resolves ownership; the migration never guesses.

Removing a reviewer membership would cascade evaluation history in the legacy schema, so the UI/action refuses that deletion. Revoke capabilities while retaining historical reviewer identity instead. All access/invitation changes, membership changes, profile settings, task writes and CRM round/decision mutations are audited. Sensitive changes and their audit entry commit together.

## Separate platform administration

`/platform/login` authenticates the account with Supabase password + TOTP (including enrollment if necessary). `/platform` and **every** platform action require all of:

1. A real active UVA account verified by Supabase; demo sessions are refused.
2. Its exact user UUID in server-only `OUTCLASS_PLATFORM_ADMIN_IDS` (comma-separated).
3. An active `PlatformAdmin` database grant for that UUID.
4. An authenticated `aal2` session (MFA).

There is no client/profile/admin-role shortcut, no email-based auto-grant, and no grant-management API. Provision the first grant out of band through your trusted database administration process:

```sql
INSERT INTO "PlatformAdmin" ("userId", "active") VALUES ('ACTUAL_SUPABASE_USER_UUID', true);
```

The user must already exist. Set the same UUID in the server allowlist and redeploy. Configure Supabase TOTP support and require email confirmation before rollout. Disable the optional unverified-signup configuration in production when relying on email-bound invitations. Revoke either the database grant or the environment allowlist to deny future access. No admin was provisioned by this change.

The console provides paginated records and strictly validated, reason-required operations for users (suspension), clubs, ownership claims, memberships/capabilities, recruitment rounds/questions/interview slots, applications, meetings, tasks, and platform/example content. It deliberately does not expose arbitrary SQL, password hashes, auth tokens, destructive bulk deletion, or arbitrary model updates. Round names cannot be changed because historical evaluations reference names.

Read-only user inspection is the safe view-as implementation: it audits actor, target and reason, then returns an authorized snapshot. It **never** creates another user's token or changes the current identity. Writable impersonation is not enabled.

Operation examples (substitute actual IDs):

```json
{"kind":"user","id":"USER_UUID","disabled":true}
{"kind":"membership","clubId":"CLUB_UUID","userId":"USER_UUID","isOwner":false,"permissions":["applications.review","applicants.identify"]}
{"kind":"claim","id":"CLAIM_UUID","approved":true}
{"kind":"round","clubId":"CLUB_UUID","name":"Interview","order":3}
{"kind":"application","id":"APPLICATION_UUID","expectedStatus":"INTERVIEWING","status":"ACCEPTED"}
{"kind":"meeting","clubId":"CLUB_UUID","title":"Interest meeting","date":"2026-10-01T22:00:00Z","location":"On Grounds","isPublic":true}
{"kind":"task","clubId":"CLUB_UUID","title":"Review applications","description":"Complete first-round reviews","status":"OPEN"}
{"kind":"content","key":"operations.notice","value":{"text":"Example notice"}}
```

Club operations also accept optional existing `id`, plus `name`, URL-safe `slug`, `tagline`, `description`, `category`, and hex `color`. Content key `demo.seed` is consumed only by authorized demo sessions; its value must be a complete valid fictional demo snapshot, with MII first. The server-action body limit is 4 MB to accommodate the validated ~2.6 MB template. New presentations/reset use it; existing browser edits survive until Reset Demo. Other content keys are an administrative registry, not automatically injected into public UI.

Audit reads, user inspection and changes are logged with actor, target, action and time; mutations include justification and validated operation fields. An append-only database trigger rejects ordinary UPDATE/DELETE of audit rows. Database owners can still alter schema; infrastructure-level access and external audit retention remain operational responsibilities.

## Database migration and rollout

No data/account IDs are renamed or deleted. Additions include explicit capability arrays, ownership flags, account suspension, admin grants, invitations, claims, tasks, content, and audit records. Legacy role values remain untouched.

The repository previously had no migration history. Two migrations are supplied:

- `20260923000000_baseline`: the pre-change schema, for fresh databases or existing-schema baselining.
- `20260923010000_capabilities`: additive extension, access backfills and protection.

Backfill: presidents become club owners; recruitment leads retain recruitment/review/identified-applicant/interview/event access and gain a manager-oriented initial bundle; general members retain review, identity and attendance access previously provided by server actions. No existing user becomes a platform admin. New memberships default to no capabilities. Adjust grants using workspace access after migration.

**Existing databases:** take a backup, compare the actual schema to the baseline, and reconcile drift before marking the baseline applied. Do not execute the baseline's CREATE TABLE statements on an existing installation. With a verified matching schema:

```sh
npx prisma migrate resolve --applied 20260923000000_baseline
npx prisma migrate deploy
npx prisma generate
```

**Fresh databases:** `npx prisma migrate deploy` applies both migrations, then generate the client. Deploy the database extension before the application requiring these columns. PostgreSQL transactions make the additive migration atomic; test on staging first. Do not use `db push --accept-data-loss`.

All Prisma tables enable RLS and revoke direct `anon`/`authenticated` table access. This application uses Prisma server actions for those tables; existing browser Supabase calls are Auth and Storage, which are untouched. `DATABASE_URL` must use a trusted server database role with table access/RLS bypass, never the browser `anon`/`authenticated` roles. Review any external PostgREST integrations before rollout. Existing Supabase auth triggers remain separately configured.

Live migration deployment was attempted but could not run because `DATABASE_URL` is absent in this workspace. Both migrations were applied to isolated PostgreSQL (PGlite), with seeded legacy identities/memberships; IDs, legacy roles, capability backfills, absence of automatic platform grants and append-only audit enforcement were verified. This does not substitute for testing the actual Supabase deployment/roles/MFA.

## Demo identity

The demo always uses the same fictional student identity, regardless of workspace. That student manages **MII only**, through the ordinary account workspace switcher. Other sample clubs remain discoverable/applicable but cannot be managed. Old saved presentations are upgraded on hydration without deleting application/review data; an old non-MII management perspective returns to Personal. Normal demo entry still requires the server allowlist and verified account. No demo role grants server permissions, and `requireAuth` rejects live action access while the demo cookie is set, in addition to middleware blocking.

## Explicit boundaries

- Claim submission is an authenticated server action; platform administrators approve/reject claims. No automatic ownership verification or fabricated external proof.
- Invitations are shareable links, not sent emails.
- Tasks have basic club-scoped workflow; project hierarchies are not invented.
- Existing scheduling builders/broadcast tools and multi-device voting remain their documented previews. Their presence does not grant production authority.
- Platform user suspension blocks application access; it does not delete a Supabase identity. Email/password changes remain Supabase account-management operations.
- Management tools may require both an operational capability and identity access where existing data cannot be safely anonymized.

To repeat the isolated PostgreSQL check, make `@electric-sql/pglite` available in an external test environment and run `NODE_PATH=/path/to/test/node_modules node tests/authorization-migration.cjs`. The application has no new PGlite runtime dependency.

Semester work and private-file deployment are documented in [tasks.md](tasks.md). Membership group/cohort labels require `members.manage`; those labels never grant authorization.
