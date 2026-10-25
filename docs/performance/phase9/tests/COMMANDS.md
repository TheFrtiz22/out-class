# Phase 9 verification runners

These are reproducible runner descriptions, not an unredacted shell transcript. Live commands require the reserved disposable local fixture and its private configuration; no production environment file is loaded.

| Evidence | Runner / scope |
|---|---|
| `unit-final.log` | `node --test tests/*.test.cjs`; 1,405 pass, 55 gated skips |
| `live-initial-fixture.log` | Explicit live file list below with `--test-concurrency=1`; 54 pass, five large-fixture skips |
| `live-large-final.log` | After `pipeline-scale-fixture.cjs 1000`, only the five skipped cases with the name pattern below; five pass, zero skips |
| `security-final.log` | `node scripts/run-disposable-postgres.cjs security`; existing native loopback/name guards retained |
| `migrations.log` | `npm run test:migrations`; fresh and legacy local test databases |
| `provision.log` | `node scripts/run-onboarding-e2e.cjs --keep`; normal verified signup, actual TOTP and captured SMTP |
| `build-final.log` | `node scripts/navigation-phase9-local.cjs build`; build `5VpZztU4YDOYGkpRc-HX0` |
| `typecheck-final.log` / `lint-final.log` | `npm run typecheck` / `npm run lint` |
| Fixture/pilot logs | Development selector-identity/native-null corrections, rejected gender fixture and native differential probe; no changed production constraints |

Live test selection:

```text
tests/account-data-e2e.test.cjs
tests/session-revocation-e2e.test.cjs
tests/signup-privacy-e2e.test.cjs
tests/navigation-phase1-e2e.test.cjs
tests/navigation-phase2-e2e.test.cjs
tests/navigation-phase3-e2e.test.cjs
tests/navigation-phase5-e2e.test.cjs
tests/navigation-phase6-e2e.test.cjs
tests/navigation-phase7-e2e.test.cjs
tests/navigation-phase8-e2e.test.cjs
tests/navigation-phase9-e2e.test.cjs
tests/settings-navigation-e2e.test.cjs
```

The targeted followup used `--test-name-pattern` with this expression on navigation Phases 3, 5 and 7:

```text
paged applicants preserve|fresh page boundaries|rapid global searches|editable review drafts|paged navigation remains bounded
```

Live children receive `navigation-phase9-local.cjs`'s loopback-only environment and `OUTCLASS_ONBOARDING_E2E_CONFIG` pointing to the disposable `config.json`. The native metadata test performs 86 differential scope comparisons in a rolled-back transaction, plus an injection-shaped parameter case; the separate HTTP acceptance tests exercise the live guards.

Primary benchmarks use `navigation-phase9-study.cjs`; supplemental browser and bounded HTTP runs use `navigation-phase9-supplement.cjs`. Both protocols freeze build/source/tool/plan hashes and retain warmups and all planned outcomes without retries. The 200 pilot loader observations are excluded in `PILOT_EXCLUSION.json`.

No test suite or build from this task overlapped accepted measurement. Do not bypass administrator rate limits or native database guards. Cleanup removes this run's credentials; live reproduction needs fresh normal provisioning.
