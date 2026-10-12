# Production deployment and authentication recovery — October 11, 2026

Status at the MFA follow-up checkpoint: the user approved the reviewed migrations after backup checks. All three are applied through authoritative Prisma migration deployment; all 39 migrations are successful. PRs #22 and #23 merged. Production deployment `dpl_87WQwshAjXUbP4RRFJxp2A816S97`, commit `62dcd41947d8579518a41833e7c998309b4f2264`, is READY and serves `www`. Automatic production publishing and the runtime schema build gate are enabled. Existing records and access protections were verified. The MFA password-recovery correction in PR #24 is locally validated; the user explicitly directed release and verification on production after staging access remained unavailable. Final hosted release evidence belongs to the PR #24 receipt.

## Confirmed causes

- Vercel project `prj_ZL6azRpYgevP8UVL3ela8tOrh4MO`, team `outclassuva`, is connected to `TheFrtiz22/out-class`, production branch `main`. `autoAssignCustomDomains=false`, updated by `system`. The live domain resolves to deployment `dpl_CF2J6yyakG8tXR9e94M3Ake894uC`, source `3448ccb96b9b3a54f035a06a572379d10537e07c`. The newer production deployment `dpl_Etg5AKofC6UKCYYZn9Su3gMU41eP`, source `83f26716b76b347df883272a68062cbd978dc919`, is READY but has only branch/team aliases. Successful builds are therefore not reaching the custom production domain. This is consistent with a previous Instant Rollback; the setting and alias mismatch are confirmed, the reason it was changed is an inference.
- PRs #16 (typography), #17 (landing motion), and #18 (interview spacing) are merged and ancestors of current `main`. Their changes are absent from the older commit serving the custom domain.
- Recent production-target runtime logs show Prisma `P2022`: `Application.decisionVersion` does not exist. `getCurrentUser` loads applications and their clubs during authenticated rendering, so schema drift breaks account/dashboard loading even after Supabase accepts sign-in. Catalog inspection confirms the missing version column, Club decision templates, DecisionLetter table, and InterviewRecord submitted questions.
- Production records 36 successful migrations, zero failed migrations, with exactly the three pending migrations below. Four checksum differences match the current SQL with Windows CRLF line endings exactly; they are not changed SQL. No history entries need to be rewritten.
- A fresh configured PostgreSQL connection authenticates as `postgres`. Vercel runtime uses the bounded `outclass_production_app` role, which has neither superuser nor BYPASSRLS nor public-schema CREATE. No current P1000 was found in the sampled Vercel errors. Migration operations must use the operator connection, not the restricted runtime connection.
- A failed preview build at `out-class-kbd3bqbog-outclassuva.vercel.app` failed on JSX `react/no-unescaped-entities` lint errors. Those errors are already fixed on `main`. Both the latest Vercel production build and the local build successfully retrieved/compiled DM Sans; no font workaround is warranted.
- Public HTTPS homepage/login return 200, apex redirects 308 to `www`, and DNS routes to Vercel. No domain/DNS change is needed.
- Generic Preview configuration lacks Supabase URL/key and database bindings; existing preview credentials are branch-specific. A new recovery-branch preview cannot establish working Auth until safe preview configuration exists. Production secrets must not be made generally available to unreviewed preview branches.

## Changes in this recovery branch

- Vercel production `prebuild` reads the catalog in a READ ONLY transaction and rejects missing Prisma tables/columns before publishing. It uses the exact runtime connection precedence from `utils/prisma.ts` and fails closed on missing configuration. Local/Preview/CI builds skip this production-only check. Manual `npm run db:check-release` requires an explicitly supplied `OUTCLASS_DATABASE_CHECK_URL`. Diagnostics include column names and bounded error codes, never connection details; no migration is executed. The check does not certify all types, constraints, RLS or migration history; retain those independent checks.
- A regression reconstructs the inspected production migration state in disposable PGlite, reproduces the missing-column SQL error, then applies only the three pending migrations. Required columns become available; existing user/application records and browser-role denial are preserved.
- The real onboarding E2E signup check now asserts the account form and account heading instead of obsolete landing-page marketing sentences. No production UI copy was changed to satisfy the test.
- Application auth, role routing, branding, fonts, landing animations and Microsoft sign-in configuration are unchanged. The root repair is the missing schema plus correct Vercel promotion, not an auth bypass or removal of required fields.

