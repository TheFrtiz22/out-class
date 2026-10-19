# Local remediation — October 18–19, 2026

Implementation baseline: `9e39b6a82db610ac2c911fda56b3805d61ff5745`. These changes are local and have not been deployed. Historical Stage A evidence remains in `../evidence/`; results here supersede the affected local verification statuses, not the production baseline.

## Changes and evidence

| Change | Reason / behavior preserved | Verification |
|---|---|---|
| Shared explicit `accountClubSelect` / `accountUserInclude` in `lib/account-data.ts`, used by `utils/current-user.ts` and `app/api/users/me/route.ts` | Removes internal decision templates from common account HTTP/RSC payloads. Retains existing Club scalar fields needed by features; future columns require explicit review. Recruiting's authorized template reader remains separate. Client account types match the projection. | `tests/account-data.test.cjs`; `tests/account-data-e2e.test.cjs` |
| All account API responses use `private, no-store` and `Vary: Cookie`; generic unexpected-error log | Covers success, unauthenticated, disabled/missing account, demo/support denial and error paths without printing provider details. Next can merge its own RSC Vary tokens. | Unit response branches plus real unauthenticated/authenticated HTTP assertions |
| Next / eslint-config-next 15.5.27, both Sharp resolutions 0.35.5, source-map-js 1.2.2 override | Compatible security patches; removes the obsolete nested Sharp resolution. No major framework migration. | Exact lockfile and installed resolution, `dependency-audit.json`, builds and image checks |
| `lib/communications-snapshot.ts` batches account status + notification count/latest/unread into one parameterized SQL query | Four base database operations become two per poll. Preserves legacy conversation authorization/revision, disabled-account rejection, hash format, unread semantics, polling cadence and private cache behavior. | Full-migration PGlite fixtures, account-isolation/read/archive/restore/revocation checks and native Prisma hash/count parity |
| `actions/availability.ts` requires confirmed participation in both coverage projections | Fixes a newly reproduced overcount: a declined/unconfirmed interviewer with saved availability appeared in capacity lists even though assignment validation rejected them. Preserves saved documents, existing assignments and participation workflows. | New draft → confirm → decline regression fails on the committed pre-fix action and passes with the patch; real browser audit retains exact expected coverage counts |
| `components/club-workspace.tsx` keeps scheduling mounted during round changes | Fixes the reproduced round/week reset when the parent keyed the scheduling surface by URL round ID. Club/authorization and non-scheduling editor resets are retained. | Real parent browser test across round changes, Back and club changes, plus the real scheduling journey |
| Performance harness service mocks follow current imports and transaction boundary | Restores the existing synthetic benchmark without changing application queries or weakening permissions. | `performance-harness.json`; timings remain local/mock measurements |
| Scheduling browser audit follows current entry URL and workflow | Tests current dashboard availability links, times form, session sheet/autosave, interviewer approval and mobile flow. Retains DB snapshots, authorization denials, stale-revision races, lock preservation, lost responses, affected-only notifications and rollback checks. | `scheduling-e2e.txt` |
| Scheduling fixture runner checks the reserved port and child startup before using HTTP readiness | Prevents a leftover local server from being mistaken for the newly built artifact. A preflight rejection preserves retained fixtures; normal runs clean up their own stack. | Fresh standard runner plus reserved-port startup guard |
| Onboarding runner includes real account regression tests sequentially | Prevents the new security contract from depending solely on mock tests. Uses only the reserved local Supabase fixture. | `onboarding-e2e.txt` |

No visual design, production data, database schema, credentials, RLS, Storage or WAF setting was changed. No database migration is included. Source and dependency changes can be reviewed independently.

## Validation results

- Node 24 default suite: **1,235 passed / 31 skipped / zero failed** (`tests.txt`). Optional native/E2E skips are separate from passing cases; the real runs below cover some of those fixture-gated groups.
- Real Next HTTP/RSC + local Supabase Auth/TOTP/PostgreSQL/SMTP: **20 passed, zero skipped or failed** (`onboarding-e2e.txt`), including the five new account/snapshot subtests and their parent.
- Dedicated native publication/worker/availability/recipient suites: **65 passed** across five groups, plus populated upgrade and migration-status checks (`native-publication.txt`). The runner removes its disposable container. Logged injected worker failures are expected assertions.
- Typecheck and lint: passed, **26 existing warnings**, zero lint errors.
- Full Linux x64 / Node 24.22.0 dependency/account/snapshot artifact build: passed with frozen lockfile. Both direct and Next Sharp 0.35.5 pass PNG decoding/encoding, WebP and AVIF. The minimal Debian image emits an OpenSSL detection warning; native database execution was verified separately on the guarded local Prisma fixture. The later coverage and scheduling state fixes are covered by the final scheduling build and correctness tests; this Linux build predates them.
- Follow-up hydration check: **27 authenticated page hydrations passed** across desktop/mobile and Los Angeles/Tokyo browser time zones (`hydration-probe.json`). One earlier fresh scheduling run emitted React 418 at its final runtime-error gate. It did not recur in the clean full run or focused follow-up, but its source is unisolated: [incident record](hydration-incident.json). Added URL/stack diagnostics; no suppression or fix claim.
- Synthetic performance harness: completed successfully (`performance-harness.json`); these timings are not production improvements.
- Real scheduling browser journey: **all ten scenario groups passed** (`quality-acceptance.json`), covering desktop/mobile, exact coverage, round/week persistence, competing edits, lost-response retry, affected-only notices, injected rollback, eligibility/room invalidation and touch editing. Screenshots were visually inspected.
- The coverage and parent-state regressions both fail against their pre-change action/component and pass against the patch (`coverage-regression-before.txt`, `availability-tests.txt`, `scheduling-state-before.txt`, `scheduling-state-browser.txt`). These two intentionally failing baseline runs are distinct from the passing current suite.

