# Release decision: PARTIALLY ACCEPT

**Accept the independently verified dock repair. Hold the pipeline repair in
draft; do not merge or deploy it without passing controlled performance gates.**
Main incorporated the separate dock PR #92. This task performed no merge or
production deployment.

The pipeline code repairs the demonstrated dependencies: bounded visible-page
hydration includes canonical details, on-page review avoids C's extra detail
GET, complete coverage is reusable only by its current owner, and voting-history
setup includes candidate selection in its existing authorized snapshot. Global
facets, canonical ordering, privacy, fresh server authorization, stale-result
fences and transactional writes are preserved. All twelve current-main functional/native/build/accessibility jobs pass for
4d52103e, and both later CI-only workflows pass. Local performance and capacity pass; the incomplete constrained attempt is excluded and its complete-cohort repeat is pending. All completed measurement blocks passed served-build attestation.

The first valid current-main/D local comparison is accepted: 560 measured browser outcomes, 160 excluded warmups, no useful-content, HTTP or page failures. All local latency and request gates pass, including one-applicant cold detail 51.5/62.0 → 53.2/65.0 ms p50/p95, 100-applicant strict complete review 5174.4/5657.3 → 5204.9/5807.0 ms, and cold/warm Voting history. No extra one-applicant detail GET or 100-applicant whole-workflow guarded read is observed. The strict review is longer than the older historical workflow; its observer/automation costs are explicit.

At 5,000 applicants local cold directory is 8148.3/8547.6 → 624.7/687.3 ms, a 92.3%/92.0% reduction. The constrained job in run 40974037305 hit its 180-minute budget in the final baseline block. Its full partial artifact is retained and excluded. A separate, predeclared whole-cohort repeat is required; the constrained gates remain uncleared. All six capacity groups at 1,000/5,000 with concurrency 1/2/4 pass: 140 successful measured requests plus 56 excluded warmups, pool limit eight. See CONTROLLED_RESULTS.md and BENCHMARKS.json for counts, maxima, bytes, request/span/error metrics and artifacts.

Whole Mac attempts, screening, source-mismatched CI, failed preflights and superseded partial-source comparisons remain excluded, including their successful rows. All 52 accepted historical B/C comparison groups remain separate context. The fixed tolerances in ACCEPTANCE.md have not changed.

The ordinary suite has 52 environment-gated skips. Separate passing integrations cover 41; 11 specific scenarios were not run and are enumerated in GATED_COVERAGE.json. Real dashboard and application-writing jobs additionally pass on CI-only source 330ada23, with identical application digest. These omissions prevent blanket production-ready clearance under the frozen regression gate.

Remaining release risks are the full-detail visible-page payload (especially
large essays and appointment histories), O(N) metadata/ranking and selection,
small-sample tail uncertainty, and unmeasured production behavior. New live
voting rooms are preserved and functionally tested; these comparisons exercise
the retained Voting history console. The measured synthetic clubs have no
booking/ballot history. No production region/pool/schema/configuration change
or broad metadata rewrite is justified by this evidence.

Production access succeeded on retry, but aggregate searches returned no
matching sanitized phase events in 24h or pipeline failure events in 1h. No
fresh correlated browser/server trace explains the historical stall. Do not
attribute it to Auth transport or database geography.

Next step: complete the served-build-attested BAAB comparison, assess the frozen
limits without changing them, and update this decision from the retained raw
results. A failed performance gate rejects that pipeline implementation for
release; retain the independent dock fix and reviewable data-contract changes.
No production-ready claim is authorized by the current evidence.

Ordinary manager session/history polls now omit selection metadata. Initial
entry still includes it to avoid a serial setup request, and open setup polls
refresh it. Explicit reopening hides prior eligibility until that exact fresh
operation settles. The workflow/trigger remains mounted for focus restoration.
No eligibility or authorization cache replaces those guards. Initial large
history entry and populated booking/ballot-history performance remain unmeasured.


Evidence-commit follow-up: source 4085b134 changes only reports/analysis and retains
the measured application digest. Its audience job 123852886157 reached an
existing scheduler native backend-termination recovery assertion failure
(expected failed=1, actual=0 after a P1017 failure-marker event), followed by
five more subtest failures. This is a real failed verification, not a gated skip
or a startup-only failure. No scheduler code/test changes exist against current
main; that does not establish the cause or clear the failure. The identical
source passed previous full runs. The unchanged-source retry (job 123855873757) passed every original assertion, including actual backend termination and recovery. Failure and retry details are retained in EVIDENCE_COMMIT_QA.json. This records intermittent recovery-test instability; it does not establish a cause or erase the initial failed verification. Keep that issue visible alongside the gated omissions in release review.