## Reviewed production migration plan — approval required

Target: Supabase project `htlgjluegmdwfjkzzwic`, public application schema. Execute the unchanged committed Prisma SQL, in this order, through Prisma migration deployment with the operator connection:

1. `20261010190001_reconciled_decision_letters`: adds nullable Club template JSON, Application version default 0, and immutable DecisionLetter history with constraints/indexes, RLS and browser grants revoked. Updates two notification producer functions to avoid duplicate versioned decision/offer notifications. No historical decision backfill, account deletion or outcome change.
2. `20261011180000_submitted_interview_questions`: adds nullable InterviewRecord snapshot JSON and a validity constraint; existing reviews keep NULL. Transactional, with a five-second lock timeout. No private-draft backfill.
3. `20261011194930_decision_letter_runtime_access`: transfers only DecisionLetter ownership to the existing bounded runtime role. Temporary public-schema CREATE permission is restored within the transaction. No browser grant, role attribute or unrelated ownership change.

Before execution: reconfirm target, pending list/checksums, backup availability and recoverability; capture schema/policies/functions and counts/IDs. Inspect a restored isolated copy if one is available; local populated migration tests are evidence but are not a restored production rehearsal. The observed baseline has 38 public users, 30 Auth users, 11 applications and 18 memberships. Record new counts immediately before execution because live traffic may change them. Keep the current working older deployment assigned until the schema is ready. No reset, db push, blanket resolve, or Supabase migration-history replay.

After execution: require all 39 migrations successful; rerun catalog check using the runtime role; verify DecisionLetter owner, restrictive RLS, browser CRUD denial, immutable trigger, and no new runtime schema CREATE/BYPASSRLS. Compare preserved IDs/data/counts. Test a protected production-configured staged build with authorized accounts. Configure an isolated/authorized preview before claiming preview Auth verified. Then merge through the normal PR checks and promote the intended READY production deployment, restoring automatic custom-domain assignment. Verify the custom domain's deployment ID and Git SHA and repeat browser/Auth/server-error checks.

Each migration is transactional, but the three-migration sequence is not one transaction. Table changes acquire locks; the decision migration changes notification producer behavior. If a step fails, stop, inspect state and resolve the specific failure; do not blindly rerun or rewrite history. If app verification fails, retain/restore the previously working application deployment and leave additive schema intact pending investigation. Do not drop new tables/columns or restore production data without a separate reviewed recovery plan.

## Validation and current limits

| Check | Result |
|---|---|
| `npm run lint` | Passed, 0 errors and 28 existing warnings |
| `npm run typecheck` | Passed |
| PR #22 GitHub `pnpm validate` | Passed: 998 tests, 984 passed, 14 environment-gated skips, 0 failed; lint/types/migrations/build passed |
| New release regression | 1 passed, 0 failed |
| `npm run test:migrations` | Passed: all 39 migrations on fresh/legacy disposable databases; 66 protected tables |
| `npm run build` | Passed, including DM Sans retrieval |
| New script/test lint and `git diff --check` | Passed |
| `prisma migrate status` before repair | Correctly reported exactly the three pending production migrations |
| Read-only release check | Blocked on 10 missing columns before repair; passes after repair |
| Real onboarding/Auth/MFA/PostgreSQL/captured SMTP E2E | Latest follow-up: 14 passed, 0 failed; includes new signup, OTP resend/invalid/consumed-token rejection, password login, verified profiles, authorized dashboards, MFA/elevation, access isolation, ordinary password recovery and missing/incorrect/correct MFA recovery codes |
| Live authorized OTP | Request and verification 200; email initially delayed, subsequently received; confirmed account reached its authorized club-leader workspace |
| Session after browser refresh | Authenticated workspace retained |
| Browser console during observed login/workspace | No errors or warnings captured |
| Repaired live password login | Supabase `/token`: grant_type=password, status=200, authorized account matched; correct leader dashboard and refresh persistence |
| Repaired live logout and mobile navigation | Public homepage restored after sign-out; 390px leader navigation opens with no horizontal overflow |
| Anonymous/malformed session | `/api/users/me` returns 401 with no private data |
| Live platform administration | Existing authorized account completed password/MFA/elevation; Admin overview and refreshed overview render correctly; database confirms fresh password/MFA verification and unexpired elevation; no browser errors |
| Live recovery request and negative cases | Provider `/recover` 200; delivered link reaches reset UI; malformed token 400, foreign Origin 403, non-UVA email 400 |
| Live MFA recovery completion | Original form rejects password change with `insufficient_aal`; missing authenticator-entry step identified; correction not released yet |
| MFA correction local validation | 987 passed, 14 expected skips, 0 failed; 10 focused recovery tests; lint 0 errors/28 existing warnings; typecheck/build passed; real isolated E2E 14 passed; desktop/390px form renders with no overflow or console errors |

