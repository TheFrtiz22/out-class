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
