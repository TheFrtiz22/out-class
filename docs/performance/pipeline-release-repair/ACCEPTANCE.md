# Frozen acceptance protocol

Written before running or inspecting repaired-candidate measurements. All limits
apply to separate cohort/profile/path/condition groups. Do not pool historical
or new host conditions. Historical B/C results are contextual, not paired D data.

Compare latest main f2192e02 (B2) and repaired application (D) with identical
disposable local Auth/PostgreSQL fixtures and Next production builds. Keep B
78402ee6 and C 375a00d historical results separately with original provenance.
Use BAAB blocks, two excluded warmups per block, initially ten measured samples
per build/group; expand concerning one-applicant/detail tails to at least 30
if feasible. Desktop local and CDP 80ms/200000 Bps down/93750 Bps up/CPU4.
No sleep/wake or competing builds/tests during accepted timing blocks. Preserve
unsuccessful attempts and every slow outcome. Nearest-rank p95; no hosted claims.

* Security/functional gate: zero authorization/privacy/isolation/draft/history
  failures, zero incorrect counts/order/selection/cursors, zero useful-content
  failures, page errors or HTTP errors. Explicitly count aborts/pending requests.
* One applicant: no extra detail request versus B2. Per-group p50 regression
  at most max(10%, 15ms); p95 at most max(15%, 30ms). These are screening limits,
  not statistical significance or production SLOs.
* 100-applicant full workflow and voting: no extra unnecessary guarded reads;
  p50 at most max(5%, 20ms) and p95 max(10%, 40ms) slower than B2. Measure
  source preparation and total journey as well as individual click windows.
* 5,000 constrained directory entry: at least 90% lower p50 and p95 than B2;
  bounded returned/rendered applications (at most the existing visible page).
  No deferred unmeasured all-record hydration. Check 1,000 too.
* Capacity: concurrency 1/2/4 with pool limit 8, no correctness/error failures;
  D p95 no more than 15% slower than B2. Correlated burst samples stay labeled.
* UX: actual unforced pointer destinations and first applicant row, hover
  trigger-to-flyout movement, keyboard/Escape/focus, reduced motion, touch/mobile,
  collapsed/expanded and rapid switching must pass. Dock patch independently
  reviewable; keyboard success cannot substitute for pointer success.
* Regression gate: ordinary tests, authenticated integration, native recruitment,
  offers, voting authorization, transaction/concurrency, settings/navigation,
  browser desktop/mobile, migration compatibility, build/types/lint. Gated
  omissions remain explicit and prevent production-ready clearance.

Each raw row must retain sample identity, source hashes/build IDs, timing
milestones, requests, known encoded bytes and missing-byte counts, available
Server-Timing spans, errors/aborts/pending. Unknown metrics are null. Performance
failure means reject that implementation; missing evidence means hold release.
No merge/deploy/production mutation. No adjustable post-result limits.
