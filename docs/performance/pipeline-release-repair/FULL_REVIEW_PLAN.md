# Additional full-review readiness gate

Declared before collecting or examining this supplement's candidate results.
Primary historical-compatible entry/detail predicates remain unchanged and all
their outcomes remain required. No failed primary group can be replaced by this
supplement.

The primary detail milestone observes full application answers plus two frames;
independent review-information/attendance resources can still be pending there.
The primary workflow records the later network completion and total work too.
This additional 100-applicant local/constrained BAAB comparison waits for both
visible review panels to finish before switching applicants and before continuing
complete selection/voting. It therefore tests the actual read/review dependency,
as well as initial content. It uses the same current-main/repaired builds,
fixture, real controls and original acceptance tolerances.

Ten measured samples/build/profile (five per BAAB block), with two within-browser
warmups/block. No forced clicks, injected product delays or writes to reviews,
ballots or decisions. Source preparation, each content/interactive milestone,
continuous source-through-journey time, network completion, requests/bytes and
errors are retained. Whole sleep/power-invalid attempts remain excluded.

This is stricter verification, not a change to release thresholds or deletion of
an earlier result. It does not establish a production p95 guarantee.

## Separate current-main CI protocol (declared before collecting)

Main advanced to `29100f9cef68ffcba7a250200aa5b5ceb7727cb8`, including
PR #92's dock repair, live voting rooms and new product layouts. The repair is
rebased onto that exact source; earlier Mac runs describe the prior base. CI
uses two independent GitHub-hosted Linux VMs, one per network/CPU profile. On
each VM both builds use the same disposable loopback Auth/PostgreSQL fixture.
Builds, QA and fixture preparation finish before sequential BAAB timing.

The unchanged primary navigation collector measures cold/warm directory/detail
entry at all four sizes: 30 samples/build/path/condition at one applicant and
10 elsewhere; two warmups/block are excluded. The separately identified strict
full-review collector runs all four sizes, ten samples/build/profile plus two
warmups/block, and expects exactly N rows from main and min(N,100) from repair.
The earlier workflow incorrectly required min(N,100) from main; **all** earlier
workflow rows are excluded, including successful smaller-cohort/candidate rows.
No failed outcome is substituted. The old collector/raw probes are preserved.

Main renamed the former Start voting console to Voting history and introduced
a separate Live voting room flow. Both CI builds preserve that UI. This
comparison follows Voting history to exercise the repaired snapshot/selection
contract; it is not a benchmark of the new persistent live-room flow. Main's
live-room regression suites remain required. No live-room performance claim.

The local-profile VM additionally measures 140 capacity requests plus 56
excluded warmup requests at concurrency 1/2/4, pool limit 8. Host controls record
runner/CPU/cgroup metadata and wall-versus-monotonic elapsed time. GitHub does
not expose physical sleep/power telemetry or noisy-neighbour measurements;
these limitations are explicit and CI results are never pooled with Mac data.
Zero collector errors remain required. Acceptance tolerances in ACCEPTANCE.md
are unchanged. This protocol cannot establish a production p95 guarantee.

CI run `40905121217` is excluded in its entirety, including successful primary
navigation, smaller-cohort workflows and capacity rows. Its baseline slots made
`pipelinePage` requests even though exact main has no such endpoint. Filesystem
source/build hashes alone did not prove the served build. The large baseline
workflow cardinality failures are therefore instrumentation failures; they are
not a main-product performance result. All raw outcomes remain preserved.

The next distinct attempt uses separate dependency installations, explicit
absolute build/start project directories, and before every browser/capacity
block compares the served build-manifest bytes to that build's disk hash. It
also verifies the authenticated data contract and exact application count,
including main's 400 response for the unsupported candidate-only page endpoint.
A failed attestation stops measurement and is retained. These preflight reads
are outside timing and precede the same excluded warmups. No application code,
content predicates, sample sizes or acceptance tolerances changed.


Run `40918015976` stopped before timing: both profiles received 404 for the
expected main build's manifest. Its partial protocols and the failed capacity
preflight are preserved; no timed outcomes are accepted. This does not establish
a product regression or identify the underlying cross-checkout runtime cause.

The next distinct attempt reuses the repository's established frozen-output
restoration approach (`navigation-selected-ready-local.cjs`): freeze both
completed production outputs, restore one output into a single owned runtime
checkout between blocks, and verify the entire restored file digest (excluding
only the build cache). Source files never change during timing. Each block
still checks the exact served build manifest and the authenticated data
contract before the same warmups and samples. Frozen artifact build IDs and
digests are recorded. This changes only runtime orchestration, not application
source, fixtures, content predicates, measurements or acceptance tolerances.


Before any attested frozen-output comparison was collected, main advanced to
`6e793dea0bd45052fa444749b26d432ae93392cd` (shared contextual/glowing loading
components and voting walkthrough documentation). The repair was rebased,
preserving main's loading assertions and all product changes. The new CI
comparison freezes that exact latest main. Existing attempts against f2192e02
and 29100f9c remain separate and excluded; tolerances and sample sizes remain
unchanged. Superseded queued/preparation-only runs may be cancelled; any
collected raw outcomes must still be retained and excluded.


Run `40969249318` also failed its unused Pages build-manifest check before
sampling. No timing is accepted. This did not independently establish the
server process being served: the old lifecycle trusted an empty lsof port
inventory and accepted any HTTP 200 as startup readiness. The next attempt
stops only the registered PID after verifying its working directory, verifies
that both that process and its port are released, refuses an unregistered
occupied port, and verifies the new process. The preflight now checks the
App Router document's exact build ID and a required runtime JavaScript asset's
SHA256, in addition to the frozen-output digest and authenticated data contract.
The unused Pages manifest URL is not a prerequisite for an App Router build.
These are source-fidelity controls; the application, milestones, sampling and
acceptance thresholds remain unchanged. Failed preflights remain retained.


A source-level review found that managers also requested selection metadata on
every ordinary session/history poll. Before accepted repaired timings, that
redundant work is removed: the initial snapshot still includes selection for
auto-opening empty-history setup, open setup polls keep it fresh, and ordinary
closed-setup polls omit it. Explicitly reopening setup requests a fresh snapshot
and conceals prior eligibility until that exact operation settles; the existing
workflow/trigger stays mounted to preserve focus restoration. Authority/query
owner fencing and voting writes remain unchanged. Regression tests cover the
one-read initial path, omitted polling query, concealed stale eligibility and
fresh reopen. The changed candidate requires its own complete comparison;
superseded measurements, if any, are preserved separately.
