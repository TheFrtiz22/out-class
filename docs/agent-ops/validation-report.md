# Validation report

Appended by `outclass-release-check`. Newest first.

2026-11-05 #127 / 2427d3b8 (authz follow-up to #120; no migration) app gates: CI required checks pass; local voting-slide-preparation.test.cjs 7/0/0, 2/0 browser | fixes MEDIUM: preparation page now withholds highlights whose source the leader cannot view (count only, preserved on save); LOW: profile highlights limited to the round applicant display
deploy dpl_9J6Whiq6SWA1DjfYVzt3dLg7QX85 READY yes, serving out-class.net / www / uva | verdict OK | rollback target dpl_9TMorBuQ8uqQtjhk4KdZZK9L38jh
2026-11-05 #125 / 0a9a34f0 (club voting rules) app gates: CI 16/16 on merged head; local feature tests 25/0/0, migrations 68+ fresh/legacy ok (82 tables RLS) lint ok types ok | integration skips: CI env-gated suites as baseline | agent-hook tests n/a | authz review (general-purpose agent with authz-reviewer brief; agent type not yet loaded): no high; MEDIUM (prep read path) fixed in #127
deploy dpl_9TMorBuQ8uqQtjhk4KdZZK9L38jh READY yes | new runtime error classes 0 (2h window: one pre-existing /login Supabase-env class since 2026-10-12) | advisor delta 0 (new tables RLS+policies, functions set search_path, no SECURITY DEFINER) | migration 20261105170000_voting_rules applied by owner approval, ledger 69 | rollback target dpl_H6WkuK4TNf8tWsjXKvUt6dqftTgV | verdict OK
2026-11-05 #120 / 3a1be040 (voting slide preparation) app gates: CI 16/16; local slide-prep tests 5/0/0 unit + 1/0 PGlite, 2/0 browser | migration 20261105150000_voting_slide_preparation applied by owner approval (ledger 68), checksum = sha256 of committed file | authz: MEDIUM co-leader could read withheld-source highlight text on the preparation page (slides unaffected) -> fix #127
deploy dpl_CnLJCeMS23sFu8hDhc1wSwmXNFeC READY yes | new runtime error classes 0 | advisor delta 0 | rollback target dpl_Ech7R1kGKSJLN5Xckkzwfn6W2uWY | verdict OK after #127
2026-11-05 #121 / b872cafa (voting in every round; no migration) app gates: CI 16/16; local every-round tests 4/0/0 | authz n/a beyond #125 review
deploy dpl_CKY6uFSoom6tKMBa37QYEhZTiLwt READY yes | new runtime error classes 0 (24h groups all pre-existing) | advisor delta 0 (0/54/43 = baseline) | rollback target dpl_9E2uRkPbZkvtR7sgB8TDgWx7oTmM | verdict OK


2026-11-05 backend/booking-throughput (merge on bd3e12d3) app gates: test 1588/0/58 migrations 67 ok (80 tables RLS) lint ok types ok build ok | integration skips 58 (env-gated e2e/native suites; security suite run separately 11/11, booking+ballot contention 14/0) | agent-hook tests 29/0 | authz-reviewer: no high/medium, LOW-1/LOW-2 fixed before merge
deploy <pending> | runtime errors <pending> | advisor delta <n/a, no migration> | rollback target: production deploy of bd3e12d3 | verdict <pending>
