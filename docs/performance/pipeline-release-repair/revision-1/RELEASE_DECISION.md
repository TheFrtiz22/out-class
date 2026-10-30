# Release decision: PARTIALLY ACCEPT

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


**Accept the independently verified dock repair. Reject pipeline application
`4d52103e` for release and keep PR #93 in draft.** Preserve the narrow data-contract
implementation for review; do not merge the held experiment or deploy this repair.
No release threshold was changed after results.

The code removes the demonstrated extra detail and serial voting-selection
reads, preserves canonical global semantics and current authorization, and
scales well locally. That is useful engineering evidence, but it does not clear
the frozen release gates:

| Requirement | Result |
|---|---|
| One-applicant detail, local/constrained | Numeric p50/p95 and request limits pass. Constrained cold: 225.6/259.9 → 243.7/272.6 ms, n30/build; no extra detail GET. |
| One-applicant constrained cold directory | **FAIL:** p50 552.3 → 608.3 ms (+10.14%); limit 607.53 ms, exceeded by 0.77 ms. P95 passes. Borderline screening failure is not statistical significance, and is not waived. |
| Complete review | Recorded local numeric limits pass. Constrained one-applicant p95 5.81 → 33.55 seconds and 100-applicant 11.27 → 37.59 seconds fail. The measured strict observer can miss text-only readiness; its application-latency interpretation and release clearance are unresolved. |
| 100-applicant guarded request maximum | Recorded constrained 10 → 11 fails the automated count gate; the extra request is a background notification during the long observation window, not a duplicate pipeline detail/selection read. Median stays ten → ten. |
| Voting history | Recorded cold/warm 100-applicant numeric limits pass on both profiles, n10/build. The strict collector limitation remains explicit. |
| 5,000 scalability | Local cold directory 8148.3/8547.6 → 624.7/687.3 ms: 92.3%/92.0% lower. Required constrained comparison is **missing**: the entire incomplete 5,000 cohort is excluded, including primary and candidate successes. |
| Bounded capacity | All six groups pass at 1,000/5,000, concurrency 1/2/4, application pool eight; 140 measured successful requests, 56 excluded warmups. |

The mechanical numeric tally is 26 PASS, six FAIL, two MISSING; strict-review
observer clearance is additionally false. `CONTROLLED_RESULTS.md` and
`BENCHMARKS.json` retain all sample counts, maxima, bytes, source preparation,
journey/network milestones, requests/spans/errors and exact raw references.
Local has 560 measured browser outcomes/160 warmups. Complete constrained
1/100/1,000 cohorts have 460/120, each paired on its own VM. No failed/slow row
is dropped and no successful row from an excluded whole attempt is restored.

`OBSERVER_QA.json` independently reproduces a missed text-only completion in
Chromium. The future collector now observes character data too. This does not
prove the cause of any particular past tail, subtract elapsed time, turn a gate
into PASS, or affect the independent primary-directory failure. No further
performance run is launched for this rejected candidate.

All twelve hosted application-source validation jobs passed, including build,
types, migrations/RLS, real Auth/settings/navigation/pipeline, native security/
transactions/recruitment and accessibility. Ordinary suite: 1,483 pass, 52 gated
skips, zero failures; lint zero errors/22 warnings. Dashboard/writing journeys
also passed. An evidence-only native scheduler recovery assertion failed once
and passed unchanged on retry; both remain in EVIDENCE_COMMIT_QA.json.
The gated supplement adds real active-room, communications, Corkboard and
private decision-letter checks. Its initial dependent Admin/asset tests lacked
required fixture preparation; failures are retained and corrected sequencing outcomes are retained below. GATED_COVERAGE.json and GATED_SUPPLEMENT_QA.json give the exact
per-scenario outcome, never treating a related native suite as a substitute.

Main advanced after the measured freeze to
`bc22b0a30b98cbfab785ea3da5215a9351b76109` (#101 live-room transitions/guarded undo).
Its 19 changed files were inspected and do not overlap the 25 repair application
files. Measurements remain pinned to main `6e793dea` and application `4d52103e`;
this held branch does not claim a timed/verified integration onto `bc22b0a3`.
Any future candidate must preserve that work and start from then-current main.

The separate dock PR #92 passed real unforced mouse, keyboard/Escape/focus,
reduced-motion and touch/mobile checks and both hosted workflows. Main merged
it externally as `a0265dcb`. This task merged no candidate into main and made no
production deployment, write, schema/configuration, region or pool change.

Remaining risks: full-detail visible-page payloads with real essays/history,
O(N) metadata/ranking/selection, small-sample tails, current-main integration and
unmeasured production behavior. Production aggregate searches found no matching
sanitized traces; they do not explain the historical 4.2-second identity stall.
Do not attribute it to Auth or geography.

The next engineering step is a distinct revision against current main: resolve
the one-applicant entry cost, use the corrected observer for strict review,
and complete a bounded, fully attested 5,000 constrained protocol. Retain the
accepted dock and reviewable contract/ownership/security work. Do not restart a
broad audit, waive these gates or infer production readiness from local gains.
