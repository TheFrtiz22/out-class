# Admin workspace implementation and verification

Verified on 2026-10-06. No commit or push. No staging or production connections or migrations were used.

## Authority and elevation

The authority remains a verified, enabled UVA account, server-only `OUTCLASS_PLATFORM_ADMIN_IDS`, an active `PlatformAdmin` grant, and `aal2`. Neither a club role nor switcher visibility authorizes Admin. `/api/platform/eligibility` provides only a server-derived boolean.

Every existing platform guard now additionally requires independent elevation. Fresh password verification takes place on a new server-side provider client; a five-minute, actor/session-bound MFA challenge stores only encrypted temporary provider credentials and an opaque-cookie hash. Password starts are serialized and limited to five per fifteen minutes; failed MFA attempts persist and are capped at five. Completing MFA rechecks the live account/grant/allowlist, consumes the challenge, clears its credentials, revokes prior elevation, and attaches the provider's fresh `aal2` session.

A thirty-minute `AdminElevation` records the actual actor, verified Auth session ID, factor ID, password/MFA evidence timestamps, creation, expiry, and revocation. Only a random HttpOnly, SameSite=Strict cookie identifies it; production cookies are Secure. Cookies are never returned as API JSON or accessible to browser JavaScript. The guard verifies signature-checked session claims and that the corresponding provider-owned `auth.sessions` row still exists and has not expired. This closes the window where a JWT outlives provider logout. Logout revokes active elevation and unfinished challenges and ends support sessions. Expired, revoked, forged, mismatched-actor/session and closed-provider-session evidence fails closed.

Impersonation continues to preserve actual actor and effective target using `PlatformViewSession` and existing support audit context. Platform mutations require returning to Admin. Targeting platform administrators remains forbidden. The persistent banner includes Return to Admin; no target credentials are created.

## Schema, migration and RLS

New migration: `20261006010000_admin_workspace`.

- `AdminElevation`: private, hashed, session-bound elevation and evidence; maximum thirty-minute lifetime.
- `AdminElevationChallenge`: private encrypted temporary credentials, challenge identifiers, five-minute lifetime, consumption and bounded attempts.
- `PlatformReport`: validated USER/CLUB/EVENT/CONTENT/SUPPORT reports, four statuses, optimistic revision and final-resolution requirements.
- `Club.suspendedAt`: a server-enforced pause on club operations, with reasoned and audited suspension/restoration. The state is an additional gate on existing membership/capability authorization; it preserves memberships and history. See [club-suspension-review.md](club-suspension-review.md) for the follow-up implementation and verification.
- User relations match the actor/reporter foreign keys. Existing `PlatformAdmin`, invitation, publication and append-only `AuditLog` models remain authoritative.

All three new tables enable RLS, revoke all PUBLIC/anon/authenticated privileges, and use a restrictive ALL policy with false USING/WITH CHECK. Tests demonstrate denial even after accidental broad grants and permissive policies. No browser permissions were added to Auth tables.

The dedicated disposable database on localhost:56322 received the two previously unapplied existing interview migrations (`20261004000000_interview_foundation`, `20261005000000_interview_scheduling_access`) and the new Admin migration. All 27 migrations also passed fresh/legacy in-memory checks; all 53 application tables deny browser-role CRUD. Existing identities, owners and memberships and append-only audit behavior are preserved.

## Product surfaces

Admin reuses ProductShell, the existing illustrations, navigation, dialog, input and button primitives. The sidebar has all fourteen requested destinations. Overview counts real records and renders real approval/report/support attention items. Users, Clubs and Applications provide server-filtered investigation, pagination and reasoned inspection. Support combines the user directory and support reports, with identity, email, profile-name and membership-club search. Destructive account operations and sensitive impersonation require typed confirmation.

Club inspection includes organization data, membership/leadership roles, invitations and timestamps, claim history, applications count, event publication states and recent audit history. Applications remain an oversight surface and grant no club committee membership. Corkboard uses the existing publication model and private flyer preview helpers; Event Approvals uses the existing audited moderation actions, reapproval triggers and authorship restriction. Saved clubs remain in their separate existing flow.

Reports use an authenticated submission action with target validation and a serialized rate limit. Resolution uses a locked revision check and audit in the same transaction. Settings validate only supported content fields (`supportEmail`, `campusNotice`, `maintenanceNotice`) with safe empty defaults, explicit reason/confirmation and audited writes to `PlatformContent`. These are stored configuration values. The settings UI explicitly states that notices are not displayed outside Admin, broadcast, emailed, or sent to users. Public notice rendering and delivery are not added here. Permissions distinguish platform grants from club leadership and membership and reuse the existing audited capability mutation. Activity/Audit read the existing AuditLog and support sessions, with sensitive keys excluded from rendered detail.

## Invitations and audit

Student provisioning has no password input. Provider-owned invite generation supplies the identity-bound, expiring, single-use token; it is emailed only to the intended address through the configured TLS SMTP transport. The token is placed in a URL fragment, removed from browser history on load, and never returned to the administrator. The claim endpoint first validates the provider's pending email/token binding and local account status, then consumes the provider token and lets the student choose a password. Wrong signed-in identities, wrong anonymous email, expired tokens and claimed-token replay are rejected. Names/profile metadata are supplied to the existing account flow. Optional club relationships create the existing identity-bound MEMBER invitation and require acceptance.

Club creation wraps existing idempotent organization onboarding, SchoolIdentity and ClubInvitation, then queues delivery through the existing durable outbox. Additional leaders receive ADMIN invitations; the platform actor receives no club membership. The UI keeps a stable request ID through retries. Resends recheck current authority and invitation state. A pending platform-designated owner can be replaced only by an elevated administrator: old revocation, canonical replacement invitation and audit are one club-locked transaction. A failed replacement rolls everything back. Claimed-club ownership remains in existing ownership management. Copyable club claim links contain a nonsecret invitation ID and still require the intended verified identity.

