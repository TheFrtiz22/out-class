# Repaired implementation

Current measured source is `d0d6f2778239b5d3b921663780a01c7542f04fa3` against main
`0a40de7cbcad158cf60d96c258610b832d818da8`. `SOURCE_PROOF.json` records all 965
application-file hashes and the exact 26 application files changed from main.
All 34 frozen gates and independent functional verification pass in the complete performance matrix.

| Area | Final behavior and purpose |
|---|---|
| Guarded pipeline reads | `actions/crm.ts` keeps fresh existing authority and Repeatable Read. Global canonical metadata determines exact filters/order/counts/facets/cursors; full canonical details are hydrated only for the selected visible page, at most 100 applications. |
| Snapshot round privacy | Page and complete selection reuse all club rounds from the same transaction through `readPipelineMetadata`. Archived round privacy stays available internally; public controls and gender eligibility remain active-round-only. Missing privacy fails closed. No redundant application-round relation is selected. |
| Detail and page ownership | The current page owns its canonical details. Opening/switching within it adds no duplicate application-detail GET. Independent Applicant Display and attendance reads remain fresh. Page boundaries adopt a newly guarded response once. |
| Complete coverage | The hook preserves the exact initial server response. It derives local filters only after an actual query change within still-valid complete coverage. Completion follows the unscoped data actually supplied, without any cohort threshold. New reads supersede old coverage even after denial or query races. |
| Authority fencing | Identity, read epoch, support mode, club/privacy scope, Demo readiness, query and mutation revision own results. A notification fences stale dispatches and completions before React commits. No successful server authorization is cached. |
| Pending-read coalescing | Only identical simultaneous operations for the same full owner/read kind/arguments share a promise. Entries are removed after either settlement. Existing serialized latest-query handling remains. |
| Voting selection | Complete candidate IDs are built inside the existing voting snapshot using canonical privacy/filter/order rules. Closed-setup polls omit selection scans; opening setup requires its exact fresh read token. Live post-snapshot permission/participant checks and every write remain unchanged. |
| Overview CTA | All applicants uses the existing query-only club navigator, preserving history and modified links while eliminating an unused RSC dependency. It still starts one fresh guarded page GET. Real desktop/touch integration asserts both properties. |
| Canonical projections | Shared full-detail/list/review/profile helpers preserve anonymous text, self-review exclusions, submitted-review barriers, exact nested ordering and existing output fields. No broad metadata restructuring, raw SQL join or new index was introduced. |
| Functional repair | Admin-session checks now identify the authenticated semantic shell; dashboard refresh checks use the stable label plus disabled and aria-busy state. Existing MFA, revocation, content, error-recovery and all other assertions remain. |
| Controlled fixtures | One/100/1000/5000 cohorts are automatic, isolated and disposable. CI freezes both production outputs and verifies served document/assets plus each authenticated data contract before every BAAB block. Owned cleanup never targets unrelated services. |
| Collector correction | Strict readiness observes character-data changes, checks only stage-relevant DOM and coalesces mutation bursts. Two-frame/full-content predicates and unforced interactions remain. Bounded sanitized read causes and long tasks support tail diagnosis without protected values. |

Global metadata/ranking and explicit complete selection remain O(N). The initial
wire detail projection and directory rendering remain bounded; no delayed full
application hydration was moved outside measurement. Voting's explicitly opened
complete candidate pool is still correct for the whole eligible selection.

`SOURCE_PROOF.json` confirms byte-identical CRM/voting write tails and voting
post-snapshot checks, plus no schema, migration, package, deployment configuration
or additional dock changes from measured main. The independent dock repair was
already merged through #92. Main's #101/#102 voting behavior and #103 contextual
loading feedback are retained.

`attempt-1/` preserves the prior source's complete rejected small-cohort results.
`attempt-2/` contains current-source local and hosted QA, including the failed
local parallel PDF/browser run, unchanged sequential passing checks, and the
fresh full CI pass. The final controlled numerical outcome belongs in
`BENCHMARKS.json`; old successes or tails are never pooled into it.
