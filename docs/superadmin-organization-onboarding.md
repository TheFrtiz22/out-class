# Superadmin organization onboarding

Open `/platform`, choose **Clubs**, then **Create organization & invite president**.
The form loads configured schools and collects organization name, president name,
university identifier, graduation year, and an audit reason. Its submission button
confirms the specific organization/initial-owner operation; existing generic
platform management forms retain their APPLY confirmation behavior.

The page, school-options read, and creation action use the existing platform
administrator guard: real authenticated account, UUID allowlist, active database
grant, MFA AAL2, and no active impersonation. Client visibility confers no authority.
No separate admin application, admin-role shortcut, or new database migration is
introduced. The database foundation must be deployed before using the workflow.

`actions/platform-organization-onboarding.ts` creates the Club, reserved
SchoolIdentity if needed, OWNER ClubInvitation, and audit events in one transaction.
Existing club branding fields receive neutral defaults; no recruitment rounds,
statistics, memberships, or public-profile claims are fabricated. The organization
remains unclaimed until the designated president accepts through the existing
identity-bound invitation flow. New recipients never receive placeholder Users.

Input validation is shared with the form and repeated server-side. Names are
normalized for spacing/Unicode; computing IDs use the school's explicit mapping.
UVA computing IDs are lowercase letters/digits beginning with a letter, excluding
email addresses and aliases. Other schools can supply their own configured rules.
Graduation year is a four-digit year between 2000 and 2100.

Verified, already-bound school identities are reused. When only an OutClass email
match exists, its ID is recorded as advisory audit metadata; no verification or
ownership is inferred. The identity becomes bound through verified authentication,
and the invitation's claimedUserId remains null until acceptance. Suspended and
ambiguous email matches require account review before onboarding.

The workflow serializes creation by school and mapping, checks existing school
organization names after canonicalization, and uses deterministic unique slugs.
The existing database pending-invitation index remains in force. A form-specific
request UUID and audited payload fingerprint recover a committed result after
double submission or a lost response. Reusing that key with changed details fails.
Legacy generic Club creation remains available; differently named aliases still
require operator review rather than speculative merging.

The UI disables inputs while loading/saving, reports field and server errors,
preserves retry identity after a transport failure, and displays the created
organization, president identifier, invitation status, and shareable link.
Creation does **not send email** or enqueue a delivery. The returned invitation ID
is the integration point for a future InvitationDelivery worker after commit.

Tests run the server action against the complete isolated PGlite migration stack
and exercise the real platform authorization guard, unauthorized requests, valid
creation, normalized duplicates, retry/invitation deduplication, existing and new
accounts, malformed identifiers, and audit-failure rollback. Component tests cover
loading, saving, errors, retries, and truthful success messaging. Real Supabase MFA
and authenticated browser smoke tests remain staging checks; no connected Supabase
records or production settings are changed by local validation.
