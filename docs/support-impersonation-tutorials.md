# Support impersonation and tutorials

The existing `/platform/view-as` entry point now opens the customer's application workspace. It does not sign in to Supabase as the customer, mint customer tokens, or replace the administrator's Auth cookies.

## Identity and authorization

- Starting a session requires the existing environment allowlist, active `PlatformAdmin` grant, enabled account, and Supabase AAL2. The platform console requires an explicit target, support reason, and `LOG IN AS` confirmation.
- A random 256-bit, HTTP-only, SameSite=Strict cookie references the existing `PlatformViewSession`. Only its SHA-256 hash is stored. It remains bound to the real authenticated administrator and expires after 30 minutes.
- `requireAuth()` validates that session and returns the target's application identity. Club guards continue to read the target's current database membership. Neither the administrator's club permissions nor provider verification metadata are inherited.
- `requirePlatformAdmin()` resolves the original identity, but denies platform operations until impersonation has ended. Platform administrators (including inactive grants and allowlisted accounts) cannot be targets. Disabled, newly privileged, expired, revoked, or mismatched targets fail closed.
- Old sessions receive `mode = READ_ONLY` during migration and cannot silently acquire write privileges. New support sessions explicitly use `IMPERSONATION`.
- Start/exit broadcast a reload hint to other tabs; a root-level context check also runs on focus, back/forward restoration, and periodically. It carries no token or authority and prevents a previously open tab from retaining the old identity display.
- Root layout renders a non-dismissable, fixed banner from the HTTP-only context marker, including invalid/expired sessions. Exit clears only this marker, ends the session and records the event; it does not sign either identity out. Explicit exit still works after platform-grant/MFA revocation.
- Authentication callbacks, password recovery, demo switching and account registration are unavailable while impersonating. Provider-login UI and sign-out are not offered inside the effective experience. Verified-email-dependent invitation acceptance reads the target's actual Auth metadata server-side with the existing service key; it never uses the administrator's verification state.
- The optional club selection chooses the initial workspace. It does not confer club permissions or limit the session to that club: the target can navigate their own allowed experiences.

## Audit contract

The existing append-only `AuditLog` is the only audit store. New nullable `effectiveUserId` and `supportSessionId` fields preserve attribution without rewriting historical records. Existing domain audit entries emitted while impersonating have `actorId` set to the real administrator and retain their domain action and target. The platform console visibly labels both identities.

The shared Prisma query extension also records a durable `platform.impersonation.mutation-attempt` before every ORM mutation and a correlated `platform.impersonation.statement-returned` after a successful statement. These events contain model/operation/correlation IDs, not mutation arguments, passwords, document contents, or application answers. Nested writes are included in the enclosing ORM operation. Failed attempts remain distinguishable from returned statements. A returned statement is **not a commit receipt**: a surrounding transaction can still roll back. Domain audit entries written inside transactions provide committed business-event detail.

The pre-operation audit must succeed before mutations or signed Storage capabilities are issued. Generic attempt records use the underlying Prisma connection outside the domain transaction so a failed business transaction cannot erase the attempt. Production connection pools need capacity for this additional connection; support mutations fail closed if audit or session verification is unavailable. The async recursion guard uses lexical `AsyncLocalStorage.run`, never a globally entered identity context.

All current raw queries in application mutations are parameterized `SELECT ... FOR UPDATE` locks. Future raw SQL mutations or external side effects must explicitly use the same audit infrastructure; the ORM hook cannot infer their effects. Existing signed resume/attachment reads, task Storage access, and upload issuance have explicit support audit events. Support uploads sign fresh paths under the effective user's ID with the existing server service key. Normal callers retain existing Storage RLS behavior. Issued signed capabilities retain their existing lifetimes after exit; no target JWT is issued.

## Tutorials