These initial browser results are on the **older** deployment assigned to `www` during investigation. The newer production-configured build `83f2671` was then tested before public promotion using the actual OTP-verified session: `/api/users/me`, the student workspace, and the authorized leader workspace all returned 200; account/profile/membership/application data matched, including the formerly missing decision version. Vercel deployment protection was accessed through authenticated `vercel curl`, without disabling it. The ordinary recovery-branch Preview is READY but its login render fails because required Supabase configuration is missing (a streamed 200 alone did not count as a pass).

The user has no second authorized UVA test mailbox, so fresh **production** signup/verification cannot be completed; the real isolated E2E covers that flow. Hosted superadmin password/MFA/elevation is now verified. The existing test account's MFA blocks email-only recovery, and the original reset form offered no authenticator field. The follow-up accepts an optional six-digit authenticator code, challenges the recovered account's already verified TOTP factor, and verifies matching identity and AAL2 before the password update. Recovery remains isolated from the visitor's signed-in session. The real-service regression verifies rejected missing/incorrect codes, consumed-link denial, valid reset, old-password rejection/new-password login, refresh-session revocation, preserved MFA enrollment and unchanged visitor identity.

The user initially selected reuse of staging project `omfcozcbpmevwolshibh` instead of a new paid branch. After the reported reconnection, Supabase still lists only production and explicitly denies access to that staging project. The user then explicitly directed that the tested correction be landed on main and verified on production. Generic Preview remains unconfigured; it received no production database access. Hosted MFA-reset completion is not claimed at this checkpoint. The user entered passwords and authenticator codes directly in the browser. No password, code or reset token is retained in this report. Microsoft sign-in remains hidden.

## Approved migration and recovery receipt

- Supabase CLI confirmed seven COMPLETED physical backups. Latest: `1933200511`, October 11 at 09:18:37.936 UTC. WAL-G enabled; PITR disabled. This is provider availability evidence, not a provider-wide restore test.
- A new READ ONLY repeatable-read public-schema snapshot was dumped with certificate and hostname verification, encrypted with AES-256-GCM, and restored into a dedicated PostgreSQL 17 container with network `none` and zero published ports. All 66 table counts/content digests, schema ownership/grants/policies/functions and migration history restored successfully.
- All three unchanged pending migrations were rehearsed on that actual restored copy. Every existing table's content remained identical after excluding newly added nullable/default columns; runtime ownership, browser CRUD denial and absent runtime schema CREATE were verified.
- The macOS native Prisma engine rejected strict certificate configuration before any migration. A loopback-only PostgreSQL tunnel enforced remote TLS, CA and hostname verification; Prisma used that local tunnel to apply the approved SQL and maintain its normal migration history. Production TLS/configuration was unchanged.
- Immediately before execution: 38 public users, 30 Auth users, 11 applications, 18 memberships. After execution: all 39 migrations successful; 65 existing application tables had identical counts/content digests, with only migration bookkeeping and additive schema changes. DecisionLetter owner is `outclass_production_app`, RLS is enabled, anon/authenticated CRUD remains denied, runtime public CREATE remains false. Actual READ ONLY `SET LOCAL ROLE` queries verify runtime access to the new fields/history.
- Private encrypted backup and receipts: `/Users/jesseklinger/.codex/private/outclass-recovery-20261011/`. The archive covers the public application schema, not Storage object bytes or a full Auth/provider disaster restore. No migration changed Auth or Storage.

The Vercel connector returned a team-scope 403; authenticated existing CLI access succeeded. Resend's existing send-only key cannot read delivery status (401 restricted_api_key); no broader credential was created. An attempted CLI env command unexpectedly created a separate `provider-check` project containing only diagnostic source, no credentials. That project was deleted and its absence verified. OutClass's project link and live deployment remained unchanged.
