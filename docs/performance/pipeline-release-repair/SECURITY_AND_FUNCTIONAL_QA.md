# Current-source functional verification

All 18 required CI jobs pass on `d0d6f2778239b5d3b921663780a01c7542f04fa3`,
application digest `df971d7995db833ce7730354b270c88e0d26091758bc7153163cfbeb33860bb7`.
All controlled performance gates also pass. Final evidence-head checks are verified separately immediately before the authorized merge.

The authoritative receipts are `revision-2/attempt-2/HOSTED_QA.json` and
`revision-2/attempt-2/GATED_COVERAGE.json`. Each of the 52 ordinary gated scenarios maps
to its own passing integration job; none is treated as an ordinary-suite pass
or omitted. Counts below overlap across runners and must not be summed.

| Verification | Current result |
|---|---|
| Ordinary suite | 1551 cases: 1499 pass, zero failures, 52 separately covered gated skips. |
| Production build, TypeScript, lint | Pass; lint has zero errors and 22 existing warnings. |
| Migration compatibility | All 61 migrations apply to fresh and legacy fixtures; all 79 tables enforce RLS and deny browser-role CRUD. Repair adds no schema/migration changes. |
| Real Auth/settings | 50 cases pass with actual local Supabase Auth, signup, MFA, SMTP and production Next server. |
| Selected navigation | 16 pass, including fresh revisits, revocation and notification/ownership fencing. |
| Pipeline release/phase 5 | 11 pass, including all four cohorts, canonical privacy/count/order/selection parity, page boundaries, drafts and actual desktop/mobile navigation. The new CTA requires exactly one guarded page GET and no unused same-workspace RSC request. |
| Native transactions and recruitment | 49 transaction cases and 42 recruitment/offer cases pass on disposable PostgreSQL, including concurrent writes, retries, immutable history, publication and authority loss. |
| Native security | 9 cases pass on dedicated disposable PostgreSQL. |
| Native scheduler, audiences and events | All dedicated jobs pass, preserving scheduler recovery, recipient scope, publication, outbox and event invariants. Exact counters are in the receipt. |
| Accessibility | Public/demo 27 pass; authenticated 18 pass. |
| Writing and dashboards | Both real Auth/production-build browser journeys pass. Stable refresh label, disabled/busy state, retained content and error recovery are checked. |
| Admin and dependent workflows | All Admin-session MFA/AAL2/session binding/revocation, workspace, invitation/scheduling/publication and audience assertions pass. The Admin workspace/session stage reports 31 passing cases; dependent HTTP workflows report 22. |
| Additional gated workflows | Corkboard and club assets/private decision letters pass; communications reports 5 passing cases; active-room authority/revocation reports 3. |

[Standard production verification](https://github.com/TheFrtiz22/out-class/actions/runs/41120761640),
[disposable integrations](https://github.com/TheFrtiz22/out-class/actions/runs/41120761637)
and [gated supplement](https://github.com/TheFrtiz22/out-class/actions/runs/41120776403)
identify the exact source and jobs.

Every private read retains remote identity verification, live session/account/
membership/capability checks, support and Demo isolation, strict arguments,
private no-store responses and Cookie handling. Page and complete selection
share their caller's Repeatable Read snapshot. Voting additionally retains its
live post-snapshot permission/participant checks. Source hashes prove the CRM
and voting write tails, locks, publication and history protections are unchanged.

Global metadata is projected through the existing canonical anonymity,
self-review and submitted-review barriers before search/order/count/selection.
Archived round privacy is included internally while archived controls and gender
eligibility remain unavailable. Missing privacy fails closed. Current query,
authority epoch and mutation owner fence rows, detail, setters and handoffs;
starting a new guarded read permanently supersedes previous complete coverage.
Coalescing retains only identical pending promises and removes them on settlement.

The independent dock repair is already in measured main. Current ordinary
browser checks retain unforced pointer, touch, keyboard/Escape/focus, reduced
motion and responsive interactions. No additional dock diff or forced click is
introduced. Filter/sort/paging, complete selection, browser history, rapid changes,
revocation and autosaved drafts are functionally checked; separate controlled
latency distributions for every one of those individual operations are not
available beyond the recorded navigation and complete-review stages.

The local Node 26 parallel ordinary run had three PDF/browser failures. Two
explicitly hit processing timeouts. All 22 cases in those three files passed
unchanged when run sequentially; the fresh full CI run passed all 1499 active
cases. `revision-2/attempt-2/LOCAL_QA.json` retains both outcomes and log hashes. The failed
local run is not reclassified or changed into skips.

No production mutation, deployment, region/pool change, authorization cache,
schema/index change or new infrastructure is part of this repair. Controlled
CI timing results cannot establish a hosted latency SLO. Existing sanitized
production evidence remains inconclusive about the historical Auth stall.
