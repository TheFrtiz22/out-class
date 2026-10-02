# Organization member management

The existing club workspace Members route renders `OrganizationMemberManagement`
through `ClubMembers`. Demo Mode keeps the existing fictional directory. Live
member details retain groups, cohort editing, and advanced custom capabilities.
The directory displays member/year/organization role/status, pending invitations,
and optional invitation history, with search and 50-row pagination.

## Authorization

`lib/organization-authorization.ts` is the shared capability and delegation layer.
It reuses `lib/permissions.ts` and the authoritative onboarding role templates:

| Role | Default capabilities | Ownership authority |
| --- | --- | --- |
| OWNER | All club capabilities | Grant owners, intentional transfer |
| ADMIN | All club capabilities | Cannot grant or change owners |
| RECRUITING_ADMIN | Recruiting, reviews, identified applicants, interviews, decisions, meetings, attendance | None |
| INTERVIEWER | Reviews and identified applicants | None |
| MEMBER | None | None |

Roles belong to ClubMember, never the global User. Stored capabilities remain
mandatory for authorization; custom grants do not become permissions merely
because a role label exists. The shared layer exposes canManageMembers,
canManageRecruiting, canManageInterviews, canManageOrganization, canChangeRoles,
and canTransferOwnership. Delegation checks also compare the target's current
capabilities and proposed grants against the actor's authority. Targets with capabilities the actor does not possess remain protected.

`actions/organization-members.ts` authenticates each call and reloads the actor
and organization-scoped targets inside a transaction locking the Club row. This
uses the same lock as invitation acceptance and legacy access operations. The
existing database ownership trigger remains authoritative and RLS is unchanged.
No schema or migration changes are required.

## Membership lifecycle

Role changes replace custom capabilities with the selected role's defaults; the
UI explicitly confirms this. Legacy advanced access updates keep role templates
and ownership labels synchronized. Removed members become LEFT with no ownership
or capabilities, retaining their record and interview/evaluation references.
Outstanding recipient grants are revoked and queued email requests cancelled so
stale invitations cannot restore access after removal or demotion.

The last active owner with an enabled account cannot be removed or demoted.
Transfer requires an owner, an explicit confirmation, and another active enabled
non-owner member in the same organization. The target receives ownership before
the actor becomes ADMIN in the same transaction. Other owners remain unchanged.
All changes include audit records; audit failure rolls back the transaction.

A removed member can rejoin only by accepting a currently authorized invitation
created after removal. Suspended members and invitations predating removal remain
blocked. Rejoining reuses the unique membership record and records a new joinedAt.

## Invitations and additional CSV imports

Manual addition delegates to existing school-identity invitation creation: school
configuration normalizes identifiers and validates format, no fake User is created,
and already-active membership or conflicting pending grants prevent duplication.
The form excludes unsupported school mappings and cannot accept platform authority
or custom capability fields. Invitations require recipient acceptance.

Additional CSV uploads reuse the additive importer and default MEMBER role.
Successful completion refreshes the directory without repeating the import.

Revoke and resend revalidate the current actor, invitation scope/state, role, and
capabilities server-side. Resend creates a durable InvitationDelivery QUEUED record,
with repeated requests coalesced under the organization lock and a one-minute
cooldown for recently completed deliveries. Revocation cancels queued deliveries.
Expired invitations must be revoked and replaced; terminal states cannot resend.

**Email sending is not configured.** The UI explicitly says that resend is queued
and offers the existing identity-verified invitation link. A future delivery worker
must revalidate invitation state, expiry, recipient, and original grant authority
before sending; queued status must never be presented as sent.

## Validation

`organization-members.test.cjs` covers authority boundaries, invalid/scoped inputs,
role changes, soft removal, last-owner protection, concurrent owner demotions,
intentional transfer/replay, transaction rollback, and resend idempotency/state.
`organization-members-database.test.cjs` runs real server actions against all
repository migrations in PGlite, including ownership constraints, transfer rollback,
role synchronization, outbox cancellation, and retained membership records.
UI tests cover table fields, controls, owner restrictions, confirmation, duplicate
clicks, loading/error recovery, and unsaved-change protection. The existing claiming
and CSV suites cover duplicate active members and authorized rejoining semantics.
