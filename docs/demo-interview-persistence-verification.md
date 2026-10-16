# Demo interview persistence verification

2026-10-16. Baseline source: `908f77c08baeb5b39d8902d66fe7aeff2c68b89f`, production deployment `dpl_DKKCTY4F5njLTaKeu2NxMRNeShP3`. Fix: the commit introducing this document (branch `codex/demo-persistence`). No database, dependency, authenticated adapter, permission, or UI changes.

## Confirmed cause and change

Selection plus its immediate collaboration refresh wrote the entire Demo snapshot six times:

1. Selection's room lookup reopened an existing session through mutate/save.
2. That lookup mutated/saved an existing collaboration room.
3. Selection reopened the same session again.
4. Selection saved the actual shared question change.
5. The hook's immediate refresh reopened the session again.
6. That refresh mutated/saved the room again.

An unchanged refresh also parsed/validated stored state and notified broad subscribers. Polling repeated the two read-path writes every three seconds.

Existing sessions and rooms now return authorized copies without mutation. Unchanged serialized storage is recognized without parsing or notifications; changed external snapshots still validate and refresh once. Synchronous session/room initialization and selection commit as one transaction, notifying after successful storage. Storage failure propagates and rolls back in-memory changes. Initialization/legacy preparation remain enabled. Current authorization is checked on every lookup; the serialized-state comparison does not cache permission results.

| Operation | Before snapshot writes | After snapshot writes |
|---|---:|---:|
| Selection plus immediate refresh | 6 | 1 |
| Unchanged collaboration read/poll | 2 | 0 |
| Missing session/room initialization | Multiple | 1 |
| Repeated unchanged storage refresh | 0, redundant notifications | 0, zero notifications |

## Browser evidence and limits

Actual Dell Pro 14 Essential PV14250, Core 7 150U, 15.7 GiB RAM; installed Chrome 155.0.8059.80 (both recorded comparison runs), headless isolated browser contexts, no throttling. Both conditions use the same loopback production-mode React bundle, actual Demo provider/store/adapters, question component, collaboration hook, synthetic seed dated 2026-10-16, and existing `interviewTiming=1` diagnostic. Before substitutes only the three Demo modules from baseline Git source. No artificial action latency. These are component-browser measurements, **not full hosted Next.js measurements**. Fresh context means first editor in new browser storage, not an OS/network cold start.

| Handler to committed, focused editor | Before, n=5 | After, n=5 |
|---|---|---|
| Fresh context / first editor | median 220.0 ms; 208.1–253.1 | median 57.9 ms; 57.2–67.1 |
| Warm repeat selection | median 232.7 ms; 207.3–280.5 | median 61.5 ms; 51.3–85.0 |

Raw before samples: fresh `[220,248,208.2,208.1,253.1]`, warm `[209.5,237.1,207.3,280.5,232.7]`. After: fresh `[58,67.1,57.9,57.5,57.2]`, warm `[61.5,85,60.5,62.7,51.3]`.

Original Oct 15 full-site result (older deployed revision `4e40020`): median 1,713.5 ms, n=3. It is not a comparable baseline for this component fixture. The original Node probe (254.23 ms median selection + refresh) is a separate synthetic result, not browser timing. No claim that this fix explains or resolves the complete hosted delay. Painted feedback, event-queue delay, INP, authenticated interview timing, and physical touchscreen behavior remain unmeasured.

Local protected evidence directory: `%LOCALAPPDATA%/OutClass-staging-verification/performance-readonly-20261015`. Preserve original findings. New `controlled-before-final.json` and `controlled-after-final.json` include raw samples; matching `.trace.zip` files are Playwright browser traces, **not DevTools CPU profiles**.

## Checks

- Six focused persistence regressions: unchanged reads, atomic initialization, storage-failure rollback/retry, two-tab refresh/draft preservation, invalid snapshots and revoked access. Zero live action calls.
- Thirty existing Demo foundation/collaboration/workspace/mode regressions passed.
- Chrome component-browser regression passed: correct focused editor, zero-delay continuous typing with exact text equality, autosave/reload recovery, incoming cross-tab selection without losing private notes, zero unchanged-read writes/notifications, one external-change notification with no write echo.
- Type checking passed after local Prisma client regeneration for current main. Lint: zero errors, 28 existing warnings. Production Next.js build passed. No database mutations or migrations.
- Required PR checks and hosted release evidence must be recorded in the PR/release receipt. Hosted Demo acceptance is pending an authorized session; current account menu does not expose the existing Demo toggle. No real applicant opened or production fixture created for this work.

Reproduce component browser timing: set `OUTCLASS_DEMO_PERF_OUT` to an output JSON path and run `node --test tests/demo-persistence-browser.test.cjs`; set `OUTCLASS_DEMO_BASELINE=908f77c` for before. These variables affect only the isolated test, never production configuration.

