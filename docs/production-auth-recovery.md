# Production deployment and authentication recovery — October 11, 2026

Status: investigation and local validation complete; production schema changes and release are awaiting explicit approval. No production migration has been executed.

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

- `npm run db:check-release` reads the catalog in a READ ONLY transaction and rejects missing Prisma tables/columns before a release. It requires an explicitly supplied `OUTCLASS_DATABASE_CHECK_URL`, emits column names and bounded error codes, and executes no migrations. Run it using the intended runtime connection. It does not certify all types, constraints, RLS or migration history; retain those independent checks.
- A regression reconstructs the inspected production migration state in disposable PGlite, reproduces the missing-column SQL error, then applies only the three pending migrations. Required columns become available; existing user/application records and browser-role denial are preserved.
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
| `npm run test` | 997 total: 983 passed, 14 environment-gated skips, 0 failed |
| New release regression | 1 passed, 0 failed |
| `npm run test:migrations` | Passed: all 39 migrations on fresh/legacy disposable databases; 66 protected tables |
| `npm run build` | Passed, including DM Sans retrieval |
| New script/test lint and `git diff --check` | Passed |
| `prisma migrate status` | Correctly reports the three pending production migrations |
| Read-only release check against current production | Correctly blocks on 10 missing required columns (including DecisionLetter fields) |
| Live authorized OTP | Request and verification 200; email initially delayed, subsequently received; confirmed account reached its authorized club-leader workspace |
| Session after browser refresh | Authenticated workspace retained |
| Browser console during observed login/workspace | No errors or warnings captured |

These browser results are on the **older** deployment currently assigned to `www`, not the newer schema-dependent build. Fresh signup/verification, email/password login, reset completion, superadmin MFA/elevation and the corrected preview/new production flow are not yet verified. The user must enter any new password themselves in the browser; no password or OTP is retained in this report. Microsoft sign-in remains hidden.

The Vercel connector returned a team-scope 403; authenticated existing CLI access succeeded. Resend's existing send-only key cannot read delivery status (401 restricted_api_key); no broader credential was created. An attempted CLI env command unexpectedly created a separate `provider-check` project containing only diagnostic source, no credentials. That project was deleted and its absence verified. OutClass's project link and live deployment remained unchanged.
