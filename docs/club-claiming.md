# Club directory and claiming

Apply `20260924000000_club_claims` after the authorization migrations (see `authorization.md` for existing-database baseline instructions). Existing owners remain owners and their clubs are backfilled as claimed. No existing profile content, applications, memberships, or identity records are replaced.

The migration preloads three basic UVA listings: McIntire Investment Institute, Virginia Venture Fund, and Alternative Investment Fund. Names are backed by the linked organization/UVA sources stored in `directorySource`. No acceptance rates, financial statistics, deadlines, endorsements, or recruitment rounds are seeded. This is a starter directory, not a complete UVA inventory.

Preload reconciliation checks stable slug, ID, full normalized name, abbreviated name, and full-name slug before inserting. It never merges or deletes ambiguous existing records. Unusual existing aliases should be reconciled manually before importing additional entries. Future campus ingestion should supply a campus key, stable source identifier/slug, source URL, reviewed aliases, and an idempotent reconciliation step. Global slugs remain compatible with current URLs; use campus-prefixed slugs for future campuses.

`Club.claimedAt` records management provenance; `campusKey` defaults to `uva`; `directorySource` retains the source even after claiming. Public responses expose these fields but never claim evidence. Basic unclaimed profiles remain discoverable. Existing application behavior is unchanged.

Students open **Claim this club** from a persisted club profile, sign in with their UVA account, and submit their role plus textual evidence/links. A pending request grants no privileges. Repeated pending submissions reuse the request. `/platform/claims` provides paginated pending/approved/rejected queues, claimant identity, evidence, review rationale, and audit history. Existing platform allowlist, database grant, and MFA requirements apply.

Approval locks the club, checks that it is still unclaimed and the claimant is active, and atomically marks the claim approved, marks the club claimed, grants ownership to the existing account, and appends the audit entry. Competing claims cannot grant another owner after approval. Rejection grants nothing. A user returns to/reloads OutClass to refresh their workspace list. Other pending requests remain available for explicit admin rejection; no evidence is deleted.

Owners/managers with `leaders.manage` can invite by UVA email and assign capabilities. Invitations are shared links, not automated email. Recipients see the club and granted capabilities before accepting or declining. Decline is persisted, audited, and terminal. Expired, revoked, answered, or wrong-account links cannot be used. Acceptance merges permissions into the existing membership without creating an account. Management access can be edited or revoked without removing student identity or ordinary club membership; last-owner protections remain enforced.

Demo mode cannot submit real claims or accept real invitations. Demo UI continues using fictional data; no live club ownership is inferred from it.

Validation includes action authorization/ownership regressions and isolated PostgreSQL checks for owner backfill, profile preservation, duplicate prevention, and absence of seeded statistics. Real Supabase sign-in/MFA and live migration require deployment credentials.

Sources reviewed for the starter directory:
- https://mcintireinvestmentinstitute.org/
- https://economics.virginia.edu/business-consulting-and-finance-clubs
- https://atuva.student.virginia.edu/organization/alternativeinvestmentfundatmcintire

## Designated-owner invitations and first login

Superadmin-designated presidents use the identity-bound onboarding invitations,
not evidence-based directory claims. After a real sign-in, the student dashboard
and authenticated profile wizard discover pending invitations through
`getOrganizationInvitations`. `verifiedSchoolIdentities` derives the identifier
from the verified provider account, applies the configured school normalization,
and binds the reserved identity to that user. This association uses
`SchoolIdentity.userId`; `ClubInvitation.claimedUserId` stays empty until acceptance.
No recipient User or membership is created by discovery.

Ownership requests explain the management access and offer **Claim organization**.
The invitation link presents the same claiming behavior. The server's existing
`acceptIdentityClubInvitation` and transaction helper revalidate identity, status,
expiry, and current inviter authority after locking the organization. Membership
upsert, owner grant, organization claim timestamp, invitation acceptance, recipient
attribution, and audit entry commit together. Existing active membership access is
preserved; inactive memberships require owner intervention. Replays fail without
a second grant. Success reloads the existing `/club/[clubId]/workspace` route.

The profile wizard can suggest a name and supported graduation year from matched
invitations. Suggestions fill only untouched blank fields and never save a profile
automatically. Existing login, school adapters, directory claims, and dismiss/restore
semantics remain unchanged. Discovery excludes dashboard-dismissed requests; the
existing server API's `includeDismissed` option remains available for Settings recovery.
No email delivery or database migration is introduced here.

Tests exercise server identity matching, terminal invitations, replay, existing
memberships, concurrent callers, UI loading/error/retry/navigation, and SQL rollback
against all migrations. PGlite serializes transactions; these tests do not substitute
for multi-connection PostgreSQL locking and live Supabase authentication smoke tests.
