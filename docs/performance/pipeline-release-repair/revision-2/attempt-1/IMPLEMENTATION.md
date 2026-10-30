# Revision 2 repair

This revision integrates main `0a40de7c`. It is a new candidate; revision 1's
rejection, raw observations and whole-attempt exclusions remain preserved at
`b2d8883d` and in the existing reports. Release clearance is pending the new
protocol and final functional checks.

The initial page previously selected each application's round relation after
the guarded transaction had already selected the club's active rounds. The
page now uses a complete internal round-privacy map from that same transaction's
club-round read. Archived rounds are included internally so their applicants
retain canonical anonymity, but remain absent from public round controls and
gender eligibility. Missing privacy information fails closed before hydration.
Both ordinary and review-dependent metadata omit the redundant round relation;
canonical full-detail hydration remains bounded to the visible page. Cursor
scope includes the complete round-privacy map. The separate voting-selection
reader retains its canonical round relation because its snapshot caller does
not supply that map. Authorization, isolation and writes are unchanged.

The page hook previously reran the full canonical selector against an already
ranked, exact server response when that page happened to cover the whole
selection. It now retains that exact response for its current owner and derives
a local page only when the query changes within still-valid complete coverage.
Authority epoch, mutation revision, supersession, denial and owner fencing are
retained. This policy uses actual coverage, without a cohort-size threshold.

The Admin-session integration test now identifies the authenticated Admin
shell by `data-product-shell="admin"`. The obsolete “Admin workspace” copy had
caused the previous failure. Status, redirect, protected overview, MFA/AAL2,
session binding, revocation, disabled-account and support assertions remain.

The strict collector observes character-data changes, avoids inspecting
unrelated rows during sheet/dialog stages and coalesces mutation bursts before
two-frame readiness checks. Independent real Chromium QA is recorded in
`OBSERVER_QA.json`. Its 5000-row detail fixture completed after a text-node-only
change with zero directory geometry reads. The directory burst performed only
the two required scans. No old recorded delay is subtracted or reclassified.

The new CI matrix separates each cohort/profile/collector into its own paired
B/D/D/B unit, with a dedicated capacity unit. `PROTOCOL.md` declares this before
measurements and retains the original samples, warmups and limits.

Focused checks cover canonical privacy, locale ordering, facets, scores,
filters, cursors, bounded hydration, archived rounds, missing-round denial,
exact response reuse and stale authority/query/mutation protection. Full
ordinary and hosted disposable checks are additionally required; an ordinary
suite's environment-gated skips do not establish integration clearance.
