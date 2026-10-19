# Signup response privacy — October 19, 2026

Implementation baseline: `c1a29f9`. Local application changes only; **nothing deployed or changed in production**.

## Change

`actions/onboarding.ts` previously turned Supabase's empty-identities existing-user response into “An account may already exist” while a new signup returned `{ authenticated: false }`. The [regression against the original source](regression-before.txt) reproduces that difference.

The action now returns exactly `{ authenticated: false }` for a new pending signup, an obfuscated existing-user response, or the documented `user_already_exists` error with HTTP 400/422. No provider user, identity, existence flag or session is returned. It still checks confirmation settings before signup, validates UVA addresses and registration inputs, and preserves rate-limit, service/configuration and unexpected-error behavior. An unexpected session is signed out before considering either existing-user outcome; a non-obfuscated confirmed response still fails closed.

`StudentOnboardingWizard` keeps the existing code form, cooldown, email correction and sign-in control. Its message is conditional rather than claiming an email was sent for an already registered address: “If this address can be registered…” followed by the existing sign-in path. Inputs, focusable controls, icons and the signup journey are retained. No password is silently reset or confirmed account renamed by the application.

No existence lookup, artificial response delay, database operation, schema migration, credential, RLS, Auth setting or dependency change is added. The provider request and configuration check remain; no latency improvement or constant-time response claim is made.

## Verification scope

The focused unit matrix covers the two documented existing-user forms, normal pending signup, unexpected sessions (including a session alongside an existing-user error), auto-confirmed settings/users, missing users, rate limits and unknown provider failures. It fails against the original action and passes with the change.

The reserved real runner includes `tests/signup-privacy-e2e.test.cjs` alongside the existing onboarding, account and bounded-role tests. It exercises actual Next Server Actions, Supabase Auth, PostgreSQL and locally captured SMTP:

- Existing and new addresses return the exact same action result and remain unauthenticated; new accounts still require their delivered OTP.
- Repeated signup leaves the verified identity IDs, confirmation, name metadata, account/member counts and original password intact; the attempted replacement password cannot sign in.
- Desktop and iPhone browsers use the same verification text/form for new and existing addresses. Both remain unauthenticated, keep the disabled resend/verify controls, clear the password on email correction and retain the invitation destination when switching to sign-in. All browser runtime errors remain failures, and horizontal overflow is checked.

Final results: **29 real integration tests passed, zero skipped/failed**, including four new signup-privacy cases counted with their parent; **1,237 default tests passed, 33 fixture-gated skips, zero failed**; 27 focused auth/navigation tests passed. Typecheck and the actual Next production build passed; lint retained 26 existing warnings and zero errors. [Real run](e2e.txt), [default suite](tests.txt), [focused checks](focused.txt).

The first browser attempt failed while retrieving an unavailable Chrome response body ([initial run](initial-e2e.txt)). The browser matcher now identifies the exact registration action from the production manifest; API tests retain exact result assertions, and browser tests assert the actual verification UI and session state. No runtime-error filter or product failure was suppressed. The fresh final run passed all four desktop/mobile new/existing combinations. The [desktop](desktop-new.png) and [mobile](mobile-existing.png) screenshots were visually inspected and contain only synthetic fixture labels.

Reproduce with Node 24:

```sh
npx --yes --package=node@24 -- node scripts/run-onboarding-e2e.cjs --runtime-role
```

This operates only on `outclass-onboarding-e2e` at the reserved local ports. Email is captured locally. The bounded-role mode removes its stack/backup and temporary credential/TLS-key configuration afterward. No production signup, guessed real address or credential rotation was used. Final counts and source hashes are in [validation.json](validation.json).

## Limits and rollout

This closes the **explicit application signup response/UI disclosure locally**, not every account-enumeration channel. Public Supabase Auth endpoints remain directly accessible by design. In particular, the existing real onboarding suite confirms that `signInWithOtp({ shouldCreateUser: false })` rejects an absent account. Provider-level signup forms, password policy errors, cooldown/rate-limit behavior and timing may also distinguish requests. Uniform application JSON does not establish protection for those channels; no timing/load experiment was performed. Keep M3 partially mitigated until the overall provider/abuse policy is reviewed and an approved release is verified.

The email receipt itself is available only to its mailbox owner. We do not send an unsolicited sign-in/recovery email to a confirmed account merely to make signup resemble a new account, nor change passwordless login into automatic signup. Provider protections and targeted abuse budgets need separate review; no production WAF/Auth setting was changed.

Release this application patch with the existing security fixes after review. Safely verify the intended confirmation/sign-in experience using approved test accounts; do not enumerate production students. If a regression appears, diagnose or restore a compatible reviewed artifact while retaining the uniform signup result where possible. There is no SQL or credential rollback for this patch; the separate [runtime-role proposal](../runtime-role/README.md) remains review-only and retains its own gates.

Sources: [Supabase signUp](https://supabase.com/docs/reference/javascript/auth-signup), [Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes), [identity-linking existing-user behavior](https://supabase.com/docs/guides/auth/auth-identity-linking), [passwordless existing-account restriction](https://supabase.com/docs/guides/auth/auth-email-passwordless). Error-code comparisons use stable codes, not provider message text.
