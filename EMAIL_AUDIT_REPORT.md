# OutClass transactional email audit

**October 10 redesign update:** The new [design report](docs/email-design/REPORT.md) and [comparison gallery](docs/email-design/index.html) supersede this report’s visual findings. Eight final design previews were received and inspected in actual Outlook Web light/dark mode; all have Resend Delivered events. The October 9 delivery and security audit below remains historical evidence. Nothing has been deployed or published to hosted Supabase.

**Audit date:** October 9, 2026, America/New_York. **Only recipient:** `bsb4rd@virginia.edu`.

Nine real emails were sent through the existing Resend infrastructure and **all nine have a Resend Delivered event**. This confirms acceptance by the recipient's mail server, not placement in the inbox. No recipient inbox was accessed. Three sends exercised real Supabase Auth workflows (one sign-in code and two recovery tests); six exercised the SMTP templates with explicit audit notices and no membership/invitation records. The SMTP previews are **not** credited as successful signup, account-claim, password-change, or outbox workflows.

Local fixes and proposed Auth templates are in this working tree. **Nothing was deployed.** Hosted Auth bodies, DNS, credentials, sender configuration, rate limits, MFA, and redirects were not changed. Four recipient-specific subject prefixes were temporarily applied with the user's separate approval; their restoration is recorded in [configuration evidence](docs/email-audit/restoration.json).

All four original subjects were restored and checked in the authenticated dashboard. The notification's enabled switch remains on. CLI access was unavailable at final readback (`AccessTokenRequiredError`), so restoration used the dashboard instead; its subject was visually verified after reloading. Temporary downloaded credentials and diagnostic token/password files were removed.

## Results

Design results refer to the final local rendered templates at desktop, mobile, narrow mobile, and dark-theme widths. They do not certify Gmail, Outlook, or a deployed template update. “Blocked” and “N/A” are used instead of falsely treating an unexecuted workflow as a pass.

| Email | Design | Send Result | Delivery | Issues |
|---|---|---|---|---|
| Signup confirmation / signup resend, with six-digit verification code | Pass locally; hosted update pending | Blocked Auth workflow; SMTP preview passed | Preview confirmed delivered | Recipient already has a confirmed account. Fresh signup would require another mailbox or deleting/recreating production records; neither was done. |
| Six-digit sign-in OTP | Pass locally; hosted update pending | Pass: supported `signInWithOtp`, no account creation | Confirmed delivered by Resend | Actual delivered HTML contains six digits; actual plain text verified. Code use and inbox appearance remain manual. |
| Password-reset request | Pass locally; hosted update pending | Pass: final actual production-route retest and supported provider retest | Both retests confirmed delivered | Initial production request returned the intentionally uniform HTTP 200 but had no corresponding provider message. The same production route later sent successfully after the cooldown. The initial runtime cause remains unproven. |
| Password-changed confirmation | Pass locally; hosted update pending | Blocked automatic notification; SMTP preview passed | Preview confirmed delivered | Actual reset completion failed with provider `insufficient_aal`, reproduced directly. MFA proof is required; no password change succeeded. |
| Club administrator/owner designation invitation | Pass | Pass: real SMTP template send | Confirmed delivered | No actual ownership grant, invitation, server action, or outbox record created. |
| Club member / roster invitation | Pass | Pass: real SMTP template send | Confirmed delivered | Same template for initial roster sends and explicit resends. Production roster/outbox actions were not invoked. |
| Legacy email-bound club invitation | Pass | Pass: real SMTP preview | Confirmed delivered | Preview link replaced with the real Organizations page. No fabricated invitation record or usable grant. |
| Student account-claim invitation / resend | Pass | Pass: real SMTP preview; account-claim workflow blocked | Confirmed delivered | Recipient is already registered, not an unclaimed invite. Preview has no usable token. Added HTML and receipt tracking locally. |
| Supabase generic Invite User | Fail: unbranded; dark rendering unreadable | N/A: no OutClass send trigger | Not sent | OutClass uses `generateLink` plus its custom student-claim sender; generation itself sends no email. Native template inventoried and rendered. |
| Supabase Change Email Address | Fail: unbranded; dark rendering unreadable | N/A: no OutClass email-change trigger | Not sent | Never changed an address or sent to a second recipient. Native template inventoried and rendered. |
| Supabase Reauthentication | Fail: unbranded; dark rendering unreadable | N/A: no OutClass reauthentication-email trigger | Not sent | Native template inventoried and rendered; not a shipped email workflow. |

