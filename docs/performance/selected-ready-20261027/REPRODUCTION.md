# Reproduce the isolated selected-startup comparison

Use a separate worktree at `06d3e93110d09fc564de7e28cf7dc3a71f081fe4` and the dependency lockfile already in that commit. Preserve the original checkout and all unrelated services. Never read production environment files or use production credentials/data.

1. Record source/main/original-checkout/container states. Refuse occupied reserved ports 3107/55321/55322/55324/55325 and any existing `outclass-onboarding-e2e` containers. Move only the prior inactive disposable fixture directory aside and record its path in mode-600 `/tmp/outclass-selected-ready-fixture-backup-path`. Create a mode-700 temporary directory prefixed `outclass-selected-ready-builds-`, recorded in mode-600 `/tmp/outclass-selected-ready-builds-path`.
2. Provision the existing loopback fixture and normal verified signup/TOTP flow: `node scripts/run-onboarding-e2e.cjs --keep`. Preserve its complete 38-test log. After it passes, `node scripts/navigation-selected-ready-local.cjs stop` and `node scripts/navigation-selected-ready-local.cjs snapshot baseline`. Seed the independent 100-applicant navigation descriptor with `node scripts/navigation-audit.cjs --seed`. Record the baseline build and source manifest before editing application files.
3. Apply only `APPLICATION.diff` with `git apply --unidiff-zero`. It includes the nine application files in `PLAN.json`; no later paging/projection/Settings experiment. Build and snapshot: `node scripts/navigation-selected-ready-local.cjs build`, then `node scripts/navigation-selected-ready-local.cjs snapshot candidate`. Verify all application/build source hashes and exactly those nine differences. The measured candidate must match `CANDIDATE_SOURCE.json`; the full `IMPLEMENTATION.diff` also includes tests/tools/evidence references.
4. Before collection, run the checks below and the serialized live selection against the candidate. Preserve all initial failures and repaired-harness checks. The old retained-directory test is replaced with the new fresh-visit contract; the loading harness gains an explicit no-op diagnostic-module mock. No application behavior/readiness/assertion is weakened.

```sh
node --test --test-concurrency=2 tests/*.test.cjs
node tests/authorization-migration.cjs
node scripts/run-disposable-postgres.cjs security
npm run typecheck
npm run lint
node scripts/navigation-selected-ready-local.cjs start candidate
```

The live selection uses the private fixture environment returned by the lifecycle helper, with `OUTCLASS_ONBOARDING_E2E_CONFIG` set to its reserved `config.json`; do not print that config or export credentials into report text:

```js
const local = require('./scripts/navigation-selected-ready-local.cjs');
const cp = require('node:child_process'), path = require('node:path');
const names = ['account-data-e2e','navigation-phase1-e2e','navigation-phase2-e2e',
  'navigation-phase10-e2e','navigation-phase12-e2e','session-revocation-e2e',
  'settings-navigation-e2e','signup-privacy-e2e'];
const result = cp.spawnSync(process.execPath,
  ['--test','--test-concurrency=1',...names.map(n => 'tests/' + n + '.test.cjs')],
  {env:{...local.environment(),OUTCLASS_ONBOARDING_E2E_CONFIG:path.join(local.root,'config.json')},stdio:'inherit'});
process.exit(result.status ?? 1);
```

5. Freeze the plan, candidate source, both snapshots, fixture and collector/tool hashes. Under the authorized idle/open-lid interval and a temporary awake assertion, collect sequentially. The driver refuses existing profile output; a repeat requires a new separately declared evidence location, never overwriting these results.

```sh
caffeinate -dimsu -t 3600 node scripts/navigation-selected-ready-study.cjs --profile=local
python3 docs/performance/selected-ready-20261027/analysis/audit-power.py docs/performance/selected-ready-20261027/local
caffeinate -dimsu -t 3600 node scripts/navigation-selected-ready-study.cjs --profile=constrained
python3 docs/performance/selected-ready-20261027/analysis/audit-power.py docs/performance/selected-ready-20261027/constrained
python3 docs/performance/selected-ready-20261027/analysis/summarize.py
```

No builds/tests run during these profiles. Keep BA/AB order, all four paths and cold/warm visits, one warmup/five measured per block/group: 320 measured outcomes plus 64 excluded warmups. Reject whole profiles on observed host/source/sleep failures; retain every slow/error row. Never pool with prior phases or instrumented diagnostics. Validate zero/null/nonfinite metrics and pending/failed/body accounting, then independently recompute population membership and quantiles from raw rows.

6. Review the complete comparison against `PLAN.json`, including source preparation, tails and explicit warm fresh-validation costs. Record the adoption decision; preserve any rejected patch and return to baseline if required. Archive logs with known fixture values and credential patterns removed; raw cookies/tokens/SQL/data never enter reports. Scan the whole evidence package before publishing it.
7. Stop/remove only the owned app and project containers/volumes, restore the selected final build and prior inactive fixture directory, delete private credentials/snapshots/markers and end owned awake assertions. Verify original checkout and all 21 unrelated container states. Create checksums and final evidence metadata.
8. CI runs `node scripts/run-onboarding-e2e.cjs --club-integration --selected-navigation`, which seeds its fresh reserved navigation fixture and executes phases1/2/10/12 after the normal Auth/settings/runtime tests. The explicit mode rejects other fixture selections before touching services. This wiring follows timing and changes no application source.

9. The user authorizes ready changes to main. Re-fetch main, preserve intervening changes, publish only a validated ready patch, wait for hosted checks and verify the exact resulting commit/deployment status. The broader diagnostic/report branch and failed experiments remain separate.

Local cold/warm observations are not hosted cold starts. Source+click sums two separate waits, not an uninterrupted journey. Nearest-rank p95 at n=10 equals maximum. Host sampling cannot prove exclusive access or fixed CPU/thermal state. No regional, production configuration, schema/index or security change is part of this procedure.
