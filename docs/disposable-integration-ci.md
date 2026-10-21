# Disposable integration verification

## Why these tests were skipped

The normal \`pnpm test\` suite intentionally does not boot Auth, Storage, Next.js, SMTP, or PostgreSQL. Environment-gated tests therefore report **skipped** unless their guarded configuration is provisioned. Migration fixtures and mocked-browser tests cannot replace the real service boundary.

This branch introduces a separate GitHub Actions workflow: **Disposable integration verification** (\`.github/workflows/disposable-integrations.yml\`). It runs on relevant pull requests, Mondays at 05:17 UTC, and through manual workflow dispatch. Every job runs on a fresh Ubuntu runner; no production secrets are supplied.

**A successful static coverage report does not imply all 34 tests were executed.** The coverage script lists unwired suites explicitly. Each integration job must pass independently.

## Run locally

Requirements: Node 22, pnpm 10, Docker with Linux containers, OpenSSL (for onboarding), and sufficient local space to start the isolated Supabase services. All commands run from the repository root.

| Runner | Command | Bound disposable environment |
| --- | --- | --- |
| Auth, MFA, settings, navigation, PDF import | \`node scripts/run-onboarding-e2e.cjs --club-integration\` | Dedicated local Supabase Auth/Postgres/Mailpit, Next server 3107 |
| Native security/concurrency | \`node scripts/run-disposable-postgres.cjs security\` | DB \`outclass_security_test\` on loopback 58454 |
| Native Events and browser Events | \`node scripts/run-disposable-postgres.cjs events\` | DB \`postgres\` on loopback 55442 |
| Native announcements, recipient audiences, invitations and decision publication | \`node scripts/test-decision-publication-local.cjs\` | DB \`outclass_audiences_test\` on 58453 |
| Native decision transactions, offers, recruitment races | \`node scripts/test-decision-transactions-local.cjs\` | DB \`outclass_recruitment_test\` on 58452 |
| Native scheduler/voting polling and release | \`node scripts/test-scheduler-polling-local.cjs\` | DB \`outclass_audiences_test\` on 58453 |
| Real Storage + native PostgreSQL event flyers | \`node scripts/run-availability-e2e.cjs --event-storage\` | Dedicated local Supabase on 57321/57322 |
| Coverage inventory | \`node scripts/check-disposable-integration-coverage.cjs\` | No external services |

Install Chromium before browser suites: \`pnpm exec playwright install --with-deps chromium\` (Linux) or \`pnpm exec playwright install chromium\` on other platforms.

Do **not** run concurrent local suites that share the 58453 port. CI gives each matrix job a separate machine.

## Isolation and cleanup

- Native DB runners bind only to \`127.0.0.1\`, use reserved ports and database names, refuse to replace an existing named fixture container, and remove only their own labeled fixture.
- Existing Supabase runners enforce reserved project IDs and ports, create temporary configurations and run normal Prisma migrations on **their own** databases.
- The local onboarding runner captures email in Mailpit; the native suites have outbound email disabled and use no hosted credentials.
- Never pass a production or staging connection string or Vercel production variables to these runners; CI does not pass repository secrets.
- No code in this branch changes production migrations, Auth configuration, or database data.

## Remaining coverage gap

Run \`node scripts/check-disposable-integration-coverage.cjs\` for the current machine-readable report. The remaining suites need *additional* dedicated fixture orchestration, particularly the guarded admin/session, corkboard/assets, full announcement/decision, and scheduling E2E configurations. Do not mark a release fully integration-verified until those are provisioned and all jobs complete successfully.

## Acceptance for deployment

1. Relevant disposable native PostgreSQL jobs green (including race/transaction tests).
2. Authenticated Next.js + local Auth/MFA + SMTP + settings/navigation job green.
3. Private Storage test green.
4. Remaining gated end-to-end suites either run on guarded disposable services or are explicitly treated as outstanding release blockers.
5. No SKIP is misreported as passing integration coverage; inspect the test logs and the coverage inventory.
6. The site's actual deployed behavior is still smoke-tested in a non-production environment before rollout.
