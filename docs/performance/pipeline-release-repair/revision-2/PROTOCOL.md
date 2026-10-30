# Revision 2 comparison protocol

Declared before collecting revision 2 candidate measurements on October 30,
2026. The user's request to fix #93 and merge it when ready authorizes this new
revision. Revision 1 remains rejected, with its complete evidence sealed at
`b2d8883da60a991c22e7596fd2dccc9cf981461b`. No historical result is changed.

Baseline B is current main `0a40de7cbcad158cf60d96c258610b832d818da8`, including
the atomic voting transitions, state refresh and loading-feedback changes.
D is the exact checked-out revision 2 commit and application digest recorded
in each protocol. Both builds use the same isolated Auth/PostgreSQL fixture,
pool limit eight and frozen production outputs. Every block verifies the served
document, assets and authenticated data contract before collecting samples.

All numerical and security/functional limits in `../ACCEPTANCE.md` remain
unchanged. In particular, no borderline revision 1 failure is waived. No old
measurements are paired with this candidate. Complete new comparisons are
required for every cohort (1/100/1000/5000), both local and constrained profiles,
ordinary navigation, complete review/voting and bounded reader capacity.

Each cohort/profile/collector is an independently assigned unit on one fresh
Linux VM. Navigation and strict full review use separate VMs. Each unit runs
all four B/D/D/B blocks with two excluded warmups per block. Navigation has
15 measured samples per block at one applicant, five at the other sizes;
strict review has five measured samples per block at every size. Thus each
build has 30 one-applicant navigation observations and ten in every other
navigation/review group. Results from different units or hosts are not pooled.
Capacity is one separate VM with cohorts 1000/5000, concurrency 1/2/4, B/D/D/B,
140 measured requests and 56 excluded warmup requests.

This partition is declared in advance to allow the unbounded baseline's costly
5000-row full-review interactions their own budget. It does not remove any
product step or transfer expensive work outside measurement. Source preparation,
content readiness, complete journey and network completion remain recorded
separately. An interrupted assigned unit is excluded in full, including its
successful observations. Functional errors remain failures; incomplete units
cannot establish release clearance. Every unsuccessful attempt is retained.

Start with the one/100-applicant units using
`run-release-revision-2-screening`. These use the full sample sizes above and
may establish their own gates; “screening” refers to ordering, not fewer samples.
After reviewing them, run the 1000/5000 units and capacity using
`run-release-revision-2-large`, against the same application digest and tools.
If code or protocol must change, retain the earlier attempt separately and
collect new affected comparisons without mixing changed source or tools.

The strict observer now observes text-node changes, checks only the current
stage's necessary DOM and coalesces mutation bursts to animation frames. It
still requires two observed frames, complete authorized review/attendance data,
exact row/candidate counts and real unforced interactions. Independent Chromium
QA covers text-only completion behind 5000 rows and coalesced directory scans.
These fixes do not subtract latency or excuse any old tail. Readiness timeout
is 180 seconds for both builds; observation failures are recorded as failures.

Required ordinary, migration, native concurrency, Auth, desktop/mobile/dock,
build/type/lint and previously gated functional suites must pass on the final
application. No production mutation, pool/region change or manual deployment
is part of this protocol. Local/CI results make no hosted latency guarantee.

Main must still match the measured baseline before merging. A later main
advance requires inspection and appropriate verification rather than silently
claiming that the old comparison measured the new main.
