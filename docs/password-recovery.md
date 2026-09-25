# Password recovery

OutClass uses Supabase `resetPasswordForEmail`, `verifyOtp({ type: "recovery", token_hash })`, and `updateUser({ password })`. No custom reset tokens, service-role key, or database schema changes are involved.

## Required Supabase configuration

1. Configure a working SMTP sender and recovery email delivery. Keep Supabase recovery rate limits enabled; configure provider password strength and leaked-password protection as appropriate.
2. Set the production Site URL and allow the exact `/reset-password` redirect URL for each supported deployment (production, explicitly trusted previews, and localhost for development). Avoid broad untrusted preview wildcards.
3. In **Authentication → Email Templates → Reset Password**, set the reset button/link to:

   ```html
   <a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}">Reset your OutClass password</a>
   ```

   The application's request supplies the trusted same-origin `/reset-password` redirect. This dedicated template is required; the default `ConfirmationURL` template consumes the token before the app can verify it and is not compatible with this flow. Do not change signup, invitation, magic-link, or OAuth templates.
4. Existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are the only application environment variables needed. Never substitute a service-role key.

## Security and behavior

- Both login screens link to `/forgot-password`; `/login` also exposes the existing normal login UI as a stable return destination.
- Eligible-looking UVA emails always get the same public response for existing accounts, missing accounts, provider throttling, and delivery failures. Logs contain only generic delivery failures/provider codes, never addresses, tokens, or passwords.
- The email token is carried in a fragment, which browsers do not send to the web server. The reset page removes it from browser history and holds it only in memory. It is submitted over HTTPS in a same-origin POST when the user chooses a password. Opening or previewing the link does not consume it.
- Supabase validates expiry and single use with the hard-coded `recovery` type. A valid existing login alone cannot authorize this endpoint. Recovery runs in an isolated provider client and never changes the visitor's existing identity cookies or returns provider sessions to the browser.
- Local password rules require 8–128 characters and matching confirmation; Supabase's configured policy is also enforced. A provider policy rejection consumes the one-time link: the UI explains how to request another. Reloading the cleaned page likewise requires reopening the email or requesting a fresh link.
- On success, global Supabase sign-out revokes refresh sessions; previously issued access JWTs retain their provider-defined remaining lifetime. Revocation failure is logged without falsely reporting the successful password change as a failure. The student explicitly returns to login.
- Demo and administrator view-as markers block all recovery writes, consistent with the application's existing isolation rules. Exit those modes first. Admin password recovery never bypasses MFA or platform grants.
- No recovery tokens are persisted by OutClass. Do not configure observability tools to capture request bodies for `/api/auth/password-recovery`, and disable email link tracking that rewrites sensitive URLs.

## Deployment smoke test

With real SMTP/Supabase credentials, verify existing/missing UVA emails show identical confirmation, receive and use the configured link on another device, reject used/expired links and mismatched passwords, confirm the old password fails and the new password works, and confirm platform admins still require MFA. Exercise provider password-policy rejection and throttling. Auth/email delivery could not be tested with live credentials in the local environment.

Provider reference: [Supabase password recovery](https://supabase.com/docs/guides/auth/passwords).
