# Security and functional verification

Final gated outcome: 51 of the 52 ordinary gated scenarios have their own
separate passing evidence; none remains unrun. This includes actual club-assets,
active-room authority/revocation, recipient audiences, invitation/communication
scheduling, publication, private decision letters and Admin workspace. The one
original Admin-session route test still fails its legacy literal /Admin
workspace/ expectation, while returned HTML contains the authorized Admin
product shell and current heading. No assertion is weakened and this test is
not counted as passing. Initial fixture/MFA/event prerequisite failures and the
successful unchanged-source port-startup retry remain in GATED_SUPPLEMENT_QA.json.
The gated supplement workflow therefore retains a failed conclusion for that
one scenario. Pipeline release remains rejected independently by performance.


Current candidate `4d52103e0ca70086c8ff4f3e913a7bd11f377005` is rebased onto main
`6e793dea0bd45052fa444749b26d432ae93392cd`, with application digest
`99077a7ff37acb0b67cb919c4ec4b1b95bc0401750472cc65f26b3aaeb029be1`. All twelve hosted verification jobs pass.
`HOSTED_QA_CURRENT.json` identifies exact jobs and sanitized counters. Earlier
source/check attempts remain in HOSTED_QA.json and LOCAL_QA_LOGS.json separately.
These are functional results on measured main 6e793dea. The pipeline fails the frozen constrained entry gate; recorded strict-review tails and observer clearance remain unresolved. All capacity gates pass. This is not release clearance.

## Measured-main verification (6e793dea)

| Check | Result and evidence |
|---|---|
| Ordinary suite | 1,535 cases: 1,483 pass, 52 environment-gated skips, zero failures. Gated skips are separate from passing cases. |
| Build, types and lint | Production build and TypeScript pass. Lint: zero errors, 22 warnings. |
| Migration compatibility | All 60 current migrations apply to fresh and legacy fixtures; all 79 tables enforce RLS and deny browser-role CRUD. No repair schema or migration changes. |
| Real Auth/settings/runtime | 50 cases pass against disposable Supabase Auth, actual verified signup/MFA, SMTP and a Next production build. |
| Selected navigation | 16 cases pass: code/data overlap, fresh revisits, revoked cookies, notification fencing, existing fonts and desktop/mobile navigation. |
| Pipeline release and phase 5 | 11 cases pass, including all four cohort subtests, canonical page/selection parity, privacy, fresh authority, actual pointer/mobile/history, page boundaries, global searches and autosaved drafts. |
| Native transaction/concurrency | 49 cases pass on actual disposable PostgreSQL. |
| Native recruitment/offers | 42 cases pass, including immutable history, publication, student authority, retries, concurrent decisions/acceptance, revocation and suspension. |
| Native security | Dedicated disposable PostgreSQL security integration passes, eight reported cases. Other ordinary security tests are included above. |
| Accessibility | Public/demo browser suite: 27 pass. Authenticated suite: 18 pass. |
| Existing integration workflows | All jobs pass after retrying one failed Storage Supabase startup. The original failed job is retained; it did not reach product assertions. |
| Additional targeted post-rebase checks | 24 ownership, coalescing and voting-board cases, plus three harness provenance/process cases pass locally; no skips. |