## Complete implementation inventory

| Email or variant | Trigger / entry point | Template / sending function | Provider | Implementation status |
|---|---|---|---|---|
| Signup confirmation code | `actions/onboarding.ts` → normal `auth.signUp` | Hosted confirmation; versioned `supabase/templates/confirmation.html` | Supabase Auth → Resend SMTP | Implemented; confirmation required |
| Signup verification resend | `student-onboarding-wizard.tsx` → `auth.resend({type:'signup'})` | Same confirmation template | Supabase Auth → Resend SMTP | Implemented; same email, not another template |
| Existing-user sign-in code | `components/views/auth-view.tsx` → `signInWithOtp({shouldCreateUser:false})` | Hosted Magic link/OTP; `supabase/templates/magic-link.html` | Supabase Auth → Resend SMTP | Implemented as numeric OTP, not a link |
| Password recovery | `/api/auth/password-recovery`, action `request` → `resetPasswordForEmail` | Hosted recovery; newly versioned `supabase/templates/recovery.html` | Supabase Auth → Resend SMTP | Implemented |
| Password-change security notice | Successful provider `updateUser({password})` during recovery or student claim | Hosted Password changed; newly versioned `supabase/templates/password-changed.html` | Supabase Auth → Resend SMTP | Enabled in hosted project |
| Student account invitation | `createAdminStudent` / `resendAdminStudentInvitation` in `actions/admin-workspace.ts` | `sendStudentClaimEmail` in `utils/email.ts`; `lib/student-claim-email.ts` | Nodemailer → existing Resend SMTP | Implemented; formerly plain-text only |
| Identity-bound owner designation | Admin club creation, owner transfer, admin resend; `requestedRole:'OWNER'` with school identity | `sendInvitationEmail`; `lib/invitation-email.ts`, `owner:true` | Nodemailer → existing Resend SMTP | Implemented, durable invitation outbox |
| Identity-bound member/other club-role invitation | Explicit roster send, individual/bulk member resend, Admin club invitations | Same sender/template, `owner:false` | Nodemailer → existing Resend SMTP | Implemented, durable invitation outbox |
| Legacy email-bound invitation | Outbox invitation without school identity | Same template with `/invitations/<uuid>` link | Nodemailer → existing Resend SMTP | Implemented, verified-email acceptance required |
| Scheduled invitation delivery | Vercel Cron every minute → protected GET `/api/internal/invitation-delivery`; POST supported too | `processInvitationEmails`, up to 25 from oldest queued organization | Nodemailer → existing Resend SMTP | Implemented; independent bearer secret required |
| Background invitation delivery | `scheduleInvitationDelivery` → Next `after`, batch of 5 | Same outbox processor | Nodemailer → existing Resend SMTP | Implemented; no separate email template |
| Supabase generic Invite User | Provider API only; no `inviteUserByEmail` in application | Hosted default Invite User | Supabase Auth SMTP | Available provider template, unused by application |
| Email-address change verification | Provider API only; application never calls `updateUser({email})` | Hosted default Change Email Address | Supabase Auth SMTP | No implemented OutClass trigger |
| Reauthentication email | Provider API only | Hosted default Reauthentication | Supabase Auth SMTP | No implemented OutClass trigger |
| Email-address changed security notice | Provider account-email update | Provider default | Supabase Auth SMTP | Disabled in hosted project |
| Phone-number changed security notice | Provider phone update | Provider default | Supabase Auth SMTP | Disabled in hosted project |
| Sign-in method linked / removed notices | Provider identity linking/unlinking | Provider defaults | Supabase Auth SMTP | Both disabled in hosted project |
| MFA method added / removed notices | Provider factor enrollment/unenrollment | Provider defaults | Supabase Auth SMTP | Both disabled in hosted project |

Search covered application code, templates, utilities, API routes, Supabase configuration and SQL, Prisma SQL, CI, and developer scripts. No Resend SDK sender, email hook, Edge Function mail sender, SQL mail job, or second email provider was found. `db_test3.js` is an ad hoc signup diagnostic with a hard-coded non-test recipient; it was **not executed**. Local Mailpit and mocked regression tests are not production-delivery evidence.

