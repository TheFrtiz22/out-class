# Recruitment decisions and club offers

## Canonical records

`Application` remains the recruitment record. `ClubInvitation` is the durable
membership offer; `ClubMember` remains the only membership model. No notification
or announcement delivery system is introduced.

An optional, unique `ClubInvitation.applicationId` links an offer to its source.
The composite application/club foreign key prevents cross-club association; a
check constraint limits linked invitations to member-level membership invitations
with no permissions. The existing invitation had no application link, so this
small additive migration is necessary for durable association and database-backed
idempotency. Existing applications, memberships and invitations are retained.
There is no automatic backfill of historical accepted decisions. Publishing an
accepted decision again through the canonical command can ensure its offer.

## Commands and transition policy

Direct CRM decisions, voting publication and the existing Platform Admin status
editor use `publishRecruitmentDecision` inside their authorized transaction.
An acceptance ensures one invitation per application, valid for 30 days. Repeated
publication does not duplicate it or reset declined/revoked/expired offers.
Voting publication retries return success only for the same sealed selection and
still require current permissions. First publication retains strict snapshot checks.

Accepted, rejected and waitlisted applications are final. Ordinary round moves
and active-status assignments cannot reopen them. This batch deliberately does
not support application reopening. Correcting one final decision to another is
allowed and audited. Reopening an unpublished voting *session* does not reopen
an application. Draft submission retains its existing command and policy.

Interviewing requires an INTERVIEW or GROUP_INTERVIEW round. Moving an active
interview applicant to another kind of round returns the application to IN_REVIEW.
Pipeline edits cannot change an occupied interview round to an incompatible type.

Reversing acceptance revokes a pending offer in the same transaction. Accepted
and declined invitations remain historical. Decision corrections never remove,
suspend or downgrade membership. Use existing member management for that.
A leader with decisions.manage and applicants.identify can explicitly rescind a
pending offer in the applicant panel; accepted offers require member management.
There is no automatic offer reissue after decline, revocation or expiry.

## Student response and membership

Status detail offers Accept Offer / Decline Offer only for a valid pending offer
on an accepted application. Pending offers also appear under Needs attention.
Accepted offers show a confirmation and My Clubs path; declined, revoked and
expired offers have no active controls. Internal invitation identifiers are not
rendered. Historical acceptances without an offer retain club-contact guidance.

The server obtains the effective user from existing authenticated, verified-email
policy and binds the recipient to Application.studentId, never to a supplied email.
Legacy email invitation endpoints dispatch linked invitations to this same command;
identity-invitation endpoints cannot accept linked offers through their grant path.

All decision/offer commands acquire the existing Club row serialization lock,
recheck operational status, then read current records. Membership management and
club suspension use the same lock. The unique application offer and user/club
membership constraints provide additional protection. Student account disablement
is rechecked under a user lock. Existing impersonation and support audit context
remain in effect; Admin authentication/elevation is unchanged.

Acceptance creates an ordinary ACTIVE / MEMBER / GENERAL_MEMBER ClubMember with
empty permissions, no ownership and no interview offices. An active existing
membership is left entirely unchanged. LEFT and SUSPENDED memberships cannot be reactivated through recruitment, even
when an offer postdates removal. Reinstatement requires separate member management. Retrying an already accepted offer never reactivates subsequently
removed or suspended membership. Decline creates no membership and leaves the
accepted application decision intact.

The club-issued offer is durable authority for member access: acceptance does not
require that the original publishing leader still holds their role. Current club
leadership can rescind pending offers. This differs intentionally from invitations
which delegate leadership permissions and recheck the inviter's grant authority.

Audit events `offer.created`, `offer.accepted`, `offer.declined`, `offer.revoked`
provide the future communication boundary. Decision changes also record previous
and new status in `recruitment.decision.published`. Existing caller audits remain.

## Demo and verification

Demo uses fictional, persisted invitation-equivalent state, the same transition
policy, and a shared Demo decision helper for direct and voting publication. It
includes a pending offer to a nonmember and an existing-member example. MII's
leader persona is retained; other clubs retain the student persona. Demo adapters
never invoke live mutation actions.

Run focused tests with:

    node --test tests/recruitment-offers.test.cjs tests/durable-voting.test.cjs tests/demo-mode.test.cjs

Native tests require an explicitly configured localhost database named
`outclass_recruitment_test`, with all Prisma migrations deployed:

    OUTCLASS_RECRUITMENT_TEST_DATABASE_URL=postgresql://…@127.0.0.1:PORT/outclass_recruitment_test node --test tests/recruitment-offers-native.test.cjs tests/recruitment-native.test.cjs

The native offer test intentionally leaves synthetic fixtures for inspection in
that disposable database. It never reads the application's DATABASE_URL. Do not
point it at production or staging. Native scenarios exercise production actions,
real transactions, parallel publication/acceptance and accept-versus-revoke races.

## Final hardening

Round retirement treats ACCEPTED, REJECTED and WAITLISTED consistently. Referenced
rounds are archived, retaining application pointers and immutable evaluations.
Voting publication reuses transactional club authorization, locking/rechecking the
effective account and live membership before either initial publication or retry.

Lock ordering is Club UPDATE, then actor/recipient User, then ClubMember where
needed, then voting session/application/invitation writes. No nested transaction is
introduced. Membership management uses the same Club lock before its user and
membership operations. Account disablement is held off by the User SHARE lock.

All recruitment-capable legacy invitation revocations use revokeClubInvitations
under that Club lock. Canonical offer.revoked contains actor, club, application,
student and reason; ordinary invitation audit behavior is retained. Identical
CRM decision retries omit club.decision.update; actual transitions retain it.
