# Workspace reliability repair

Branch: `repair/workspace-reliability`.
Baseline/current fetched main: `ce2c0141291bcb0b8683b8a3a94ad5db62c6d746`.
The deployed decision-transaction repair `a4ae1392db57c5283a0d77763c34b9b970df958c`
is already in this baseline through merge `0762a2a06dd82d93111f1077a41b9a388970a1b5`.
The intervening nine-file main delta changes public copy, imagery, SEO and docs;
it does not change the repaired authorization/transaction paths. Public serving
HTML still identifies deployment `9bTaXW7QpXoYKsrhg2oZ1VfDoCFq`.

## Causes and changes

### Persisted voting drafts do not reliably load
Both leadership and participant polling started a new server action every five
seconds and incremented a request counter. If a read took longer than five
seconds, the next tick invalidated its result. Repeated ticks could discard every
successful result and accumulate serialized server actions. A mutation refresh
could also compete with these reads. This reproduces deterministically with
unresolved reads across multiple simulated polling ticks; it is not a claim to
have historical production query-duration telemetry.

A shared serialized reader now coalesces polls into one in-flight read. Explicit
post-command refresh drains an older read and fetches again; it does not publish
the obsolete snapshot. Disposal rejects late account/session results. Rendered
snapshots are keyed to account, club/session and Demo scope. Voting reads use the
existing authenticated GET workspace allowlist with private/no-store responses,
30-second client deadlines and existing server authorization. Optional session
arguments accept both omitted and JSON-null representations. Demo adapters remain
isolated. Create, ballot and join writes reuse the deployed bounded support
transaction pattern; all existing roster, immutable-ballot and publication locks
and checks remain in place.

### Impersonated profile publication expires
`updateClubSettings` still used the default five-second Prisma transaction. Its
profile update and audit invoked repeated provider-backed support resolution
inside the transaction. The earlier live P2028 reported 7,316ms at audit creation.
On isolated native PostgreSQL the current-main action reproduces P2028 with
2,700ms simulated latency per provider resolution and rolls back the profile.
The repaired action resolves support once before acquisition, then uses the
existing transaction-time database validator. In the final isolated run the same
latency yielded about 2,741ms overall and 16ms in the transaction. These are local
simulated measurements, not measured production provider latency.

The Storage-assignment module is loaded before acquisition; image assignment still
checks the saved profile and actual object existence/club ownership in the same
transaction as the update and audit. Audit failure rolls back the profile.
No Storage URLs, policies, ownership, credentials or schema are changed.

### Invitation discovery and claim fail
Read-only production checks found the two tested accounts had confirmed Auth
timestamps but no confirmation-sent timestamp, supported recovery receipt or
Azure identity. Under the existing security model, these accounts do not prove
control of their university mailbox. That denial is correct and remains denied.
The generic workspace 403 and the direct page's catch-all empty-identity fallback
obscured the cause as unavailable invitations. Missing proof now has a benign
verification-required state; unavailable Auth verification has a distinct safe
503/recovery state. Unknown errors do not expose raw exception text.

Independently, `verifiedSchoolIdentities` fetched Auth settings after transaction
acquisition and, for claim, after the club lock. Native PostgreSQL reproduces
P2028 on current-main discovery with a 5,500ms settings fetch. All current public
entry points now prepare server-authenticated mailbox proof/policy before
acquisition, using an account-object WeakSet rather than an identity cache shared
across requests. The compatibility utility fallback still verifies unprepared
internal callers fail-closed; current application callers all prepare outside
the transaction. Identity normalization/binding, active account/email checks,
identity locks, school activation, invitation expiry/revocation, inviter authority,
role limits and membership writes remain inside the transaction. Discovery/claim,
dismissal/decline and legacy invitation response paths reuse the deployed support
transaction wrapper. The direct invitation page no longer converts arbitrary
internal failures into an empty identity list.

Acceptance retries by the same verified recipient return the existing result
only when the original invitation was accepted by that user and the membership
remains active. They never restore removed/suspended membership, add permissions,
or create duplicate acceptance audits. Concurrent owner claims grant once.

## Transaction and security invariants