React review applied the Vercel `react-best-practices` skill: account types remain type-only in the client; scheduling retains local state only within the same club/authorization scope; existing accessible controls, icons, effects and permission gates are preserved.

## Before and after

| Measure | Stage A / implementation baseline | Local result | Production result |
|---|---|---|---|
| Internal decision templates in ordinary account response | Present in actual local HTTP; full Club includes in HTTP and RSC | Excluded by explicit projection; role/tenant regression checks | Await approved release and safe verification |
| Confirmed-only staffing coverage | Declined/unconfirmed snapshots can inflate available lists; browser observed 5 available where 4 were confirmed and eligible | Both readers require confirmation; preserved draft/decline records | Await approved release |
| Scheduling parent state | URL round changes remount the parent and can reset round/week state | Same scheduling scope survives round/history changes; club switches reset it | Await approved release |
| Registry dependency advisories | 3 High + 2 Moderate | 1 High remains: build/lint `braces@3.0.3`, no published patch | Deployed artifact unchanged |
| Communications snapshot base DB operations | 4 per tick | 2 per tick, verified with real query counters | Not deployed |
| Continuous tab polling model at a 2-second interval | Up to 120 base operations/minute | Up to 60 base operations/minute | Model only; excludes auth/reconnect overhead and query duration |
| Club workspace p75 LCP / INP | 7,668 / 648 ms, seven-day aggregate | No new field measurement | Unchanged baseline; no speedup claim |
| Workspace API p95 TTFB | 4,628 ms, seven-day aggregate | No matched remote latency measurement | Await operation-specific profiling after release |

The 50% reduction is an operation-count result for the snapshot helper, not a 50% latency, infrastructure cost or page-load claim. Existing notification/legacy conversation semantics are retained. The combined notification scan uses the existing user filter; no unmeasured index or shared private-data cache was introduced.

## Remaining release gates

- Stage and approve runtime/migration credential separation. The production `postgres` finding remains open; no permission or connection string was silently modified.
- Review and approve the application release, then verify deployed dependency resolution, safe account headers and aggregate error/latency signals. Keep a patched artifact available for rollback; do not roll back automatically to the vulnerable dependency set or restore template disclosure.
- Keep `braces` tracked until a supported patch is available; assess untrusted CI pattern inputs. No runtime exploit was demonstrated.
- Investigate the intermittent hydration observation in a preview and retain the runtime-error gate. A clean follow-up is not proof of its root cause or resolution.
- The broader audit gaps remain: second-university domain policy and E2E, strict ordinary-session replay policy, native exclusive booking races, optional native/Storage/admin suites, function/check/bucket hardening, privacy-safe telemetry, restore rehearsal and performance attribution.
- Production database, RLS, credential, migration and aggressive WAF changes still require the user's explicit approval after exact staging evidence and rollback are ready. This batch does not include such a proposal and does not request blanket approval.

## Reproduction scope

Use Node 24 (the production major). `node scripts/run-onboarding-e2e.cjs` provisions its reserved local Auth/PostgreSQL/SMTP fixture and runs account regression tests alongside onboarding. `node scripts/run-availability-e2e.cjs --audit` provisions its own reserved local scheduling fixture. Both runners guard their identities/ports and clean up their projects. Outbound provider delivery is disabled or captured locally. Optional default-suite skips remain visible.

The bounded follow-up secret scan inspected 553 reachable commits / 5,503 blobs and 408 client files, with no client findings; its only current/history pattern hit remains the documented localhost placeholder. This follow-up includes tracked and untracked non-ignored files up to 5 MB, reachable history and local client artifacts; unknown secret formats, ignored files and deployed logs remain outside that scan.

The old `../verify-account-projection.cjs` is the historical vulnerable-behavior reproduction; use the new regression tests for the patched source. Reports contain synthetic fixture labels and aggregate results, not student records or usable credentials.
