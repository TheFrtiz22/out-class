# Student journey rehearsal and support submission repair

Baseline: serving/main `59df6588a6be0beb2d76b527f5fb4e07156540f7`.
Observed 2026-10-18, America/New_York. No migration is required.

## Hosted evidence

Discover showed 38 clubs. The open-applications filter correctly returned zero;
its selection and empty state survived reload. Applications, Status and Calendar
loaded under the owner's normal account. These are read checks, not a new
application/interview/decision/offer lifecycle pass.

The existing `Synthetic interview improvements` fixture was temporarily restored
and intake opened through canonical Admin actions. It remained hidden from
Discover; invitation email remained disabled. The supported direct route
`/club/<clubId>` permits unlisted profiles, without publishing the fixture.

An attributed support session selected the pre-existing Synthetic Answer key
applicant. Starting an application created draft
`273e1cb0-cb70-4314-a9dc-9b5c577cb068`. The UI review/confirmation step worked.
Submission returned HTTP 500 at 2026-10-18 14:11:06.23 EDT. The serving log reports
Prisma P2028 at `applicationAnswer.deleteMany`: 5000ms transaction budget,
6811ms elapsed, digest `3942172721`. The draft remains DRAFTING, submittedAt null,
decisionVersion zero, with no letter. This demonstrates failure during support
impersonation; it does not establish that ordinary student submissions fail.

## Narrow repair

`persistApplication` now uses the existing `clubWriteTransaction` helper for
draft saves and submission. Provider-backed support authentication resolves
before acquisition. Audited writes and commit still recheck live database
authority. The existing helper retains its 5s acquisition, 15s transaction,
3s lock and 10s statement bounds. No helper timeout was increased.

The original operational Club lock, intake/deadline and SAT/ACT rules, profile
check, question validation, attachment ownership, expected-answer comparison,
conditional DRAFTING update, answer replacement and atomic rollback remain.
There is no automatic retry or alternate producer. `startClubApplication`,
which successfully created the hosted draft, is unchanged.

## Regression and validation

Existing application/autosave/suspension checks: 22 passed. TypeScript,
production build, Prisma validation and diff checks passed. Lint: zero errors,
26 existing warnings. The autosave browser suite passed both tests after restoring
the local browser runtime. Broad-suite and final-source CI results belong in
the PR check results; incomplete or gated runs must not count as passes.

The native PostgreSQL suite adds four cases: serving-source P2028 negative
control versus repaired submission under identical injected Auth latency;
normal and impersonated draft/submission/retry isolation; and revocation after
the final answer write rolling the entire submission back. Actual engine,
role, extension, SQL, audit and transaction behavior use disposable PostgreSQL.
Injected provider latency is not a production latency measurement.

This workspace has no Docker/native PostgreSQL runtime. The dedicated CI job
uses the existing isolated runner, full history for negative controls, localhost
guarded connections, a disposable container and no production secrets. Its
native result is required before clearing this repair. The job also reruns
existing recruitment-offer and communications native regressions.

## Remaining hosted gates and cleanup

No repair was deployed during this rehearsal. Resume the retained synthetic draft
after an authorized verified deployment; test submission, interview booking,
decision ownership/history and offer acceptance. The current run did not reach
those later cases and is not launch clearance. Hosted provider delivery still
requires its owner; do not enable email for this rehearsal.

Support impersonation ended. Fixture intake was closed again through the normal
leader application editor. It is hidden and invitation email remains disabled.
At this report's checkpoint, restoring the fixture's original suspension still
requires fresh Admin verification; do not report that cleanup as completed.
Retain the new draft and historic test data instead of deleting records.

Existing outbox baseline: 60 rows, fingerprint
`c710a0aaefd568bdf50c3cdb071cf2ea`; preferences: 15 rows, fingerprint
`33a5cbaba18ec6c2979764a956da9fec`. Sixteen SENT delivery records predated this
test; they are not claimed as new delivery evidence. Verify original queue and
preference fingerprints after cleanup. No credentials or privileges changed.

A separate Admin UX finding remains: expired sensitive verification can surface
as a generic server error. The logged cause was ADMIN_ELEVATION_REQUIRED, not
an authorization bypass. Improve that response without relaxing freshness.

## Manifest

- `.github/workflows/deploy.yml`
- `actions/applications.ts`
- `tests/autosave-actions.test.cjs`
- `tests/student-applications.test.cjs`
- `tests/decision-transactions-native.test.cjs`
- `docs/student-journey-rehearsal.md`