The following requested categories have **no implemented outbound email**, so no real send was invented:

| Category | Existing behavior / evidence |
|---|---|
| Club claim submitted, approved, rejected | Claim records and administrative actions; no sender in `actions/club-claims.ts` / claim flows |
| Club onboarding notification | Organization creation and pending invitations; an explicit invitation send is separate |
| Application submission confirmation | Client in-app notification in `lib/application-state.tsx`; no email in `actions/applications.ts` |
| Application status, acceptance, rejection, waitlist | Application statuses and in-app surfaces; no mail integration in decision/recruitment actions |
| Application deadlines and reminders | Calendar/deadline presentation; no scheduled mail job |
| Interview invitation, booking, reschedule, cancellation | Booking records and calendar/in-app updates; no mail call in interview actions |
| Interview reminders / interviewer assignments | Interview access and panel data; no scheduled email sender |
| Task assignment, submission, feedback, due-date reminders | Computed in-app notifications in `lib/task-notifications.ts` |
| Administrative announcements / club broadcasts | Browser preview state in `broadcast-messages-view.tsx`; no delivery backend |
| Leader dashboard “email” action | A toast only; no draft or email sender. Corrected misleading success wording locally. |

## Every real email sent

All subjects began with `[OutClass Test]`, all recipients were the single authorized address, and all listed provider events showed **Delivered**. Time is America/New_York on October 9, 2026; JSON ledgers retain UTC submission timestamps. SMTP Message-ID headers are also retained separately in the ledger.

