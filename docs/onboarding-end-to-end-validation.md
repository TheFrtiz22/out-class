# Organization onboarding end-to-end validation

Validated on `feature/club-onboarding` on October 2, 2026.

## Reproduce

Requires Node 22+, installed dependencies, Docker, Supabase CLI, and OpenSSL:

```sh
npm run test:onboarding:e2e
```

This builds and starts the real Next application, provisions the reserved local
`outclass-onboarding-e2e` Supabase project, applies the project's **Prisma**
migration history, and runs all eight scenarios. Ports are reserved for this test:
application 3107, Supabase API 55321, PostgreSQL 55322, Mailpit 55324/55325.
The normal `out-class` local project is untouched. All database, Auth, and SMTP
configuration is explicitly overridden with local test values. No production
commands or email delivery occur.

The runner uses a private directory under the OS temporary directory for logs,
test credentials, and a short-lived test SMTP certificate. Supabase Auth and the
application use the same captured Mailpit SMTP service. TLS verification stays
enabled. A copied test configuration enables email confirmation and TOTP MFA;
the repository's default local configuration disables them. The test admin signs
up and verifies email normally, enrolls a real TOTP factor, and receives a
server-side admin grant in the disposable database.

The default command stops the test application and test Supabase stack afterward.
`npm run test:onboarding:e2e -- --keep` keeps them running for browser review;
interrupt the runner, then stop only the test project using the printed temporary
work directory. Never run reset against production or the normal local project.
`supabase db reset` is not the project's migration path: Supabase CLI migrations
and seed are disabled, and Prisma owns the schema. Fresh migration replay was
also tested separately.

To include the running HTTP scenarios in the complete suite:

```sh
OUTCLASS_ONBOARDING_E2E_CONFIG=<printed-private-config-path> npm test
```

The native concurrency suite additionally accepts
`OUTCLASS_SECURITY_TEST_DATABASE_URL`, restricted to a local database named
`outclass_security_test`. During validation this database was created inside the
reserved test PostgreSQL instance and all 17 Prisma migrations were applied to it.

## Results

These scenarios invoke production server actions over actual HTTP, with real
Supabase sessions and actual PostgreSQL transactions. There are no Auth, database,
authorization, action-handler, or email-provider mocks in this E2E suite.

| Scenario | Verified result |
| --- | --- |
| A: New president | Superadmin MFA, normalized designation, no fake User, real signup/email OTP, verified identity association, required profile, atomic OWNER claim, workspace and saved checklist access. |
| B: Roster | Preview surfaces invalid/duplicate/already-member rows; confirmation creates three pending MEMBER invitations, six audit rows, no fake users, and no automatic email. |
| C: Existing student | Import matches existing account; dashboard request source exposes invitation; acceptance creates one active membership. |
| D: New student | Invitation exists before account; normal signup matches it, supplies name/year suggestions, accepts edited profile, and creates membership. |
| E: Dismissal | Dashboard hides request while status stays PENDING; Settings includes it; shared acceptance creates membership. |
| F: Incremental roster | Prior membership records remain byte-for-byte unchanged; only the new identity receives an invitation. |
| G: Permissions | Direct HTTP member management/roster/email/settings attempts denied; recruiting admin limited to recruiting; ADMIN cannot grant OWNER or transfer ownership; six sensitive PostgREST tables deny authenticated browser access. |
| H: Replays | Repeated accept/claim denied; confirmed import reused; repeated roster creates no duplicate; concurrent send/worker attempts deliver exactly one captured email; resend cooldown enforced. |

The native PostgreSQL suite separately exercised simultaneous ownership claims,
acceptance, overlapping imports, email worker claims, and owner suspensions using
multiple database connections. Existing parser/security suites cover size limits,
malicious fields, malformed input, and large rosters.

Browser validation in Chrome additionally verified editable name/year suggestions,
required profile completion, preserved invitation destination, claiming into the
club workspace, saved setup checklist, dashboard dismissal, Settings recovery,
and claiming from Settings. After enabling Chrome file uploads, the complete browser file-picker flow also
passed: six rows previewed as two ready, one duplicate, one invalid, one existing
member, and one existing invitation. A missing year displayed a warning. Clicking
Import members created two pending invitations and six durable audit rows. Database
checks confirmed no fake users, no email sends, and unchanged prior memberships.
Reuploading and confirming the same file created zero additional invitations; the
preview correctly changed to three already invited rows. Both imports completed
and retained all row outcomes. No application changes were needed for this retest.

The initial president scenario uses the existing invitation URL and normal sign-in.
It does not send an initial president email: the superadmin creation action has
no send operation, and the current email authorization requires an active club
leadership membership. Member invitation SMTP delivery is verified in H. This
existing product gap is recorded rather than adding a new feature during validation.

## Regression fixed

Invitation links and Settings organization entry points previously bypassed the
first-login profile wizard. Both now use a shared server-side profile guard and
preserve the original return destination. This was reproduced in real HTTP and
Chrome before fixing; the E2E suite asserts both entry points redirect incomplete
profiles. The existing Settings authentication test also checks the profile guard.

## Final checks

- `npm test` with HTTP E2E and native PostgreSQL suites enabled: **392 passed,
  zero failed, zero skipped**.
- `npm run test:migrations`: all **17 migrations** replayed on fresh and legacy
  databases; all **27 tables** enforce RLS and deny browser-role CRUD.
- `npm run lint`: passed; **31 pre-existing warnings**, zero errors.
- `npm run typecheck`: passed.
- `npm run build`: production build passed with isolated local configuration and
  `OUTCLASS_PUBLISH_BUILD=1` to preserve development build files.
- No schema changes, production operations, unrelated feature changes, or new
  email provider.
