# OutClass email production publication — October 10, 2026

The email redesign is live in the application and in all four active hosted Supabase Auth bodies. The application was already deployed by the existing Git/Vercel integration before this deployment request; this run verified that deployment and published the hosted bodies separately. Six test emails delivered: one real production OTP, one real production recovery request, and four recipient-restricted invitation design previews.

No production environment variables, SMTP settings, subjects, notification enablement, MFA, redirects, DNS, schema, or persistent credentials were changed. No database migration, invitation queue, membership grant, password reset completion, or account-creation workflow was executed.

## Deployment status

| Item | Status / evidence |
|---|---|
| Vercel production | **Completed / verified live** at [www.out-class.net](https://www.out-class.net/) |
| Deployed Git commit | `50c85c1c0ec2eab8d45820fea3ee1f4c22585ae5` |
| Production deployment | [dpl_DX9tZMj4jXRkqewdsKwjRP3NY1cW](https://vercel.com/outclassuva/out-class/DX9tZMj4jXRkqewdsKwjRP3NY1cW), Ready; `out-class-7hqx9i7kv-outclassuva.vercel.app` |
| Actual production branch | `main`, confirmed by GitHub metadata and Vercel’s project dashboard |
| Preview | Build Ready, **Auth smoke test blocked** by missing Preview Supabase URL/API key |
| Preview commit | `2500e5c86ff6f1b740cdd71479fc8784b1bb19ee`, release evidence and rollback bodies only; application code identical to production |
| Preview deployment | [dpl_CJZk9HLAWQUUFcRQSBrtJ2RU4VXD](https://vercel.com/outclassuva/out-class/CJZk9HLAWQUUFcRQSBrtJ2RU4VXD) |
| Preview promotion | Not promoted; no additional production deployment was made |

The initial working tree was clean. The October 10 commit contained 263 files, all belonging to the email redesign. The [complete inventory](redesign-file-inventory.json) identifies every file. Fetching `origin` at the beginning and end confirmed `origin/main` remained at `50c85c1`; no teammate changes were overwritten.

A dedicated branch, `codex/email-production-validation-2026-10-10`, holds the committed release validation and rollback bodies. Pushing it triggered the existing Git/Vercel preview integration. No second deployment pipeline was introduced. The preview’s signup error was `@supabase/ssr: Your project's URL and API key are required to create a Supabase client`. Its public homepage and assets loaded, but its Auth pages could not be verified. The production pages worked with the same application code. The Preview variables shown by Vercel are scoped to other existing branches; this validation branch has neither `NEXT_PUBLIC_SUPABASE_URL` nor `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Fixing Preview configuration requires environment-variable changes, expressly excluded by the user, so that preview was not promoted or merged into production.

## Hosted Supabase Auth bodies

Published through the authenticated Supabase Dashboard for project `htlgjluegmdwfjkzzwic`. All four bodies were backed up before editing. Each saved body was reloaded, copied from the editor, and compared byte-for-byte with its approved local file.

| Hosted template | Status | Approved local file | Rollback body |
|---|---|---|---|
| Confirm sign up | **Completed** | `supabase/templates/confirmation.html` | [confirmation.html](hosted-before/confirmation.html) |
| Magic link or OTP | **Completed** | `supabase/templates/magic-link.html` | [magic-link.html](hosted-before/magic-link.html) |
| Reset password | **Completed** | `supabase/templates/recovery.html` | [recovery.html](hosted-before/recovery.html) |
| Password changed | **Completed** | `supabase/templates/password-changed.html` | [password-changed.html](hosted-before/password-changed.html) |

Signup and sign-in retain `{{ .Token }}`. Recovery retains `{{ .RedirectTo }}#token_hash={{ .TokenHash }}` in its HTML, VML and fallback links. The original signup, OTP and recovery subjects were verified unchanged. The password-change subject was not edited; its existing enabled switch was verified still on. The three inactive provider bodies were not published. No SMTP, rate-limit, redirect, MFA or notification-setting control was changed.

[Publication readback hashes](hosted-publication.json) and the [saved published bodies](hosted-after/) provide the exact content evidence. Regenerating templates afterward again produced no differences. This follows the supported [Supabase Dashboard template publication workflow](https://supabase.com/docs/guides/auth/auth-email-templates); `supabase db push` was not used.

## Validation and production checks

- `npm run email:templates`: passed; generated files current, zero differences.
- Relevant email regressions: 20 passed, zero failed.
- Full suite: 937 passed, zero failed, nine skipped (946 total).
- TypeScript and production build: passed.
- Lint: zero errors and 25 existing warnings.
- Production homepage, anonymous signup and login pages loaded. The existing signed-in account’s Get Started link correctly returned it to its workspace. Anonymous login reached the normal six-digit OTP screen; Microsoft Sign-In remained hidden.
- The real recovery link reached **“Choose a new password.”** Both password fields were empty, and Update password was never submitted.
- Actual Supabase-generated OTP and recovery emails contained the new headings and double-rule signature. Their official wordmark loaded in both Resend preview and the actual recipient’s Outlook Web messages. The OTP contained six digits and a readable provider-generated plain-text alternative. The recovery CTA used the canonical production route and token-hash fragment.
- Vercel’s production error-log query from 12:15 PM EDT through the final check returned zero error entries, with a 100-entry limit. This is a scoped observation, not a guarantee that unrelated historical issues do not exist.

[Validation evidence](release-validation.json), [production status](production-status.json), [OTP content check](production-otp-content-check.json), [recovery content check](production-recovery-content-check.json), and [actual Outlook checks](outlook-production-mail-checks.json) retain the non-secret results. Supabase’s editor preview did not load the external logo in its preview pane; the actual delivered messages and provider preview did load it.

## Actual test email delivery

Only `bsb4rd@virginia.edu` was targeted. Auth subjects were preserved; invitation previews used `[OutClass Production Test]` and explicit notices that no invitation or permissions were created.

| Email | Resend message ID | Result and scope |
|---|---|---|
| Sign-in OTP | [01a126af-66ac-786c-8235-cb714f2f1f74](https://resend.com/emails/01a126af-66ac-786c-8235-cb714f2f1f74) | Delivered; actual production UI request; observed in Outlook; no code verification/login completion |
| Password recovery | [01a126b1-e906-78a7-ae87-1983e740fae9](https://resend.com/emails/01a126b1-e906-78a7-ae87-1983e740fae9) | Delivered; actual supported production request; Outlook message and reset screen verified; no password change |
| Member invitation | [01a126b0-682e-7ab3-87b8-32cc1fd761f3](https://resend.com/emails/01a126b0-682e-7ab3-87b8-32cc1fd761f3) | Delivered; SMTP design preview of deployed template; no invitation/outbox action |
| Administrator invitation | [01a126b0-6aee-7250-a0a5-d5e258b6f8ba](https://resend.com/emails/01a126b0-6aee-7250-a0a5-d5e258b6f8ba) | Delivered; SMTP design preview; no administrator grant |
| Legacy invitation | [01a126b0-6d9a-705b-9c6e-542ece6583ea](https://resend.com/emails/01a126b0-6d9a-705b-9c6e-542ece6583ea) | Delivered; inactive legacy-link preview; no acceptance workflow |
| Student account claim | [01a126b0-6f64-78f8-97b8-357484c237a2](https://resend.com/emails/01a126b0-6f64-78f8-97b8-357484c237a2) | Delivered; inactive claim-link preview; no account creation or claim completion |

[Auth ledger](auth-send-results.json), [invitation preview ledger](invitation-send-results.json), and [provider observations](provider-observations.json) record the evidence. Invitation previews reused the available existing Resend key; they do not establish that the separately redacted production SMTP password equals that key or that the production outbox worker executed successfully.

The provider’s automatic page snapshot included the disposable OTP in tool output. That test code was immediately invalidated using supported magic-link token regeneration, without another email, password change or permission grant. The replacement token was not printed or saved. No OTP or recovery-token values were copied into these artifacts. Further mail inspection used metadata only, and the Outlook screenshot was cropped before the recovery-token fallback URL.

## Outstanding limits

The production application and all four active hosted bodies are published. Preview Auth validation remains blocked by missing environment configuration; those variables were not changed. Fresh signup, invitation acceptance, account-claim completion, automatic password-change notification, exact hidden production SMTP credentials, and global worker delivery were not tested. No such workflow success is claimed. Native Outlook apps, Gmail and Apple Mail remain outside the prior Outlook Web design coverage.

## Rollback

No rollback was necessary. If a production issue is traced to this email release:

1. In Vercel’s OutClass project, use **Instant Rollback** to the pre-redesign known-good deployment [dpl_3EHPWT4jVPS4hAFZVzq3aT6Ycfbe](https://vercel.com/outclassuva/out-class/3EHPWT4jVPS4hAFZVzq3aT6Ycfbe), commit `93502dde5e5d9155d5d8d6751cefddbb385c5da9`, URL `out-class-g39nr7ji1-outclassuva.vercel.app`. Confirm `www.out-class.net` points to the restored deployment and repeat the account-entry smoke checks. The Git branch remains unchanged by a deployment rollback. Instant Rollback also pauses automatic production-domain assignment; after fixing the issue, use Undo Rollback / Promote to resume that behavior. See [Vercel’s rollback procedure](https://vercel.com/docs/instant-rollback).
2. In [Supabase Authentication → Emails](https://supabase.com/dashboard/project/htlgjluegmdwfjkzzwic/auth/templates), open each of the four active templates and paste its matching file from `docs/email-deployment/hosted-before/` into **Body** only. Save the content and reload to verify it. Keep every subject and the password-change enabled switch unchanged.
3. Repeat recipient-restricted OTP and recovery request checks. Do not reset a password, run migrations, change DNS, or alter SMTP/MFA/rate limits as part of this rollback.

The current redesign-only application deployment `dpl_DX9tZMj4jXRkqewdsKwjRP3NY1cW` is also retained. A hosted-template-only issue can be handled by restoring those bodies without rolling back the application.
