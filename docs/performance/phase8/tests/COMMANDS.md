# Phase 8 verification runners

The adjacent logs are the retained final results. These are runner descriptions for reproduction, not an unredacted shell/session transcript. Only the reserved local fixtures are permitted; no production environment file is needed.

| Evidence | Runner / prerequisites |
|---|---|
| `unit-final.log` | `node --test tests/*.test.cjs`, without optional live-fixture variables; the 54 gated skips remain visible |
| `focused-final.log` | Focused CRM/privacy, selected workspace, applicant view, page read/owner, diagnostics and deterministic summary test files; included in the ordinary suite as well |
| `live-final.log` | The explicit file list below with `--test-concurrency=1`, the real local app running and `OUTCLASS_ONBOARDING_E2E_CONFIG` pointing to the private disposable config |
| `security-final.log` | `node scripts/run-disposable-postgres.cjs security`; uses its own guarded disposable PostgreSQL and removes its containers |
| `migrations.log` | `npm run test:migrations` against the existing disposable migration-test harness |
| `provision.log` | `node scripts/run-onboarding-e2e.cjs --keep`; normal verified signup, actual TOTP, captured local mail and authoritative local migration application |
| `typecheck-final.log` | `npm run typecheck` |
| `lint-final.log` | `npm run lint` |
| `build-final.log` | `node scripts/navigation-phase8-local.cjs build`, using the disposable fixture environment and `.next-publish` |
| `relation-parity-final.log` | Exact canonical full-summary versus page projection comparison against the enriched local 5,000 cohort; no returned application body retained |

The final live selection was:

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
tests/settings-navigation-e2e.test.cjs
```

The local lifecycle helper supplies only loopback Auth/database/mail credentials, an eight-connection Prisma limit and Microsoft OAuth disabled. Navigation fixtures must be seeded for the live suites. Do not bypass native database-name/loopback guards or the Auth administrator rate limit. Cleanup removed this run's credentials; rerunning live verification requires fresh normal provisioning.

Primary collection used `navigation-phase8-study.cjs`; supplemental collection used `navigation-phase8-supplement.cjs`. Both protocols retain tool and plan hashes, all warmups, BA/AB order and source/build manifests. Analysis entry points are `scripts/summarize-navigation-phase8.cjs` and `docs/performance/phase8/analysis/`. Measurements did not run alongside test suites or builds.