Audit uses only the existing append-only AuditLog/support infrastructure. New entries cover elevation attempts/failures/success/end/logout, dashboard and record reads, report creation/resolution, settings, club suspension, student invitation creation/delivery/resend, club details/delivery and owner replacement. Existing account disabling, permission, claim and event moderation audit is retained. Passwords, invitation secrets, elevation cookies and provider credentials are not audit payloads. Impersonated actions retain actor/effective target/support session attribution.

## Initial Prompt 53 verification

The suspension enforcement follow-up has its own current results in [club-suspension-review.md](club-suspension-review.md).

- `node scripts/run-admin-local.cjs validate`: PASS, running `npm run validate` with all database/provider/SMTP configuration pinned to disposable localhost services. 688 tests: 682 passed, 6 opt-in tests skipped; migration checks, ESLint, TypeScript and production build passed.
- `node --test tests/admin-elevation.test.cjs tests/admin-workspace.test.cjs tests/platform-admin.test.cjs tests/authorization.test.cjs tests/platform-organization-onboarding.test.cjs tests/club-onboarding.test.cjs tests/campus-events.test.cjs tests/campus-event-authorship.test.cjs tests/support-tutorials.test.cjs`: 89 passed, 0 failed/skipped.
- `node scripts/run-admin-local.cjs integration`: PASS, 1 actual-provider integration test. Real password/MFA and HttpOnly elevation, normal student/leader/existing-aal2 denial, direct routes/actions, report resolution, actual/effective support identity, return to Admin, privileged-target rejection, real SMTP student invite, wrong-session and anonymous wrong-email denial, successful intended claim, replay denial, no claimed-invite resend, club creation without admin membership, failed-owner-replacement rollback, successful replacement and provider logout/elevation revocation.
- Disposable browser only: Admin switcher visibility and password/MFA entry; actual metric dashboard; Users search/reasoned inspection; Log in as with persistent student banner and Return to Admin; Clubs and invitation/audit detail; Event Approvals tabs and event details; both Onboarding forms; first-class Support; Activity and Audit Log with recorded support/elevation, claim and invitation actions. Revoked elevation redirected to reauthentication; another fresh password/MFA restored Admin. Final build renders the corrected Admin sidebar and derived club states.
- `git diff --check`: PASS.
- Verification logs: `/tmp/admin-validation-final.log`, `/tmp/admin-focused-final.log`, `/tmp/admin-integration.log`, `/tmp/admin-local-migrate.log`.
- Dashboard screenshot: `/tmp/outclass-admin-overview.jpg`.

## Review and rollout dependencies

No deployment was performed. Review the migration and diff before applying it to any non-disposable environment. Existing runtime allowlist/grants were not changed. The trusted application database connection must be able to read provider-owned `auth.sessions` (live-session verification) and `auth.users` (pre-consumption invite binding); these queries match the actual disposable Supabase schema and should be verified against the target provider version/connection privileges during rollout. No browser grants are needed or permitted.

SMTP/provider provisioning cannot be made one distributed database transaction: a delivery or optional-profile/relationship failure can leave an audited, unclaimed provider account. Users provides resend recovery; it does not set passwords or delete/recreate identities. Club delivery uses the existing durable outbox. Student resends have a fifteen-minute audit-based cooldown; provider regeneration invalidates the prior invite. Expired challenge credentials remain encrypted until the next challenge/logout consumes them; a separate retention policy could scrub abandoned expired rows. ESLint passes with existing advisory hook/image warnings (including the enrollment QR image warning). No test failure remains.

## Exact files changed

Modified tracked files:

- `actions/campus-events.ts`
- `actions/club-onboarding.ts`
- `actions/platform-admin.ts`
- `app/api/platform/view-as/route.ts`
- `app/platform/claims/page.tsx`
- `app/platform/login/page.tsx`
- `app/platform/page.tsx`
- `components/club-workspace-switcher.tsx`
- `components/platform-console.tsx`
- `components/platform-view-banner.tsx`
- `components/shell/product-shell.tsx`
- `lib/platform-console.ts`
- `prisma/schema.prisma`
- `tests/authorization.test.cjs`
- `tests/platform-admin.test.cjs`
- `tests/platform-organization-onboarding.test.cjs`
- `tests/support-tutorials.test.cjs`
- `utils/club-onboarding.ts`
- `utils/email.ts`
- `utils/invitation-delivery.ts`
- `utils/platform-admin.ts`

New files:

- `actions/admin-workspace.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/student-claim/route.ts`
- `app/api/platform/elevation/route.ts`
- `app/api/platform/eligibility/route.ts`
- `app/auth/student-claim/page.tsx`
- `app/platform/[section]/page.tsx`
- `app/platform/layout.tsx`
- `components/admin/admin-corkboard.tsx`
- `components/admin/admin-directory.tsx`
- `components/admin/admin-onboarding.tsx`
- `components/admin/admin-permissions.tsx`
- `components/admin/admin-reports.tsx`
- `components/admin/admin-settings.tsx`
- `components/admin/admin-shell.tsx`
- `docs/admin-workspace.md`
- `lib/admin-elevation.ts`
- `lib/admin-navigation.ts`
- `lib/request-origin.ts`
- `prisma/migrations/20261006010000_admin_workspace/migration.sql`
- `scripts/run-admin-local.cjs`
- `tests/admin-elevation.test.cjs`
- `tests/admin-workspace-e2e.test.cjs`
- `tests/admin-workspace.test.cjs`
- `utils/admin-elevation.ts`
