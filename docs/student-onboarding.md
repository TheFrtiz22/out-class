# Student onboarding

The landing page's **Create Student Profile** link opens the embedded wizard at
`#create-account`. Students provide a UVA email, name, and password, choose email
verification or **Skip verification & create account**, then save academics and
optional bio, experience, LinkedIn, and resume. Existing students use **Sign In**.
An authenticated student without a profile resumes onboarding when they return.

## Supabase setup

Use the environment variables in `.env.example`. The database URL must point to
the same Supabase project as the Auth URL. Apply the existing Prisma schema to
that database. The app also creates a missing application User record from a
validated Supabase session, so signup does not depend on the optional auth trigger.

For the temporary email-free pilot, set `SUPABASE_SECRET_KEY` and
`ALLOW_UNVERIFIED_SIGNUP=true` on the server. The server creates only new accounts,
auto-confirms their email, records `email_verification_skipped` in app metadata,
and signs in with their password. It never confirms or resets existing accounts.
Supabase treats these new accounts as confirmed; ownership of their email has
not been independently checked. Disable the flag once email delivery is ready.
An alternative is disabling Confirm email in Supabase; standard password signup
then returns a session without sending mail.

The secret key never enters client props or browser code. Passwords are sent to
Supabase Auth and are not stored in the application User or StudentProfile tables.

To use the code-based verification option, configure email delivery and a signup
email template containing `{{ .Token }}`. Without that template, Supabase's default
confirmation email may contain a link rather than the code expected by the form.

Resume uploads use the existing `resumes` bucket and its authenticated storage
policies. Upload failures are displayed and do not silently discard the attachment.
Students can remove the file or skip optional assets and complete their profile.

Run the focused regression tests with `node --test tests/onboarding.test.cjs`.