[Hosted validation](https://github.com/TheFrtiz22/out-class/actions/runs/40974037258)
and [disposable integration](https://github.com/TheFrtiz22/out-class/actions/runs/40974037262)
identify the exact source and commands. `HOSTED_QA_CURRENT.json` records job IDs and
sanitized log counters. `LOCAL_QA_LOGS.json` retains prior-base local log hashes,
counters and failed-attempt references. Do not add counts from overlapping suites
as though they were independent tests. Later tooling-only hosted checks are
recorded in the handoff when complete.

## Boundaries exercised and preserved

Every new private server read still passes through the existing guarded
workspace handler and remote identity/current session/account/membership checks.
Strict input schemas, same-origin handling, private `no-store`, `Vary: Cookie`,
Demo isolation and the sole live/Demo API adapter remain. No successful server
authorization result is cached. Current main's live-room modes and command
boundaries survive the rebase.

The integration fixtures exercise full canonical projections against bounded
pages at 1/100/1,000/5,000 applications; globally correct counts, facets, search,
round filters and ordering; cursor/page ownership; complete selection; and the
voting setup's full candidate pool. A temporary multi-round move is restored
in `finally`. Anonymous identity/academic/review visibility, self-review
exclusions and score/rating selectors use the existing canonical projector.
Explicit nested relation ordering preserves parity across Prisma query plans.

Real page/selection requests deny permission loss, account disablement and
session revocation. Voting additionally denies club suspension. The existing
CRM policy allowing authorized suspended-club read-only access is preserved;
it does not authorize voting or mutations. Hook tests cover Auth notification before
React commit, stale successes and failures, old account/club/privacy/revision
owners, obsolete query races, adjacent-page handoffs, and returning from a denied
query to a formerly complete dataset. Starting a guarded read permanently
supersedes that result's previous complete coverage. UI reuse remains scoped to
the current existing authority owner; it is not an instantaneous server-side
revocation notification system.

In-flight coalescing shares only identical pending reads within the same owner
object and complete query arguments. Entries disappear on either settlement.
The original serialized latest-query behavior still drains obsolete requests.
The coalescer is not a general cache or a second workspace state owner.

Voting selection is part of the existing read-only Repeatable Read snapshot.
The membership comparison and post-snapshot fresh permission/participant checks
remain. Closed-setup manager polls omit selection metadata; initial entry and
open setup include it. Reopening gates the form on its exact fresh read token,
while the stable dialog/trigger preserve focus. Session creation, ballots, publication, row/advisory locks, isolation and
history protections are unchanged. Live rooms introduced by main are not folded
into this legacy voting-history snapshot or normal pipeline response.

`SOURCE_PROOF.json` hashes the unchanged CRM mutation tail and voting write tail
against exact current main. It also verifies no schema, migration, deployment
configuration or additional dock changes. No production writes, deployment,
region/pool changes or new cache framework were made.

## Functional coverage and limits

The real desktop/mobile tests use visible accessible controls and unforced
pointer/touch actions. They open and switch details, search across the full
cohort, traverse browser history and verify responsive layout at every cohort.
Separate tests exercise the 100/101 boundary, anonymous draft persistence,
rapid query changes and complete quick-review/voting selection. Existing main
ordinary/native suites cover the newly added live-room behavior; these timings
are not live-room measurements.

Fixtures have five actor memberships, 61 active members per club, two rounds,
three answers and two submitted evaluations per application. Shared student
profiles are deliberately reused; repeated enrichment changes their experience
counts. `LOCAL_FIXTURE_PROFILE.json` records actual Mac fixture distributions.
CI independently regenerates the fixture. Bookings and ballot histories are not
populated in the measured clubs; native tests cover their invariants separately.
These synthetic fixture limits prevent a general claim about clubs with large
real essays, extensive appointment histories or production concurrency.

Initial production connector reads returned 403. A later read-only retry
succeeded; aggregate-only searches returned no matching workspace phase events
in 24h or pipeline failure events in 1h. No fresh correlated production trace
was collected. See
`PRODUCTION_OBSERVABILITY.json`. The historical 4.2-second identity stall remains
unattributed. Neither successful local tests nor CI measurements establish a
production latency improvement.

All interrupted Mac comparisons and the first CI served-build mismatch are
excluded as whole attempts, including their successful outcomes. Failed local
assertions/probes are retained; none became skips. `CLEANUP.json` records owned
service shutdown, private fixture deletion and preservation of unrelated work.

Additional real dashboard and application-writing journeys pass as separate
CI jobs on source 330ada23 with the same application digest. See ADDITIONAL_QA.json.
GATED_COVERAGE.json maps all 52 ordinary skips and is updated per specific supplement outcome. After the first supplement, 45 have separate passing evidence, three reached failing assertions with missing fixture prerequisites, and four were not reached. Corrected sequencing retries are recorded separately; none is automatically counted as passing.
Those omissions are retained explicitly and no blanket production-ready
clearance is claimed. No failed test was converted to a skip.


Evidence-commit follow-up: source 4085b134 changes only reports/analysis and retains
the measured application digest. Its audience job 123852886157 reached an
existing scheduler native backend-termination recovery assertion failure
(expected failed=1, actual=0 after a P1017 failure-marker event), followed by
five more subtest failures. This is a real failed verification, not a gated skip
or a startup-only failure. No scheduler code/test changes exist against current
main; that does not establish the cause or clear the failure. The identical
source passed previous full runs. The unchanged-source retry (job 123855873757) passed every original assertion, including actual backend termination and recovery. Failure and retry details are retained in EVIDENCE_COMMIT_QA.json. This records intermittent recovery-test instability; it does not establish a cause or erase the initial failed verification. Keep that issue visible alongside the gated omissions in release review.


Final-source boundary: remote main advanced after timing to bc22b0a3 (#101
live-room transitions/guarded undo). Its 19 changed files do not overlap the 25
repair application files, but no timed/fully verified integration onto that
source is claimed. The table's 60 migrations/79 tables refer to measured main;
the upstream new migration is not this repair's schema change.

OBSERVER_QA.json reproduces a strict-review text-mutation observation gap in real
Chromium and verifies the future characterData correction. It does not establish
or erase the cause of past tail samples. The independent one-applicant primary
entry p50 failure remains. No security assertion is removed to obtain a passing
performance result; pipeline application 4d52103e is rejected for release.
