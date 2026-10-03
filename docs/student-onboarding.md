# Student onboarding

The landing page's **Create Student Profile** link opens the embedded wizard at
`#create-account`. Students provide a UVA email, name, and password, verify the
six-digit Supabase email code inside OutClass, then save academics and
optional bio, experience, LinkedIn, and resume. Existing students use **Sign In**.
An authenticated student without a profile resumes onboarding when they return.

## Supabase setup

Use the environment variables in `.env.example`. The database URL must point to
the same Supabase project as the Auth URL. Apply the existing Prisma schema to
that database. The app also creates a missing application User record from a
validated Supabase session, so signup does not depend on the optional auth trigger.

Email confirmation must remain enabled in hosted Supabase. The signup action checks
`mailer_autoconfirm === false` and the enabled email provider before creating an
account, and rejects unexpected auto-confirmed signup responses. No verification
bypass or administrative account creation remains in normal signup. Test accounts
use the same confirmation flow through disposable local Supabase and Mailpit.

The secret key never enters client props or browser code. Passwords are sent to
Supabase Auth and are not stored in the application User or StudentProfile tables.

Both Confirm signup and Magic Link must use `{{ .Token }}` and a six-digit OTP.
Versioned templates live in `supabase/templates/`; local configuration loads them
into Mailpit. Hosted templates are independent of local configuration. Password
recovery is configured separately and must retain its recovery link behavior.

Signup verification requires a returned session and a matching confirmed user
from `auth.getUser()` before advancing. Existing users retain password and Azure
login; optional email-code login always uses `shouldCreateUser: false`. Resend
uses `auth.resend({ type: "signup", email })`, a 60-second UI cooldown and safe
rate-limit errors. Microsoft identity verification uses Supabase-issued Azure
identity data, never browser-editable profile metadata.

See [email verification audit](email-verification-audit.md) for tested scope and
remaining live delivery checks.

Resume uploads use the existing `resumes` bucket and its authenticated storage
policies. Upload failures are displayed and do not silently discard the attachment.
Students can remove the file or skip optional assets and complete their profile.

Run the focused regression tests with `node --test tests/onboarding.test.cjs`.

## Organization settings

The account menu and dashboard requests link to `/settings/organizations`. This
verified-account page shows active memberships and their organization-specific
roles using the existing authenticated `/api/users/me` data. Accepting an
invitation refreshes that data so a new membership appears immediately.

All pending, unexpired invitations appear here, including dashboard-dismissed
requests. Users can accept, claim an OWNER invitation, restore a hidden request
to the dashboard, or explicitly confirm a decline. These controls reuse the
same identity-verified server actions and atomic membership creation as the
dashboard. Dismissal changes visibility only; confirmed decline is terminal.
Invitation history is not shown. No database or RLS changes are required.