`UserTutorial` is the first persistent tutorial-preference structure in this repository. Its composite key is `(userId, experience)`, with separate `student` and `leader` rows, status, step, content version, and update timestamp. The table has RLS enabled and no browser-role CRUD grants. Server actions derive the user from `requireAuth()` and require current leader-workspace access for leader progress.

The shared ProductShell presents a small non-modal contextual guide with highlights, progress, Back/Next, Skip, Escape, navigation links, and a persistent Tutorial help restart control. It supports narrow screens and keyboard buttons. Failed saves offer a local dismissal instead of trapping the user. Completed/skipped progress persists across devices; stale progress requests cannot reopen it without an explicit restart.

Support reads the customer's saved progress but previews further steps without changing that customer's completion state. Student and leader guides are independent. The guide describes Corkboard conditionally; there is no Corkboard implementation in this repository. It also distinguishes voting permission from decision publishing and does not invent a ballot service.

## Migration and release

`20261001000000_support_impersonation_tutorials` adds only application-owned structures. It preserves existing accounts, memberships, session/audit records and does not change Supabase-owned Auth, Storage, Realtime, roles or registries. Earlier migration files remain unchanged.

Review and rehearse the new migration before deploying code that depends on its columns/table. No migration has been applied to a connected environment by this feature implementation. A downgrade should first disable new support sessions and end active sessions. Retain the additive columns/table during an application rollback to preserve audit attribution and tutorial history; do not delete audit data as a rollback shortcut.

Tests cover server authorization and identity restoration, historical/forged/revoked sessions, audit failure behavior and concurrent context isolation, Storage path scoping, tutorial persistence and UI controls, and isolated PostgreSQL migration/grant checks. Deployment still needs an authenticated staging smoke test with real MFA, the configured service key and connection pool, and desktop/mobile browser checks. No live environment was used for these tests.

## Changed-file inventory

### Identity, support sessions and auditing

- `actions/club-access.ts`
- `actions/interview-kits.ts`
- `actions/interview-rooms.ts`
- `actions/onboarding.ts`
- `actions/recruiting-rules.ts`
- `actions/storage.ts`
- `actions/tasks.ts`
- `app/api/application-attachments/route.ts`
- `app/api/demo/route.ts`
- `app/api/platform/view-as/blocked/route.ts`
- `app/api/platform/view-as/route.ts`
- `app/api/resumes/route.ts`
- `app/api/users/me/route.ts`
- `app/auth/callback/route.ts`
- `app/globals.css`
- `app/layout.tsx`
- `app/page.tsx`
- `app/platform/login/page.tsx`
- `app/platform/view-as/page.tsx`
- `middleware.ts`
- `utils/auth.ts`
- `utils/platform-admin.ts`
- `utils/platform-view-as.ts`
- `utils/prisma.ts`
- `utils/support-audit.ts`

### Tutorials and frontend

- `actions/tutorials.ts`
- `components/app-shell.tsx`
- `components/platform-console.tsx`
- `components/platform-view-banner.tsx`
- `components/shell/product-shell.tsx`
- `components/support-session-sync.tsx`
- `components/tutorial-walkthrough.tsx`
- `components/views/auth-view.tsx`
- `components/views/student-onboarding-wizard.tsx`
- `contexts/auth-context.tsx`
- `lib/tutorials.ts`

### Schema and migration

- `prisma/migrations/20261001000000_support_impersonation_tutorials/migration.sql`
- `prisma/schema.prisma`

### Tests and documentation

- `docs/support-impersonation-tutorials.md`
- `tests/api-application-attachments.test.cjs`
- `tests/api-resumes.test.cjs`
- `tests/authorization.test.cjs`
- `tests/database-reconciliation.test.cjs`
- `tests/demo-access-route.test.cjs`
- `tests/integration-audit.test.cjs`
- `tests/onboarding.test.cjs`
- `tests/platform-admin.test.cjs`
- `tests/product-shell-focus.test.cjs`
- `tests/support-tutorials.test.cjs`
- `tests/tasks.test.cjs`