| Time (EDT) | Email | Exact Resend message ID / evidence | Test scope | Provider status |
|---|---|---|---|---|
| 20:07:07 | Member invitation | [01a12322-86a2-74b4-ae4e-398eb8d69947](https://resend.com/emails/01a12322-86a2-74b4-ae4e-398eb8d69947) | Real SMTP template, no invitation record | Delivered |
| 20:07:07 | Administrator designation invitation | [01a12322-87db-712c-9adc-6472274e8e9d](https://resend.com/emails/01a12322-87db-712c-9adc-6472274e8e9d) | Real SMTP template, no grant | Delivered |
| 20:07:08 | Legacy club invitation | [01a12322-892a-7cf6-87a3-d783e66f1402](https://resend.com/emails/01a12322-892a-7cf6-87a3-d783e66f1402) | Inactive invitation preview | Delivered |
| 20:07:08 | Student account-claim invitation | [01a12322-8a79-7574-be4b-3de38c0a7b2b](https://resend.com/emails/01a12322-8a79-7574-be4b-3de38c0a7b2b) | Inactive account-claim preview | Delivered |
| 20:07:55 | Six-digit sign-in OTP | [01a12323-482b-7141-8bab-fb58020c7faf](https://resend.com/emails/01a12323-482b-7141-8bab-fb58020c7faf) | Actual Supabase Auth request | Delivered |
| 20:12:28 | Signup verification design | [01a12327-6e71-7c7b-b61a-e3db5902fe7e](https://resend.com/emails/01a12327-6e71-7c7b-b61a-e3db5902fe7e) | Clearly labeled preview; illustrative, unusable code | Delivered |
| 20:12:29 | Password-changed design | [01a12327-6fb4-7d70-8a22-687d9f0bac60](https://resend.com/emails/01a12327-6fb4-7d70-8a22-687d9f0bac60) | Clearly labeled preview; no password changed | Delivered |
| 20:13:57 | Password recovery | [01a12328-ce47-7d9d-9350-6447f1b70c1a](https://resend.com/emails/01a12328-ce47-7d9d-9350-6447f1b70c1a) | Actual supported Supabase recovery request | Delivered, 20:14 provider event |
| 20:50:21 | Password recovery, application-route retest | [01a1234a-2276-753d-ae46-e9f6c27c8561](https://resend.com/emails/01a1234a-2276-753d-ae46-e9f6c27c8561) | Actual production `/api/auth/password-recovery` request after cooldown | Delivered |

[SMTP ledger](docs/email-audit/send-results.json), [Auth attempts and results](docs/email-audit/auth-send-results.json), and [provider observations](docs/email-audit/provider-observations.json) contain the non-secret evidence. No message IDs from another recipient are included.

The initial recovery-route request at 20:07:57 returned HTTP 200 without a matching Resend event. Subsequent reset-completion attempts returned HTTP 400. A separate provider-generated recovery token, created without another email, reproduced `insufficient_aal` (401) on `updateUser`. The earlier emailed recovery link was invalidated during that diagnostic. The 20:13:57 recovery email was sent afterward, and the production application route was independently retested successfully at 20:50:21. The last request generated the newest recovery link. Neither password nor MFA factors changed successfully. OTP/token values and provider sessions were never printed or put in the report/gallery.

## Configuration and behavior findings

| Check | Observed result / practical limit |
|---|---|
| Resend sending domain | Dashboard: `updates.out-class.net` **Verified**, North Virginia. Domain ID `29d7e0ad-9487-41cc-95ea-3e9e3359dbad`. Live accepted/delivered sends independently prove current sending capability. |
| DKIM | Public TXT record exists at `resend._domainkey.updates.out-class.net`; dashboard domain verified. |
| SPF / bounce MX | Public SPF TXT at `send.updates.out-class.net`; MX points to `feedback.forge.rmta.net`. |
| DMARC | Neither `_dmarc.updates.out-class.net` nor `_dmarc.out-class.net` resolved to a TXT record. Resend Insights also flags missing DMARC. DNS change requires operator approval. |
| Auth SMTP | Hosted configuration: `smtp.resend.com`, 465, user `resend`, sender `OutClass <no-reply@updates.out-class.net>`. OTP and recovery actually delivered through this configuration. Stored SMTP password remains hidden. |
| Application environment | Production variable names include all six SMTP fields, `OUTCLASS_SITE_URL`, and `CRON_SECRET`; Vercel withholds their sensitive values. Existing `RESEND_API_KEY` can send, but cannot read emails/domains (401 `restricted_api_key`). No credentials were changed. |
| Exact application credential test | SMTP template tests reused the existing available Resend key with the same hosted SMTP endpoint and sender. They did **not** establish that the separately hidden production `SMTP_PASSWORD` is identical, or execute production Admin/roster actions. |
| Reply-to / support | Senders do not set Reply-To. No verified support mailbox could be established; support-setting read was unavailable. Do not invent a mailbox. Invitation footers now direct recipients to the inviting organization/administrator; a real central support address still needs an operator decision. |
| Canonical URL | Hosted Site URL is `https://www.out-class.net`. Exact production reset redirect is allowlisted. Existing preview wildcards remain; none changed. Canonical logo, reset, student-claim, sign-in, and Organizations URLs returned HTTP 200. |
| Recovery link | Actual delivered HTML and plain text use `https://www.out-class.net/reset-password#token_hash=…`, not Supabase `ConfirmationURL`. Earlier documentation's recovery-link mismatch is no longer current. |
| Auth rate limits | Hosted total email rate 30/hour; per-user minimum interval 60 seconds; OTP length six and expiry 3600 seconds. Application maps 429 and expired-code errors without exposing credentials. Initial uniform recovery response is not proof of provider acceptance. |
| Invitation throttling | Existing 15-minute cooldown and 1000/hour sender/organization limits; shared locks and active-delivery uniqueness. Student-claim resend now reserves a durable attempt under the User lock before token generation/SMTP, counting failed/uncertain attempts too. |
| Errors and duplicates | Organization outbox records definitive SMTP rejections as FAILED, ambiguous outcomes as SENDING/DELIVERY_UNCERTAIN and does not auto-retry. SMTP is outside the DB transaction. Exactly-once sending across network/DB failures is not guaranteed. |
| Provider message tracking | Fixed locally: parse Resend's UUID from the real observed SMTP `250` response, rather than storing only a custom MIME Message-ID. Student-claim sends now return/persist an acceptance receipt too. |
| Cron protection | Unauthenticated production GET returned HTTP 401. Repository Vercel schedule is every minute; route processes up to 25 with bounded concurrency of three. No authenticated worker was invoked: it could drain unrelated production recipients. Successful production job execution remains unverified. |
| Downstream TLS / tracking | Dashboard delivery TLS policy is Opportunistic; client-to-SMTP connections require verified TLS. Actual recovery URLs were not rewritten into tracking URLs. No provider policy changed. |

Provider references: [Supabase email template variables](https://supabase.com/docs/guides/auth/auth-email-templates), [SMTP configuration](https://supabase.com/docs/guides/auth/auth-smtp), [Resend SMTP](https://resend.com/docs/send-with-smtp), [delivery status retrieval](https://resend.com/docs/api-reference/emails/retrieve-email), and [DMARC configuration](https://resend.com/docs/dashboard/domains/dmarc). A provider Delivered event and actual inbox observation are different evidence levels.

## Visual review and fixes

Open the [complete preview gallery](docs/email-audit/previews/current/index.html) or [before gallery](docs/email-audit/previews/before/index.html). Eleven distinct templates/variants each have desktop (720 px viewport), mobile (375 px), narrow mobile (320 px), and dark mobile screenshots: **44 final renders**, plus 44 before renders. Each has HTML; application templates also have a plain-text artifact. Illustrative codes and inert links are clearly identified as audit data.

The rendered checks found no horizontal overflow, unresolved template variables, or broken images. Existing deployed logo URLs work via a redirect; they are not falsely reported as broken. The final code replaces the alias with the canonical domain.

Changes preserve the established password-email layout and purpose:

- Shared `lib/transactional-email.ts` chrome uses existing OutClass wordmark, navy/orange branding, presentation tables, inline baseline styling, Outlook width/padding fallbacks, mobile padding, dark-theme colors, and a hidden preview line.
- Signup and OTP retain their six-digit workflow and concise content; add actual branding, clearer expiry, and a consistent footer. Versioned files are generated by `node scripts/email-audit.cjs build`.
- Organization invitations gain the shared layout, visible fallback URL, readable footer, and mobile/dark styling while retaining verified-identity acceptance.
- Student claim gains escaped HTML, a plain-text alternative, a validated same-origin token-fragment link, timeout parity, and message receipt tracking.
- Recovery and password-changed templates retain their card layout; improve small-text contrast, mobile spacing, dark colors, Outlook width fallback, preheader, and canonical image URL. **These Auth body updates are prepared locally, not applied to hosted Supabase.** The new recovery/password-changed files are not automatically wired into the full local Supabase config.
- MFA recovery now describes the real second-factor requirement instead of implying a password-strength failure; revokes the isolated AAL1 session without bypassing MFA.
- Broadcast preview history no longer displays fabricated delivery percentages/recipient counts. The leader dashboard no longer reports a nonexistent email draft as successful.
- `.env.example` now uses the canonical OutClass domain, and invitation worker documentation reflects its current 25-message batch.

Chrome previews and table/inline/MSO safeguards provide compatibility review, not proof of Gmail or Outlook rendering. Forced color inversion, image blocking, Outlook Word rendering, and actual recipient inbox placement require mail-client inspection. The delivered Auth emails' actual plain-text tabs were inspected without exposing their codes or tokens.

## Verification and remaining work

Automated checks: **933 tests passed, zero failed, nine skipped**; TypeScript and production build passed; lint reported zero errors and 25 existing warnings. All 44 final rendering checks passed. Details are recorded in [validation](docs/email-audit/validation.json). Unit regressions are supporting code evidence; they are not substituted for live provider delivery.

Remaining checks are concrete:

1. Recipient should inspect all nine messages in Inbox/Junk, desktop/mobile, and dark mode. Confirm logo, subject, preview line, links, button behavior, and text fallback. No inbox observation has been claimed. The 20:50 recovery email supersedes the earlier recovery link.
2. Fresh signup and unclaimed-account workflows need a genuinely unregistered approved mailbox or separate explicit authorization for record recreation. No second recipient or account deletion was used.
3. MFA-protected password reset and its automatic notification need the test account's real second-factor proof through a supported recovery process. No MFA factor was removed to make a test pass.
4. Review/publish the local application fixes through the normal deployment process; separately approve the hosted Auth body updates. Neither deployment nor permanent provider-setting changes were authorized or performed.
5. Approve a DMARC policy and provide a verified support/reply-to mailbox before configuring them. No DNS or sender changes were applied.
6. Check production Cron job execution and exact application SMTP secrets in an isolated recipient-restricted test queue. Do not invoke the current global worker just to test it.

No applicant, club, membership, or invitation production records were created, changed, or deleted. No real recipient other than the authorized address was emailed. The test account's authentication token/session state was exercised with authorization; its password and MFA factors were preserved because changes were rejected by the provider.
