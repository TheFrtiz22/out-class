# Club onboarding database foundation

`20261001010000_club_onboarding` extends the existing Club architecture. Apply it
through the **Prisma migration history**, following `database-deployment.md` and
the existing reconciliation runbook. Supabase CLI migration replay stays disabled.
No connected database was changed while developing this foundation.

## Structures and compatibility

- `School` and `SchoolIdentifierType` define institutional identity namespaces.
  Types have a normalization rule, optional validation expression, and an explicit
  verification adapter. UVA's email-local-part mapping is the only seeded adapter.
  Other existing campus keys receive School records without guessed mappings.
- `SchoolIdentity` uniquely identifies `(schoolId, identifierTypeId,
  normalizedIdentifier)`. Its User link remains null until server verification.
  Identity keys and verified ownership cannot be reassigned through ordinary
  updates. No invitation or roster upload creates a recipient User.
- `Club.schoolId` links organizations to schools. Existing campus keys, IDs,
  profiles, slugs, membership roles, and permissions are retained.
- `ClubMember` adds `accessRole`, `status`, `joinedAt`, and `updatedAt`. Legacy
  `role` is retained. Stored capabilities and `isOwner` remain authoritative;
  access roles are membership-local templates. Existing memberships become
  ACTIVE without changing capabilities. Existing rows have no historical join
  date available, so their new joinedAt records migration time, not an inferred
  historical date. New memberships record their actual creation time.
- `ClubInvitation` adds school identity, name/year snapshots, intended role,
  purpose, source of authority, explicit state, claimed user/time, dismissal,
  expiry time, and update time. Its existing email is a delivery address and is
  never sufficient proof for an identity-bound invitation.
- `RosterImport` records uploader, club, filename, payload hash, idempotency key,
  processing state, counts, and timestamps. `RosterImportRow` retains each raw
  input object, row number, metadata, processing status/errors, optional identity
  and account match, and resulting invitation. Original input and upload
  provenance are immutable. Year is supplied text; it does not overwrite an
  academic profile or imply a graduation year.
- `InvitationDelivery` is the durable delivery/outbox foundation: recipient,
  requester, idempotency key, template version, state, provider ID, attempts,
  retry time, and delivery/failure timestamps. No email sender or worker is
  enabled by this change. A resend should create another delivery record.

Existing accepted/declined/revoked/expired invitations are backfilled from their
timestamps. Recipient attribution is backfilled only when exactly one normalized
email matches an existing User. Legacy email-bound links remain supported;
their identity FK stays null, and their historical duplicates are not deleted or
silently merged. New identity-bound invitations have one PENDING record per club
and recipient identity. An incompatible pending grant must be revoked and reissued.

The existing `(userId, clubId)` membership uniqueness is intentionally retained.
It is stronger than active-only uniqueness and preserves one membership history
per organization. Inactive membership reactivation must be explicit; acceptance
does not silently reactivate a suspended or departed member.

## Authorization and RLS

All new tables, ClubInvitation, and ClubMember have RLS enabled, browser-role
CRUD revoked, and a restrictive `outclass_onboarding_server_only` policy with
`USING (false)` / `WITH CHECK (false)`. No direct PostgREST invitation-read policy
is introduced. Recipients and managers read through authenticated server actions,
as with existing application tables. This also prevents a later permissive
policy from accidentally opening browser access. Existing policies are retained.

The trusted Prisma connection continues to bypass/own application-table RLS.
RLS is not a substitute for its server authorization. Domain checks include:

- Platform invitations use the existing allowlist, active PlatformAdmin grant,
  and MFA guard. Acceptance rechecks the inviter's active account, current grant,
  and server allowlist; recipient acceptance does not require the inviter to have
  a club membership or an ongoing interactive MFA session.
- Ordinary member invitations require members.manage or leaders.manage.
  Elevated grants require leaders.manage and possession of every capability.
  Owner invitations require ownership or platform authority. ADMIN never grants
  ownership merely by its role label or capability template.
- Roster recording/retrieval requires current members.manage access. The database
  independently checks uploader membership, capability, and account availability.
- Identity verification consumes requireAuth({verifyEmail:true}) results, checks
  provider identity/email/confirmation, rejects verification-skipped accounts,
  and uses only explicitly configured institutional mappings. Client inputs
  cannot claim or move a school identity.
- Invitation acceptance locks the club, verifies the recipient identity, checks
  expiry and current inviter authority, upserts the unique membership, and records
  recipient/time and an AuditLog entry atomically. Database guards independently
  enforce the matching verified identity, active membership, grant authority, and
  cross-school consistency. Environment allowlisting/MFA are server checks; SQL
  alone cannot validate an interactive Supabase session.
- Membership status is checked in central capabilities/membership guards and
  private meeting/task access. Inactive memberships cannot retain ownership or
  capabilities. Last-owner removal/demotion is also blocked in the database.

New actions live in `actions/club-onboarding.ts`; verified identity and acceptance
helpers live under `utils/`. Existing invitation links delegate identity-bound
acceptance/decline to those helpers and filter details by verified identity.
All new business mutations write to the existing append-only AuditLog; existing
support-session attribution remains in effect.

## Invitation states and dismissal

PENDING can transition to ACCEPTED, DECLINED, REVOKED, or EXPIRED. Terminal states
cannot be reopened or reassigned. Timestamp synchronization keeps existing
invitation actions compatible. Expired requests are filtered at read/response
time; creation expires stale pending rows transactionally before deduplication.
A future maintenance worker can persist expirations proactively.

Dismissal changes only dismissedAt. Dashboard discovery excludes dismissed rows;
Settings discovery calls `getOrganizationInvitations(true)` and includes them.
Restoration clears dismissedAt. Neither changes membership or invitation state.
The eventual Settings/dashboard UI and pagination are separate implementation work.

## Local validation and deployment limitations

The full committed migration stack is applied in isolated PGlite PostgreSQL tests,
including a populated pre-onboarding database. Tests cover preservation, multi-school
normalization/uniqueness, foreign identities, terminal states, ownership protections,
roster provenance, delivery idempotency, and restrictive-policy coexistence.
Server tests cover verified matching, grant restrictions, dismissal/recovery,
permission preservation, revoked authority, and import audit idempotency.

Prisma Client is regenerated from the schema. `supabase-audit/database.types.ts`
remains an audit snapshot and is not the app's generated runtime type source.
`supabase db reset` is inappropriate: this repository disables Supabase migration
replay and reset would not apply this application stack. No reset/deploy command
was run against configured local or production Supabase services.

Future-school data structures are supported, but the current application login
gate and Auth creation trigger still enforce UVA. Opening another institution
requires a separately tested authentication adapter and review of the legacy
StudentProfile computingId uniqueness. Do not treat a delivery domain as a universal
identifier mapping. Identifier validation expressions must be reviewed for both
PostgreSQL and JavaScript compatibility before provisioning a new type.

Before deployment, reconcile the actual Supabase schema and migration history,
rehearse on restored staging, and perform real Auth/MFA/token smoke tests. PGlite
validation does not establish the configured production database's current state.