The existing `utils/club-write-transaction.ts` is reused without modification:
profile/invitation acquisition 5s and execution 15s; voting writes retain their
existing 30s execution cap with 5s acquisition; PostgreSQL lock timeout 3s and
statement timeout 10s, transaction-local. This removes network work from current
transaction entry points rather than solving the failure solely by raising limits.
The final per-transaction check and checks before audited mutations retain the
Admin allowlist, active grant, elevation/MFA ordering and expiry, live provider
session, active actor/target, support-session mode/expiry and logout invalidation.
Domain writes/audits remain atomic and retain actual actor, effective user and
support session. Independent durable attempt/statement audits remain fail-closed.
No permissions, RLS policies, runtime roles or migrations are changed.

## Checks rerun locally

- Focused regression suite: 85 passed, zero failures/skips, including slow polling,
  persisted drafts, account switching, denied refreshes, GET argument validation,
  invitation proof errors, owner claims, legacy verification, profile and suspension.
- `node scripts/test-decision-transactions-local.cjs`: 30 native repair checks
  passed, then 26 existing native offer/communications checks passed; zero failures
  or skips. Dedicated loopback disposable PostgreSQL, all 39 migrations, actual
  bounded owner-role connection; Auth latency and provider policy calls are injected.
  Covers normal/support voting create/read/join/ballot/publication, duplicate ballots,
  direct/voting/invitation retries, profile writes/private reference checks, atomic
  rollback/audit attribution, owner claims, grant/member/session revocation,
  foreign-club denial, suspension, and observed PostgreSQL lock/statement cancellation.
  The native profile reference test uses a minimal isolated Storage metadata table;
  it is not a claim that hosted Storage or real Auth/MFA was exercised.
- Full suite: 1,000 passed, 15 gated skips, zero failures. Three native entry points
  gated in the generic suite were also executed explicitly by the runner above.
  Other gated Auth/Storage/HTTP and unrelated integrations were not counted as passes.
- `npm run test:migrations`: all 39 migrations on fresh/legacy isolated databases;
  existing data preservation and all 66 tables' RLS/browser CRUD denial passed.
- TypeScript, production build and diff whitespace checks passed.
- Prisma validation passed using an explicit non-secret loopback fixture URL.
  The first bare invocation lacked DATABASE_URL and failed configuration validation;
  it was corrected without retrieving or installing production credentials.
- Lint: zero errors and the same 28 pre-existing warnings.

Reproducible logs: `/tmp/outclass-workspace-reliability/{focused-final,native,full,
scoped-polling,typecheck,lint,prisma,build,migrations}.log`.

## Remaining gaps and preservation

No known P0/P1/P2 remains in the locally verified repaired paths. New code has not
been deployed or exercised in the hosted application; browser UI checks here use
repository hook/component harnesses, not hosted browser E2E. Production accounts
without valid mailbox proof still need the supported verification/recovery flow;
no server override or manufactured verification was introduced. Hosted email
remains unverified and requires the provider owner; global delivery was not enabled.

No commit, push, merge, deployment, production migration or production write was
performed. Production access was limited to read-only proof booleans, public HTML
and preservation fingerprints. All 17 INTERVIEW items retain full-row fingerprint
`d5dc98cd6625f698c2ff38b2171ece57`; preferences retain
`8e87270b712751884267586b10c2e8b0`. The five pre-existing credential-recovery files
match their before-work SHA256 hashes and remain untracked/unstaged. All local
native test email/provider settings were disabled; no real recipients/preferences
were modified. Existing recovery and release evidence was preserved.

## Exact intended manifest

- `actions/club-access.ts`
- `actions/club-onboarding.ts`
- `actions/club-workspace.ts`
- `actions/voting.ts`
- `app/api/workspace/route.ts`
- `app/invitations/[id]/page.tsx`
- `components/live-voting/board-decision-mode.tsx`
- `components/live-voting/session-join.tsx`
- `components/organization-ownership-requests.tsx`
- `contexts/organization-invitations-context.tsx`
- `docs/workspace-reliability-repair.md`
- `lib/serialized-workspace-read.ts`
- `lib/workspace-api.ts`
- `lib/workspace-read.ts`
- `tests/club-marketing.test.cjs`
- `tests/club-onboarding.test.cjs`
- `tests/club-suspension.test.cjs`
- `tests/dashboard-invitations.test.cjs`
- `tests/decision-transactions-native.test.cjs`
- `tests/onboarding-security.test.cjs`
- `tests/organization-claiming-database.test.cjs`
- `tests/serialized-workspace-read.test.cjs`
- `tests/voting-board.test.cjs`
- `tests/voting-join-ui.test.cjs`
- `tests/workspace-reliability.test.cjs`
- `utils/club-onboarding.ts`
- `utils/school-identity.ts`
- `utils/verified-email-policy.ts`
