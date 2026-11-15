# Disposable integration verification

## Why these tests were skipped

The normal \`pnpm test\` suite intentionally does not boot Auth, Storage, Next.js, SMTP, or PostgreSQL. Environment-gated tests therefore report **skipped** unless their guarded configuration is provisioned. Migration fixtures and mocked-browser tests cannot replace the real service boundary.

This branch introduces a separate GitHub Actions workflow: **Disposable integration verification** (\`.github/workflows/disposable-integrations.yml\`). It runs on every pull request, Mondays at 05:17 UTC, and through manual workflow dispatch. Every job runs on a fresh Ubuntu runner; no production secrets are supplied.

**A successful static coverage report does not imply all 46 tests were executed.** The coverage script lists unwired suites explicitly. Each integration job must pass independently.

## Run locally

Requirements: Node 22, pnpm 10, Docker with Linux containers, OpenSSL (for onboarding), and sufficient local space to start the isolated Supabase services. All commands run from the repository root.

| Runner | Command | Bound disposable environment |
| --- | --- | --- |
| Auth, MFA, settings, navigation, PDF import, attacker pass | \`node scripts/run-onboarding-e2e.cjs --club-integration\` | Dedicated local Supabase Auth/Postgres/Mailpit, Next server 3107 |
| Native security/concurrency, two-request races (application submit, legacy invitation accept, meeting check-in, club claim, live-vote ballot), and starting the next recruitment cycle | \`node scripts/run-disposable-postgres.cjs security\` | DB \`outclass_security_test\` on loopback 58454 |
| Native mock recruiting cycle (50 synthetic applicants: apply, anonymous review, interviews, live voting, decisions, offers, roster export; logs per-stage timings) | \`node scripts/run-disposable-postgres.cjs security\` (runs \`tests/mock-recruiting-cycle-native.test.cjs\`) | DB \`outclass_security_test\` on loopback 58454 |
| Active Interview Rooms: four separately signed-in reviewers get distinct authorized reads, and revoking one booking grant takes effect on the next request (CI job "Local Auth, settings and navigation"; runs after the release-repair suites on the same stack) | \`node scripts/run-onboarding-e2e.cjs --club-integration --selected-navigation --pipeline-release-repair --active-interviews\` (runs \`tests/active-interview-navigation-e2e.test.cjs\`) | Same onboarding stack, Next server 3107 |
| Native interview self-booking contention: simultaneous bookings under 0/2 ms simulated latency, last-seat race and one student's overlapping cross-club bookings each book exactly once | \`node scripts/run-disposable-postgres.cjs security\` (runs \`tests/interview-booking-contention-native.test.cjs\` last); the full benchmark still runs on its own fixture with \`node scripts/run-contention-benchmark.cjs\` | DB \`outclass_security_test\` on loopback 58454 |
| Native Events and browser Events | \`node scripts/run-disposable-postgres.cjs events\` | DB \`postgres\` on loopback 55442 |
| Native announcements, recipient audiences, invitations and decision publication | \`node scripts/test-decision-publication-local.cjs\` | DB \`outclass_audiences_test\` on 58453 |
| Native decision transactions, offers, recruitment races, leader CSV exports | \`node scripts/test-decision-transactions-local.cjs\` | DB \`outclass_recruitment_test\` on 58452 |
| Native scheduler/voting polling and release | \`node scripts/test-scheduler-polling-local.cjs\` | DB \`outclass_audiences_test\` on 58453 |
| Real Storage + native PostgreSQL event flyers | \`node scripts/run-availability-e2e.cjs --event-storage\` | Dedicated local Supabase on 57321/57322 |
| Coverage inventory | \`node scripts/check-disposable-integration-coverage.cjs\` | No external services |

Install Chromium before browser suites: \`pnpm exec playwright install --with-deps chromium\` (Linux) or \`pnpm exec playwright install chromium\` on other platforms.

Do **not** run concurrent local suites that share the 58453 port. CI gives each matrix job a separate machine.

## Attacker pass

\`tests/attacker-pass-e2e.test.cjs\` runs last in the onboarding runner's \`--club-integration\` list (CI job "Local Auth, settings and navigation"). It refuses to start unless the app, Supabase and database URLs are loopback, and uses only the runner's disposable config. Four accounts are seeded: students A and B, leader L (owner of club X) and leader M (owner of club Y).

| Case | Checks |
| --- | --- |
| IDOR | B against A's workspace reads, decision letter, résumé, headshot, attachment and interview-résumé routes; M against X's workspace reads, notes, \`/api/club-exports\`, voting reads and cross-club id binding; random calendar-feed tokens return 404. Every response is scanned for seeded A/X names, emails, ids, paths, notes and tokens (\`tests/helpers/attacker-pass.cjs\`, unit-tested in \`tests/attacker-pass-helpers.test.cjs\`). |
| Logout | A's captured cookies, replayed after \`/api/auth/logout\`, get a redirect to \`/login\` or 401. |
| Public key | Publishable (and legacy anon) key against PostgREST for every Prisma table, and Storage list/download/sign for every private bucket. |
| Headers | frame-ancestors / X-Frame-Options on HTML; \`/.git/*\` and \`/.env*\` 404; no \`.map\` files; middleware CSP (skipped while middleware sets none). |
| Enumeration | Login, forgot-password and signup answer known and unknown emails alike; direct \`/auth/v1/otp\` is recorded as informational. |
| Open redirect | \`next\` payloads on \`/login\`, \`/signup\` and \`/auth/callback\` never leave the origin, signed out and signed in. |
| Rate limits | Bursts against \`/q/<code>\` and password recovery expect 429, only when \`lib/rate-limit\` exists; skipped otherwise. |
| Uploads | HTML/SVG/JS named \`.png\` is rejected as a headshot; a PNG+HTML polyglot is recorded as informational. |

The summary is written to \`test-results/attacker-pass.json\` (case, result, notes) and uploaded as the \`attacker-pass\` artifact. A \`partial\` result means a probe was malformed (HTTP 400) or a provider rate limit made a comparison inconclusive; read its notes.

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
