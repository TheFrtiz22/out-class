# Decision publication and no-email invitation transaction repair

Review branch: `repair/decision-transactions`.
Baseline: serving/main `e50aabeffa76dde72840aeabc74e156e77d2d8f7`.
Origin was fetched; no newer main commits were present at implementation start.
No commit, push, deployment, production query or production mutation was performed.
The five pre-existing credential-recovery files are outside this change.

## Evidence and diagnosis

The previously captured serving-deployment errors were Prisma P2028:
- Waitlist publication, 2026-10-12 04:15:54 UTC: 5,000ms budget,
  5,083ms elapsed, surfaced at ClubInvitation.findUnique.
- No-email invitation, 04:18:41 UTC: 5,000ms budget, 7,801ms elapsed,
  surfaced at ClubInvitation.create.

Those logs do not contain historical per-query or lock-wait durations. They do
not prove an exclusive production lock cause. The isolated reproduction below
establishes an independent, deterministic timeout mechanism in the serving code.

The support audit extension calls supportContext before every ORM mutation.
Previously this repeated platformViewSession -> requirePlatformAdmin -> provider
Auth/AAL2, live elevation/session checks and several independent DB reads while
holding business locks. Each non-audit mutation additionally writes durable
attempt and statement-returned records through a separate base connection.
These durable records remain intentional and fail closed.

In real PostgreSQL/Prisma tests, injected 1,800ms provider latency caused both
serving-source actions to fail P2028 at approximately 5.5s after three provider
resolutions and completely roll back. This is simulated Auth latency, not a
measurement of Supabase production response time. The repaired commands succeed
with the identical latency and one support resolution before acquiring the
transaction. Native query counts, SQL duration and transaction measurements are
in `/tmp/outclass-decision-repair/native.log`.

Separately, the serving letter publisher's AuditLog.createMany is rejected by
the support extension. A native test reproduces that rejection with the timeout
repair present, proves rollback, then succeeds with individual AuditLog.create
events. Production encountered P2028 before this latent failure was reached.

## Repair and security

`clubWriteTransaction` resolves the normal provider-backed support context and
fresh elevation before acquisition. Its lexical AsyncLocalStorage callback never
caches identity across requests. It supplies a transaction-local DB validator
before every audited ORM mutation and before commit. This validates the exact
support session, actor allowlist/active grant, active actor and target, target
non-Admin restriction, support/elevation expiry and revocation, elevation Auth
session binding and ordering, and live provider Auth session. Any failure rolls
back the entire domain transaction. Normal request authentication remains in
the existing actions; absent/forged support cookies cannot enter this scope.

The original extension still writes durable attempt/statement records and
attributes domain audit events to the actual Admin actor, effective target and
support session. No privileged mutation bypass is introduced. Three letter audit
events now use the existing attributed create path, retain their exact actions
and details, and commit atomically with letters/notifications.

Decision/version/offer/letter/canonical notification/trigger-created outbox writes
remain in the original transaction. Club serialization and transaction-time
membership/permission checks remain. Invitation creation additionally holds actor
and membership rows and rechecks active user and platform designation authority.
No-email creation does not schedule delivery. Idempotency and conflict behavior
remain caller-visible; there is no automatic retry of timed-out commands.

## Bounded limits

- Acquisition maxWait: **5s**.
- Direct decisions and identity invitations: **15s** execution timeout.
- Voting commands: **30s**, retaining the existing multi-candidate execution cap.
- PostgreSQL lock_timeout: **3s** per lock acquisition.
- PostgreSQL statement_timeout: **10s** per statement.

The principal repair removes repeated external Auth work, rather than relying
on a larger timeout. Fifteen seconds gives bounded room for retained sequential
DB/security/audit round trips beyond the observed 7.8s failed request; it is not
a claim of measured hosted p99 latency. Voting retains its pre-existing larger
batch cap. Contended locks fail before the execution budget, and slow SQL fails
before 15s. SET LOCAL-equivalent transaction settings reset on commit/rollback.
Durable audits still require a second pool connection; pool starvation fails
closed. Hosted latency/load and pool sizing must be checked after a reviewed
release, without enabling global outbound email.

## Reproduction and validation

Run `node scripts/test-decision-transactions-local.cjs`.
It creates a dedicated loopback-only disposable PostgreSQL 17 container, applies
all 39 committed migrations with Prisma, assigns the existing bounded owner
model to public application tables, grants only SELECT on fixture auth.sessions,
and runs actual actions and the production query extension. It never inherits
DATABASE_URL as its target and removes only its own container in finally.
Auth/request boundaries are synthetic; this is not a hosted Auth/UI test.

Native coverage includes normal/support direct and voting publication,
Acceptance/Waitlist/Rejection snapshots, no-email invitation retries, exact
attribution, concurrent retry uniqueness, full failure rollback, durable audit
failure, cross-club denial, revocation after an actual Club lock wait,
support/elevation/grant/logout/disabled-target revocation, concurrent identity
scope isolation, slow SQL cancellation, and observed pg_stat_activity Lock waits.
Existing native communications and offer suites run separately on the same
bounded-role database, including immutable history, ownership, templates,
canonical outbox, anonymous review, acceptance/decline membership, races and
revocation. No hosted provider is invoked; no delivery worker is enabled.

Validation rerun in this pass:
- Full suite: 992 passed, 15 gated skips, zero failures (native tests run separately).
- Native transaction repair: 17 passed, zero skips/failures.
- Existing native communications/offers: 26 passed, zero skips/failures.
- All 39 migrations applied successfully to the disposable PostgreSQL database.
- TypeScript and Prisma validation: passed.
- Production build: passed with all DB/Auth aliases pinned to local placeholders.
- Lint: zero errors, 28 existing warnings.
- Diff checks: passed.

Evidence directory: `/tmp/outclass-decision-repair/`.
Earlier failed fixture/setup attempts are not counted as passes. The final native
log replaces intermediate runs. Full-suite skips include hosted/local Auth/RSC/
Storage tests without their independent fixture configuration; they are not
claimed passing. The repair has not been deployed or verified on production.
Hosted email delivery remains unverified and requires the provider owner.

## Exact intended manifest

Modified:
- actions/club-onboarding.ts
- actions/crm.ts
- actions/voting.ts
- tests/leader-isolation.test.cjs
- utils/club-onboarding.ts
- utils/decision-communications.ts
- utils/support-audit.ts

Added:
- docs/decision-transaction-repair.md
- scripts/test-decision-transactions-local.cjs
- tests/decision-transactions-native.test.cjs
- utils/club-write-transaction.ts

The isolation unit loader now passes the same fake Prisma instance into imported
helpers, so authorization tests continue exercising the intended transaction.
No schema or migration changes. Global email, the original 17 INTERVIEW queue
items, and real preferences were not touched. All changes remain unstaged.