For the remaining full-site attribution: use an authorized Demo/synthetic room, add `interviewTiming=1`, open DevTools Performance, enable screenshots, record five question selections with a return to the bank between each, stop, and save the trace locally. Repeat on the deployed fix with identical fixture, browser/cache condition and no throttling. Record each `data-question-open-ms`; inspect screenshots for first visible feedback and Main-thread tasks for remaining delay. Do not record real applicant data or send credentials.

## Release and recovery

Use the normal PR checks, merge without overwriting newer main, and Vercel's automatic main deployment. No production migration or maintenance is needed. Previous production application above remains schema-compatible for application rollback. Confirm the merged commit's Vercel status and the deployment ID served by the production domain. A successful build alone is not hosted workflow verification.

### Concurrent-main release blocker

PR #43 originally passed CI at `dc2f368` (1,190 passed, zero failed, 27 skipped; lint zero errors/28 warnings; type checking and build successful) and Vercel preview `4SKv6pFz6BdiZzQWWgtFrVnAyRWC`. These skips are not new passes. Required CI build logs contain an existing missing-DATABASE_URL diagnostic during static page collection, while completing the build; hosted production uses its guarded runtime connection.

Before merge, main advanced to `cf3a675554f3b3b1fb0327313dba10ac6e178dac`, adding separate event scheduling/flyer changes. They were merged into this branch without conflicts; no Demo implementation changed. That main revision's Vercel deployment `7zvDQ5b3gLb7YmXFMwu24NgUSQWj` failed. A read-only production catalog/ledger query at 2026-10-16T17:20:41Z confirms `Event.allDay` and `EventFlyerDeletion` are absent and `20261016020000_event_scheduling_flyer_limits` is unapplied. This migration includes constraints, a private Storage bucket limit update, triggers, a deletion queue and cleanup of unreferenced flyer rows; it is not part of the Demo persistence fix and has not been applied under this request. Do not bypass the database deployment guard or drop concurrent main changes.

Release remains blocked until that separate main prerequisite is resolved through an authorized release. No production migration, maintenance change, PR merge or production deployment was performed for this fix. The earlier deployed baseline remains the relevant hosted revision until a successful deployment is confirmed. The authorized browser's `/api/demo` diagnostic returns `allowed: true, enabled: false` despite the requested manual toggle; no hosted Demo performance claim is made. The controlled Dell browser evidence above remains valid. The exact hosted HTTP result of enabling Demo is still needed to diagnose that session step; another account login is not required while `allowed` is true.

### Resumed release, October 16

The owner explicitly authorized the event prerequisite after the above stop. Current main subsequently advanced to `e150adf056a40e63f80b6de1321c6353e06ab0a5`. A fresh read-only production query at 23:26 UTC found **both** `20261016020000_event_scheduling_flyer_limits` and `20261016030000_event_flyer_deletion_runtime_access` already applied by the intervening event release. All 56 production migration checksums match; no migrations are pending. The queue is RLS-enabled and owned by `outclass_production_app`. No SQL was reapplied, migration history fabricated, or additional production migration executed for PR #43. The newer main is preserved by merging it into this branch.

Migration review: adding the default-false column preserves timed events; the check and wider size limit accept historical valid rows. DDL takes table locks; the unreferenced-flyer DELETE is an intentional metadata cleanup and enqueues Storage paths, so application rollback does not undo cleanup. Triggers require the subsequent bounded-runtime ownership repair, already present in production. Do not blindly rerun either migration. Production's successful main deployment is `7TbTfvk1jG2LgCHapeBXFaHnBrBK` according to GitHub's Vercel status.

A disposable PGlite rehearsal with representative **synthetic** timed events and selected/replaced flyer rows passed: timestamps and selected references preserved, only unselected metadata queued, private bucket settings updated, 10 MiB accepted/oversize and malformed all-day values denied. Existing runtime-role tests passed for queue operations, restrictive RLS and replacement/cascade triggers. This is not a hosted staging or native Storage-provider test. Hosted staging still lacks six existing-main migrations (school requests, private club assets, communications runtime access, saved campus events, and the two event migrations); none were applied outside scope. Its database-backed application is not claimed verified. This Demo-only release adds no schema dependency beyond the already-deployed main.

Production backup API reports a completed 2026-10-16 09:14 UTC backup and seven prior daily backups; PITR is disabled. The previously recorded October 15 recovery rehearsal restored 75 public tables with matching row counts/content digests and migration ledger into a verified disposable loopback database. Provider-wide Auth/Storage restoration was not rehearsed. No new database mutation requires a fresh restore during this release. Application rollback to the prior successful main remains compatible with the unchanged schema; do not restore over live data for an application regression.

The intended Demo entry point was broken: `DemoMenuItems` still existed and enforced server-provided eligibility and save/unsaved guards, but `ProductShell` stopped mounting it in the account menu. Restored that existing component for signed-in, non-impersonating sessions. No allowlist, cookie, authentication or global security setting changed. Regression tests cover shell presence, anonymous/support exclusion, eligibility, enable/exit and saving/unsaved guards. The new mounting assertion failed against the old shell and passed after the fix. Required CI and hosted release results are recorded in PR #43 and the protected release receipt; hosted timings must remain separate from the component table above.
