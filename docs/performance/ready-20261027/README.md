# Ready performance subset — October 27, 2026

User-authorized integration of two independently reviewed changes onto current remote main `d0313644f981e7428b84eb1ec980e6863c135c35`. The newer light/navy glass navigation is preserved. The accumulated Phase 2–15 application branch is not merged. The original UI checkout remains unchanged.

## Included

- `app/layout.tsx`: set the two existing local font groups to `preload: false`. All four upright/italic variable font files, weights, fallbacks and swap behavior remain. Rendered upright faces load normally; italic faces load when actually rendered.
- `components/club-logo.tsx`, `lib/club-assets.ts`, `public/logos/README.md`: unknown clubs render the existing accessible monogram immediately. Explicit/protected/preview URLs retain priority; only checked-in legacy artwork is inferred. Broken images still fall back and a replacement source retries. Prototype-inherited mapping keys are rejected.
- Focused font/logo regressions and two inherited navigation-test repairs. The dock test polls actual settled 272px geometry instead of assuming the spring finishes within 380ms; its strict final-width and other assertions remain. The Phase 1 rapid-switch test opens the actual keyboard-accessible Applicants flyout; all three concurrent reads, scheduler exclusion, revocation and privacy assertions remain.

No API, Auth, database, schema/index, dependency, region, production configuration, security policy or application animation changes. The exact four-file application patch is [APPLICATION.diff](APPLICATION.diff), using zero context (apply with `git apply --unidiff-zero`); source/build hashes are in [BASELINE_SOURCE.json](BASELINE_SOURCE.json) and [CANDIDATE_SOURCE.json](CANDIDATE_SOURCE.json).

## Verification

- Current-main baseline normal signup/Auth/TOTP provision: 38 passed, no failures/skips; both frozen production builds pass.
- Candidate ordinary suite: 1,355 passed, 40 environment-gated skips, zero failures/cancellations (1,395 total).
- Complete selected live suite:37 passed, zero failures/skips, including desktop/mobile on-demand font faces, live identity/session/revocation/account/capability/suspension, Demo/anonymous scopes, three independent Interview Rooms reads, hidden scheduler, Settings saves/history and account privacy.
- Dedicated native security/concurrency: 3 passed. Existing 57 fresh/legacy migrations and 78 browser-denial/RLS tables pass. Types and lint pass; lint retains 22 existing warnings.
- Standalone logo source/markup/browser checks pass; the actual 390px logo-settings screenshot was inspected. Protected references, explicit overrides, legacy art, broken images and replacement recovery remain covered.

The first ordinary run has 1,354 passes,40 skips and one failure because the dock width was sampled at 272.078125px while its spring was settling. The complete rerun passes after the strict final-state wait. The first selected live run passes 35 and fails two counts (one child plus parent) because an inherited selector cannot see Applicants inside the new flyout. The repaired default gate and entire 37-case live selection pass afterward. The complete ordinary rerun precedes that gated-only selector repair; the repaired gate/live checks and final lint follow. All failed logs remain, and no product delay, assertion or benchmark readiness rule was weakened. [QA.json](QA.json) records status/intervals and resolution links. Counts overlap and must not be added.

## Current-main initial-load comparison

The existing `navigation-audit.cjs --initial` harness runs BA then AB on the same unchanged disposable 100-applicant fixture. Each block includes one excluded warmup and ten measured outcomes per route: 80 measured/8 warmup observations; n=20 per build/route. These are fresh desktop browser contexts with warm local production services, no CDP throttle. All application builds and functional test runs finish before collection; no tests/builds run during it. Final lint after the harness repairs is recorded separately. Sources, harness and plan stay frozen; read-only host checks and actual Sleep/Wake/DarkWake audit pass.

| Initial authenticated route | Before p50 / p95 / max ms | After p50 / p95 / max ms | Median requests before→after |
|---|---:|---:|---:|
| overview | 268.6 / 300.5 / 412.9 | 267.4 / 308.4 / 311.0 | 61→57 |
| personal | 436.2 / 450.3 / 451.8 | 446.9 / 452.9 / 456.5 | 62→60 |

**Accept the resource-avoidance subset; do not claim a consistent local latency speedup.** Overview median changes−1.2ms and p95+7.9ms; Personal median changes+10.7ms and p95+2.6ms. These small, mixed timing differences do not establish significance or hosted performance. The request saving is measured; font regression checks independently prove only the two used upright faces transfer at first, with both italic variable faces subsequently loading on real CSS demand. The prior Phase 10 constrained font saving belongs to its separate historical build, not this combined-main comparison.

All current measured raw rows and warmups remain under [comparison/](comparison/). [INITIAL_COMPARISON.json](INITIAL_COMPARISON.json) computes nearest-rank p50/p95 and actual maxima from every measured row. Its initial-mode harness does not export per-request byte/error details; those fields remain null. Successful process/readiness completion is not a fabricated HTTP/page-error count. Separate functional browser checks assert successful font responses and no page errors. This is an initial-source test, not cold/warm tab timing, a Vercel cold-start test, or whole-series release clearance.

## Remaining work

The full locally retained series still has unresolved identity stalls, Settings first-use costs and fresh-page/resident-summary tradeoffs. Phase 14/15 experimental app changes stay reverted and excluded. The four consolidated review deliverables are in the separate local diagnostic commit `f47166e`, branch `codex/performance-review-handoff-20261027`; this main integration does not bring its experimental ancestry with it. The user requests investigating those issues after this ready commit.

## Reproduction

Use a fresh isolated worktree from the base SHA and only the application patch above; preserve the original UI checkout and unrelated services. Dependency manifests match, and no dependency update is needed. Provision the existing reserved loopback fixture with `node scripts/run-onboarding-e2e.cjs --keep`, seed with `node scripts/navigation-audit.cjs --seed`, freeze the baseline production build, apply the patch and freeze the candidate build. Run the ordinary suite with file concurrency 2, `node tests/authorization-migration.cjs`, `node scripts/run-disposable-postgres.cjs security`, `npm run typecheck`, and `npm run lint`.

Selected live command (set `OUTCLASS_ONBOARDING_E2E_CONFIG` only to the reserved local config):

```sh
node --test --test-concurrency=1 tests/navigation-phase10-e2e.test.cjs tests/navigation-phase1-e2e.test.cjs tests/settings-navigation-e2e.test.cjs tests/account-data-e2e.test.cjs tests/session-revocation-e2e.test.cjs tests/signup-privacy-e2e.test.cjs
```

After QA, swap only those frozen `.next-publish` snapshots under the same private local runtime environment. For B,A,A,B blocks, run `node scripts/navigation-audit.cjs --initial --samples=1 --out=<fresh-warmup-directory>`, then `--initial --samples=10 --out=<fresh-measure-directory>`. Keep the descriptor/database identical and never overwrite these evidence directories. The read-only monitor reused from diagnostic commit `dd30454` samples foreign builds/tests, dev CPU, original checkout and power; its hash is recorded in the protocol. Audit actual sleep events using that commit's `docs/performance/phase15/analysis/audit-power.py <comparison-directory>`. It is a reused test-only observer, not shipped application instrumentation.

The private orchestration simply calls these existing tools and guards owned listeners before stopping them; no production environment files/accounts are used. Preserve all warmups/failures, scan/redact known private fixture values and generic credentials, stop/remove only the owned project/app, restore the prior inactive fixture directory and delete private snapshots/credentials. Cleanup and evidence hashes accompany this report. Publication/CI/deployment status must be verified separately for the resulting main commit; no deployment claim is made by this pre-commit report.
