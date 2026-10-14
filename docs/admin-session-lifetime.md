# Session-bound Admin elevation

Branch: `repair/workspace-reliability`.
Fetched main/base: `ce2c0141291bcb0b8683b8a3a94ad5db62c6d746`; no intervening main changes at checkpoint.
The reviewed 28-file reliability batch was committed separately as
`e31d3257a97b028629f94278beb53eeab8b9a8fb` (`fix: stabilize workspace polling and authorized publication flows`).
This Admin change remains uncommitted and unstaged.

## Behavior and authorization

New password + authenticator verification creates an AdminElevation with nullable
`expiresAt = NULL`. This means session-bound access, with no fixed application
absolute age limit and no application idle timer. The opaque elevation cookie is
HttpOnly, SameSite=Strict, Secure in production, and a browser-session cookie
without maxAge or expires. Browser session restoration can restore session
cookies; closing a browser is not a dependable substitute for explicit logout.
No Admin countdown existed; the login copy is updated and the Admin shell links
to normal verification for sensitive actions.

Every Admin request still checks the configured ID allowlist, active PlatformAdmin
grant, enabled account, AAL2, elevation token hash, actor and provider session
binding, revocation, verification timestamp ordering, and a live auth.sessions
record with an unexpired not_after if configured. Explicit elevation end and
logout still revoke records and clear cookies. Provider sign-out/session deletion
fails closed even with captured JWT/elevation cookies. Provider access-token
refresh must retain the same session ID. Provider session time-box/inactivity,
refresh expiration and authentication failures continue to govern access; this
change neither modifies nor asserts the deployed provider timeout configuration.

Sensitive actions separately require password verification within five minutes,
followed by MFA no later than the current time. The five-minute window is a
step-up requirement, not an Admin session maximum: ordinary pages/directory reads
remain authorized after an hour. It covers Admin mutations, private inspections,
Admin asset operations, platform invitation/onboarding operations and starting a
support session. The transactional Admin guard repeats this freshness check.
Stale verification denies the operation before writes; normal /platform/login
password + MFA verification mints a new elevation and revokes prior elevations.

Existing support impersonation remains separately bounded to 30 minutes, with
its existing reason/confirmation, target restrictions, actor/effective-user
attribution, support-session ID, revocation and transaction-time authorization.
Ongoing support does not require repeating the five-minute step-up and does not
extend its own expiry. Transaction SQL now accepts NULL Admin elevation expiry
while retaining the independent mandatory support expiry and live provider,
actor/target/grant/allowlist checks. No audit or role privileges are changed.

## Migration and existing sessions

New migration: `20261012171752_admin_session_bound_elevation`.
It removes the historical 30-minute expiry CHECK, permits nullable AdminElevation
expiresAt, and retains a positive-deadline CHECK for non-null values. It does not
change challenges, support-session deadlines, ownership, grants or restrictive
RLS. Existing records, revocations and deadlines are unchanged. Existing browser
cookies retain their old expiration; a normal fresh password + MFA login opts
into the new session-bound behavior. Previously expired/revoked sessions are not
revived. Challenge expiry remains five minutes.

For a future authorized rollout, apply this additive migration before code that
inserts NULL expiry. Old code is compatible with the additive schema while it
continues writing deadlines. Rolling back old code after new elevations exist
fails closed for their NULL expiries and requires reauthentication; retain the
additive migration. No production or staging migration has been applied here.

## Verification rerun for this diff

- Focused Admin/elevation/diagnostics/workspace/clubs/support checks: 79 passed.
- Full suite: 1,005 passed, 15 gated skips, zero failures (1,020 total).
- Dedicated native PostgreSQL: 31 repair checks and 26 existing offer/communications
  checks passed, including aged NULL-expiry Admin elevation, independent support
  expiry, transactional rollback, revocation, isolation and audit attribution.
- Real local Auth + production-build HTTP session integration: 12 passed,
  zero skipped. Covers AAL1 denial, normal password/MFA upgrade, server renders,
  provider refresh, hour-old elevation access, sensitive inspection denial before
  audit, disabled account, legacy expiry, grant revocation, support conflict,
  provider sign-out and logout/cookie replay. Age is advanced by backdating the
  isolated database row, not a one-hour wall-clock wait.
- All 40 migrations applied to fresh and legacy isolated databases; all 66 tables
  retain RLS/browser CRUD denial. An explicit populated 39-to-40 migration test
  preserves legacy expiry/revocation rows and ownership/RLS policy state.
- Prisma validation and generation passed; TypeScript, production build and
  git diff --check passed. Lint: zero errors, 28 existing warnings.

The older Corkboard Auth fixture has pre-existing original/reconciled decision
migration history conflicts. A deployment attempt there failed before this new
migration; its history was not rewritten or reset. Real Auth verification instead
used a new disposable `outclass-admin-session-e2e` project on loopback ports
60321/60322. Its fixture enrollment was verified before the session test; initial
attempts with unverified fixture factors failed securely. The local runner accepts
only the two explicitly allowlisted fixture project/port pairs and explicitly
disables communications email/Resend. No hosted email or production verification
was performed. Those are not counted as passing.

Evidence: `/tmp/outclass-admin-session-change/` contains focused.log, suite.log,
native.log, migrations.log, auth-session.log, build.log, lint.log, typecheck.log,
prisma.log and disposable fixture preparation evidence. Local fixture credentials
remain outside the repository; do not include fixture config in a commit.

## Remaining findings and boundaries

No known P0/P1/P2/P3 code findings in this diff. Hosted/provider timeout settings
and production behavior have not been reverified; deployment review must account
for the migration-first order. Fifteen full-suite integration gates remain skipped;
the specific native and real Auth checks above were run separately.
All five credential-recovery files remain untouched, untracked and unstaged.
No push, merge, deployment, production/staging mutation, global email enablement,
or real user/queue/preference change was performed.

## Exact Admin review manifest (26 files)

- `actions/admin-clubs.ts`
- `actions/admin-workspace.ts`
- `actions/campus-events.ts`
- `actions/club-assets.ts`
- `actions/club-claims.ts`
- `actions/club-onboarding.ts`
- `actions/platform-admin.ts`
- `actions/platform-organization-onboarding.ts`
- `actions/school-requests.ts`
- `app/api/platform/elevation/route.ts`
- `app/api/platform/view-as/route.ts`
- `app/platform/login/page.tsx`
- `components/admin/admin-shell.tsx`
- `docs/admin-session-lifetime.md`
- `lib/admin-elevation.ts`
- `prisma/migrations/20261012171752_admin_session_bound_elevation/migration.sql`
- `prisma/schema.prisma`
- `scripts/run-admin-local.cjs`
- `tests/admin-elevation.test.cjs`
- `tests/admin-session-e2e.test.cjs`
- `tests/admin-workspace.test.cjs`
- `tests/decision-transactions-native.test.cjs`
- `utils/admin-transaction.ts`
- `utils/club-write-transaction.ts`
- `utils/invitation-delivery.ts`
- `utils/platform-admin.ts`
