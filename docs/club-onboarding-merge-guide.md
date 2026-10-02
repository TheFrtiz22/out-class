# Club onboarding merge guide

Prepared for integration only. No merge, rebase, push, production deployment or database operation was performed during this audit.

## Audit boundary and integration target

- Branch: `feature/club-onboarding`; audited branch tip: `032c31e`; implementation tip: `734e2f8`.
- Comparison: local `main` (`f453b27988a1f2307c78f543149dfc60838e0a73`) to the audited branch tip: 98 files, 6,054 insertions, 79 deletions (69 new, 29 modified), including the original merge-guide commit. The subsequent guide refresh changes documentation only.
- Cached `origin/main` is two commits ahead of local `main`: `1c024e2` (production MCP configuration) and `fed4fb8` (tutorial migration foreign key). These refs were inspected without fetching. They may not represent the other developer's latest work.
- Those two commits change `.vscode/mcp.json` and the pre-existing `20261001000000_support_impersonation_tutorials/migration.sql`; neither path overlaps this branch's changed files. The latter adds `ON UPDATE CASCADE` to `UserTutorial.userId`. Resolve the prerequisite migration's applied checksum/history deliberately, then validate the combined migration stack. Do not rewrite an already-applied migration casually.
- Before the eventual integration, compare against the actual agreed target and the other developer's latest changes. The conflict classifications below describe this audited comparison, not a guarantee of conflict-free integration.

## Audit findings

Every changed file was reviewed by content/diff, responsibility, and automated hygiene checks. No accidental unrelated refactors, large unrelated formatting sweeps, application debug logging, temporary artifacts, committed local environment files, private keys/provider tokens, commented-out experiments, or fake production user/roster seed data were found. Historical added lines were also scanned for private keys, common provider token formats and JWT literals; no matches were found. Pattern scans do not replace deployment secret management.

The local E2E script intentionally prints progress/errors. Test-only accounts, credentials and malicious CSV fixtures are confined to test tooling; they exercise a reserved disposable local project. The only seeded school metadata is the legitimate UVA school/identifier configuration and legacy campus backfill. Existing legacy demo behavior is retained.

Changes to tasks, meetings, applications, interview rooms and search are necessary access-control changes: removed/suspended memberships must not retain access. Preserve them even though they extend beyond the new onboarding screens. No generated Prisma client or Supabase database types are committed. The lockfile is the only changed generated artifact. No production config or environment file is changed by this branch.

## Feature commits (execution/history order)

| Commit | Purpose |
| --- | --- |
| `6bda2fd` — `onboard prompt 2` | Database foundation: school identities, invitation lifecycle, memberships, imports, audit/delivery structures, SQL guards/RLS and active-membership compatibility. |
| `7341db6` | Superadmin organization creation and initial OWNER invitation; no fake users. |
| `0fa20ab` | Verified identity discovery and atomic organization claiming. |
| `9defb81` | Safe CSV upload, parsing, validation and preview. |
| `7f35213` | Confirmed additive roster imports and row-level audit outcomes. |
| `ad6bbbc` | Dashboard invitation cards, acceptance and reversible dismissal. |
| `f7961b8` | Settings memberships and recovery of dismissed pending invitations. |
| `48545ba` | Members UI, centralized capabilities, roles and ownership safeguards. |
| `7532003` | Explicit SMTP invitation campaigns, resend and durable delivery tracking. |
| `26452ac` | Editable profile defaults and actual-state owner setup checklist. |
| `3ee7f37` | Security hardening, enabled-owner safeguards and regression tests. |
| `523fe94` | Complete local onboarding E2E and native PostgreSQL validation. |
| `522a219` | Chrome file upload and repeated-import validation. |
| `734e2f8` | Responsive/accessibility polish and profile-entry consistency. |
| `032c31e` | Integration audit and merge guide; documentation only. |

## Changed-file classification

Primary categories distinguish textual conflict risk from security importance: a new isolated authorization file still requires security review. Configuration files also require careful conflict resolution. Each of the 98 changed paths appears once below.

### 1. New isolated files (66)

| File | Change to preserve / review |
| --- | --- |
| `actions/club-onboarding.ts` (A) | Authenticated invitation discovery, claim, accept, dismiss and decline actions. |
| `actions/invitation-emails.ts` (A) | Explicit campaign/resend and bounded delivery server actions. |
| `actions/organization-members.ts` (A) | Server-authorized members, roles, removal, manual invitations and ownership operations. |
| `actions/organization-onboarding.ts` (A) | Load actual-state organization setup progress. |
| `actions/platform-organization-onboarding.ts` (A) | Superadmin organization and initial owner invitation creation. |
| `actions/roster-import.ts` (A) | Authorized preview/confirmation and additive audited import. |
| `app/api/internal/invitation-delivery/route.ts` (A) | Secret-protected optional outbox worker; per-delivery authority revalidation. |
| `app/settings/organizations/page.tsx` (A) | Secure memberships and all pending invitations, including dismissed ones. |
| `components/invitation-email-controls.tsx` (A) | Existing visual-system UI for invitation email controls. |
| `components/invitation-profile-suggestions.tsx` (A) | Existing visual-system UI for invitation profile suggestions. |
| `components/organization-invitation-card.tsx` (A) | Existing visual-system UI for organization invitation card. |
| `components/organization-member-management.tsx` (A) | Existing visual-system UI for organization member management. |
| `components/organization-memberships.tsx` (A) | Existing visual-system UI for organization memberships. |
| `components/organization-ownership-requests.tsx` (A) | Existing visual-system UI for organization ownership requests. |
| `components/organization-setup-checklist.tsx` (A) | Existing visual-system UI for organization setup checklist. |
| `components/platform-organization-onboarding.tsx` (A) | Existing visual-system UI for platform organization onboarding. |
| `components/roster-csv-importer.tsx` (A) | Existing visual-system UI for roster csv importer. |
| `docs/club-onboarding-database.md` (A) | Feature documentation: club onboarding database. |
| `docs/club-onboarding-merge-guide.md` (A) | Integration inventory, conflict preservation, environment names, validation and rollback guide; documentation only. |
| `docs/dashboard-organization-invitations.md` (A) | Feature documentation: dashboard organization invitations. |
| `docs/guided-organization-onboarding.md` (A) | Feature documentation: guided organization onboarding. |
| `docs/onboarding-end-to-end-validation.md` (A) | Feature documentation: onboarding end to end validation. |
| `docs/onboarding-security-review.md` (A) | Feature documentation: onboarding security review. |
| `docs/onboarding-ui-polish.md` (A) | Feature documentation: onboarding ui polish. |
| `docs/organization-invitation-emails.md` (A) | Feature documentation: organization invitation emails. |
| `docs/organization-member-management.md` (A) | Feature documentation: organization member management. |
| `docs/roster-csv-import.md` (A) | Feature documentation: roster csv import. |
| `docs/superadmin-organization-onboarding.md` (A) | Feature documentation: superadmin organization onboarding. |
| `lib/club-onboarding.ts` (A) | Shared club onboarding types, validation or presentation rules. |
| `lib/invitation-email.ts` (A) | Shared invitation email types, validation or presentation rules. |
| `lib/onboarding-presentation.ts` (A) | Shared onboarding presentation types, validation or presentation rules. |
| `lib/organization-authorization.ts` (A) | Shared organization authorization types, validation or presentation rules. |
| `lib/organization-claiming.ts` (A) | Shared organization claiming types, validation or presentation rules. |
| `lib/organization-onboarding.ts` (A) | Shared organization onboarding types, validation or presentation rules. |
| `lib/platform-organization-onboarding.ts` (A) | Shared platform organization onboarding types, validation or presentation rules. |
| `lib/roster-csv.ts` (A) | Shared roster csv types, validation or presentation rules. |
| `scripts/run-onboarding-e2e.cjs` (A) | Disposable local Supabase/Auth/MFA/SMTP/Next orchestration; intentional CLI progress output. |
| `tests/club-onboarding-database.test.cjs` (A) | Automated club onboarding database.test coverage/fixtures; no production seed data. |
| `tests/club-onboarding.test.cjs` (A) | Automated club onboarding.test coverage/fixtures; no production seed data. |
| `tests/dashboard-invitations.test.cjs` (A) | Automated dashboard invitations.test coverage/fixtures; no production seed data. |
| `tests/email-transport.test.cjs` (A) | Automated email transport.test coverage/fixtures; no production seed data. |
| `tests/guided-organization-onboarding.test.cjs` (A) | Automated guided organization onboarding.test coverage/fixtures; no production seed data. |
| `tests/helpers/onboarding-e2e.cjs` (A) | Automated onboarding e2e coverage/fixtures; no production seed data. |
| `tests/invitation-email-migration.test.cjs` (A) | Automated invitation email migration.test coverage/fixtures; no production seed data. |
| `tests/invitation-emails-ui.test.cjs` (A) | Automated invitation emails ui.test coverage/fixtures; no production seed data. |
| `tests/invitation-emails.test.cjs` (A) | Automated invitation emails.test coverage/fixtures; no production seed data. |
| `tests/onboarding-concurrency.test.cjs` (A) | Automated onboarding concurrency.test coverage/fixtures; no production seed data. |
| `tests/onboarding-e2e.test.cjs` (A) | Automated onboarding e2e.test coverage/fixtures; no production seed data. |
| `tests/onboarding-security.test.cjs` (A) | Automated onboarding security.test coverage/fixtures; no production seed data. |
| `tests/organization-claiming-database.test.cjs` (A) | Automated organization claiming database.test coverage/fixtures; no production seed data. |
| `tests/organization-claiming-ui.test.cjs` (A) | Automated organization claiming ui.test coverage/fixtures; no production seed data. |
| `tests/organization-members-database.test.cjs` (A) | Automated organization members database.test coverage/fixtures; no production seed data. |
| `tests/organization-members-ui.test.cjs` (A) | Automated organization members ui.test coverage/fixtures; no production seed data. |
| `tests/organization-members.test.cjs` (A) | Automated organization members.test coverage/fixtures; no production seed data. |
| `tests/platform-organization-onboarding-ui.test.cjs` (A) | Automated platform organization onboarding ui.test coverage/fixtures; no production seed data. |
| `tests/platform-organization-onboarding.test.cjs` (A) | Automated platform organization onboarding.test coverage/fixtures; no production seed data. |
| `tests/roster-csv.test.cjs` (A) | Automated roster csv.test coverage/fixtures; no production seed data. |
| `tests/roster-import-database.test.cjs` (A) | Automated roster import database.test coverage/fixtures; no production seed data. |
| `tests/roster-import-ui.test.cjs` (A) | Automated roster import ui.test coverage/fixtures; no production seed data. |
| `tests/roster-import.test.cjs` (A) | Automated roster import.test coverage/fixtures; no production seed data. |
| `utils/club-onboarding.ts` (A) | Atomic identity-bound invitation acceptance and shared state transitions. |
| `utils/email.ts` (A) | TLS SMTP transport, escaped templates and safe authentication links. |
| `utils/invitation-delivery.ts` (A) | Durable SMTP outbox, locks, cooldown/rate limits and uncertain outcomes. |
| `utils/profile-onboarding.ts` (A) | Profile completion and safe return navigation. |
| `utils/school-identity.ts` (A) | Server-derived verified identity normalization and matching. |
| `utils/verified-email-policy.ts` (A) | Provider verification evidence and auto-confirm fail-closed policy. |

### 2. Existing files with low conflict risk (6)

| File | Change to preserve / review |
| --- | --- |
| `docs/club-claiming.md` (M) | Feature documentation: club claiming. |
| `docs/student-onboarding.md` (M) | Feature documentation: student onboarding. |
| `tests/authorization.test.cjs` (M) | Automated authorization.test coverage/fixtures; no production seed data. |
| `tests/club-claims.test.cjs` (M) | Automated club claims.test coverage/fixtures; no production seed data. |
| `tests/meetings.test.cjs` (M) | Automated meetings.test coverage/fixtures; no production seed data. |
| `tests/workspace-search.test.cjs` (M) | Automated workspace search.test coverage/fixtures; no production seed data. |

### 3. Shared/core files with high conflict risk (20)

| File | Change to preserve / review |
| --- | --- |
| `actions/applications.ts` (M) | Active-membership filtering for organization meeting/application access. |
| `actions/club-access.ts` (M) | Legacy invitation compatibility, verified acceptance, soft removal, delegation and ownership guards. |
| `actions/interview-rooms.ts` (M) | Active, enabled interviewer eligibility. |
| `actions/meetings.ts` (M) | Active membership required for meeting access and attendance. |
| `actions/platform-admin.ts` (M) | Revoke identity-bound invitations alongside legacy email invitations. |
| `actions/tasks.ts` (M) | Active membership for task access, assignments and file downloads. |
| `actions/workspace-search.ts` (M) | Search scopes exclude inactive memberships. |
| `app/api/users/me/route.ts` (M) | Existing user payload includes only active memberships. |
| `app/invitations/[id]/page.tsx` (M) | Identity-bound and legacy invitation entry; verified identity and profile completion. |
| `components/app-shell.tsx` (M) | Authenticated dashboard organization requests. |
| `components/club-members.tsx` (M) | Real workspace uses organization member management; existing demo UI retained. |
| `components/club-workspace.tsx` (M) | Owner setup checklist within existing workspace. |
| `components/invitation-response.tsx` (M) | Shared owner-claim and invitation acceptance integration. |
| `components/platform-console.tsx` (M) | Organization creation embedded in existing internal console. |
| `components/shell/product-shell.tsx` (M) | Organizations settings navigation with existing leave-workspace guard. |
| `components/views/student-onboarding-wizard.tsx` (M) | Editable invitation defaults and account-created authentication state. |
| `lib/meetings.ts` (M) | Shared meeting visibility uses active membership. |
| `lib/permissions.ts` (M) | Central permissions deny inactive memberships. |
| `prisma/schema.prisma` (M) | Extend authoritative Club, ClubMember and ClubInvitation models; identity/import/delivery models. |
| `utils/auth.ts` (M) | Server organization authorization and verified-provider metadata in support sessions. |

### 4. Database migrations (3)

| File | Change to preserve / review |
| --- | --- |
| `prisma/migrations/20261001010000_club_onboarding/migration.sql` (A) | Ordered SQL schema/security migration; preserve SQL-only indexes, triggers and RLS. |
| `prisma/migrations/20261002000000_organization_invitation_emails/migration.sql` (A) | Ordered SQL schema/security migration; preserve SQL-only indexes, triggers and RLS. |
| `prisma/migrations/20261002010000_onboarding_security/migration.sql` (A) | Ordered SQL schema/security migration; preserve SQL-only indexes, triggers and RLS. |

### 5. Generated files (1)

| File | Change to preserve / review |
| --- | --- |
| `pnpm-lock.yaml` (M) | Generated dependency lock update for SMTP packages. |

### 6. Configuration changes (2)

| File | Change to preserve / review |
| --- | --- |
| `package.json` (M) | SMTP dependencies, types and isolated E2E script; existing commands retained. |
| `tsconfig.json` (M) | Include isolated publish-build Next types alongside existing build types. |

## Database changes and execution order

Use the existing **Prisma** migration history, including every prerequisite migration. The archived Supabase migration path is disabled; do not create/replay a parallel history or reset a deployed database. These three branch migrations execute in this order:

1. `prisma/migrations/20261001010000_club_onboarding/migration.sql`: extend existing `Club`, `ClubMember`, `ClubInvitation`; add `School`, `SchoolIdentifierType`, `SchoolIdentity`, `RosterImport`, `RosterImportRow` and `InvitationDelivery`; reuse existing `AuditLog` for events and `ClubInvitation.dismissedAt` for dashboard dismissal. Add identity normalization/claim provenance, invitation state/expiry/claim data, membership role/status/join data, import audits, composite scoping foreign keys, identity/import/row/delivery uniqueness, pending-identity invitation uniqueness, lifecycle/delegation/last-owner guards and restrictive browser RLS. Backfill existing records without creating placeholder users or discarding custom permissions. Existing membership uniqueness remains stronger than active-only uniqueness: one row per user/club across statuses.
2. `prisma/migrations/20261002000000_organization_invitation_emails/migration.sql`: first/last email timestamps and send count, delivery backfill, duplicate active queue cancellation, unique active QUEUED/SENDING delivery per invitation and sender/time indexing.
3. `prisma/migrations/20261002010000_onboarding_security/migration.sql`: lock and enabled-owner checks for membership changes and user suspension; restrictive RLS on `User`, `StudentProfile`, `Club` without removing existing policies.

The foundation also restricts browser access to identity/import/delivery/audit/state data and existing membership/invitation tables. Direct Supabase browser reads/writes must remain denied even when another permissive policy exists. Server Prisma access remains authoritative and must independently authorize every request. SQL triggers, partial indexes and restrictive policies are not fully expressed by the Prisma schema: retaining the schema alone is insufficient.

After resolving schema/manifest conflicts, install with the existing pnpm lockfile convention and regenerate the Prisma client (`npx prisma generate`). Validate migration history and pre-existing data before the eventual approved database deployment using the existing `npm run db:deploy` path. Do not run this against an unspecified environment. Rehearse the entire stack on a disposable database and upgrade from representative legacy data. New restrictive foreign keys intentionally retain invitation/import/audit relationships; permanent user/club deletion may require an explicit retention-aware procedure rather than cascading away audit history.

## High-risk conflict resolution requirements

- **Schema and migration history:** extend the existing Club models rather than introducing duplicate Organization tables. Preserve legacy title, groups, cohort, custom permissions and `isOwner` fields alongside `accessRole`/status. Preserve all foreign keys, identity normalization/uniqueness, state guards, queue uniqueness and ownership locks. Reconcile the target's prerequisite tutorial migration fix separately from these new migrations.
- **`lib/permissions.ts`, `utils/auth.ts`, `/api/users/me`:** inactive memberships never confer access. Role labels do not replace stored organization permissions. Preserve existing suspension, MFA, real-actor impersonation and demo rules. Do not substitute support-admin identity for the target user's verified identity. Keep the existing user API payload while filtering memberships to ACTIVE.
- **`actions/club-access.ts`:** preserve legacy email invitations and custom role management while validating strict inputs, verified recipient identity, delegation ceilings and last enabled owner under organization locks. Removal changes membership to LEFT and clears permissions; it must not delete history or allow stale invitations to restore access. OWNER flags and role data must remain consistent.
- **Tasks/applications/meetings/search/interview actions and `lib/meetings.ts`:** preserve ACTIVE checks for access, visibility, assignment/download eligibility and interviewer selection. Keep public recruiting behavior and historical records. A conflict resolution that restores removed members' access is a security regression.
- **`actions/platform-admin.ts`:** identity-bound pending invitations must be included when revoking grants; retain the other developer's platform administration behavior.
- **`components/app-shell.tsx`, `components/shell/product-shell.tsx`:** retain authenticated dashboard requests, organization settings navigation, existing demo separation, safe auth return routing and unsaved-work navigation guard.
- **Student wizard and invitation entry/response:** defaults fill only safe, blank, unedited profile fields; account-created state controls registration/password behavior. Incomplete profiles still pass through existing completion with a safe return path. Owner claim uses the same atomic server logic as Settings/dashboard. Never accept a browser-supplied computing ID as verification evidence.
- **Club members/workspace and platform console:** embed the new management/checklist/creation components in the current interfaces; retain existing demo, custom permissions, recruiting and console refresh behavior. Owner checklist uses actual system state and centrally derived capabilities.
- **Manifest/lockfile/TypeScript config:** retain Nodemailer and its types plus the isolated E2E command; regenerate the lockfile from the combined manifest rather than discarding the other branch's dependencies. Keep existing `.next`, `.next-dev` and `.next-publish` generated type includes.

New server modules must also stay connected: `lib/organization-authorization.ts` is the shared capability policy; `utils/school-identity.ts` and `utils/verified-email-policy.ts` derive identity from provider evidence; `utils/club-onboarding.ts` handles atomic acceptance; `actions/roster-import.ts` implements additive imports; `utils/invitation-delivery.ts` implements locked durable email delivery. Do not reproduce their business rules in frontend handlers.

## Required environment variable names

Existing database/auth/platform configuration (some names are existing alternative bindings):

- `DATABASE_URL`
- `POSTGRES_PRISMA_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OUTCLASS_PLATFORM_ADMIN_IDS`

Application SMTP configuration:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `OUTCLASS_SITE_URL`

Optional protected delivery worker:

- `CRON_SECRET`

Existing verification/development switch to review:

- `ALLOW_UNVERIFIED_SIGNUP`

Isolated validation tooling:

- `OUTCLASS_ONBOARDING_E2E_CONFIG`
- `OUTCLASS_SECURITY_TEST_DATABASE_URL`
- `OUTCLASS_PUBLISH_BUILD`
- `NODE_EXTRA_CA_CERTS`

Auth must actually verify university email and support existing superadmin MFA. The current authentication path remains UVA-focused although the data model supports additional schools. Auto-confirmed accounts, missing verification evidence and skip-verification metadata fail closed for identity claims; verify the integration environment's Auth configuration rather than weakening these checks. Initial president invitation creation does not automatically send email. Production SMTP credentials, scheduler installation and inbox delivery have not been verified by this branch.

## Testing checklist after integration

Run with Node 22 or newer and the regenerated Prisma client:

```bash
npm run db:check-path
npm run test:migrations
npm run lint
npm run typecheck
npm test
npm run build
npm run test:onboarding:e2e
```

The E2E runner requires Docker, Supabase CLI and OpenSSL. It creates and operates only its reserved disposable local Supabase project, enables verified signup/TOTP in its copied config, applies Prisma migrations and uses local captured SMTP. Do not point it at production or reset the normal development project. Native PostgreSQL concurrency tests require the explicit isolated test database binding; verify they actually execute rather than skip. PGlite migration tests alone do not prove native locking behavior.

- New president: real superadmin creates club and OWNER invitation; no User fabricated; verified signup, editable profile completion, identity matching, atomic claim and club dashboard access.
- Roster: drag/drop and picker, quoted/malformed/duplicate rows, size/row limits, Unicode/encoding checks, year validation, preview and explicit confirmation; correct audit counts and no fake users.
- Existing and new students: identity-bound requests appear; safe profile defaults; accept creates one active membership. Wrong identity, forged fields, expired/revoked/claimed invitations fail.
- Dismissal: Not now leaves PENDING, hides only dashboard, remains visible/acceptable/declinable in Settings. Multiple invitations and OWNER wording work.
- Incremental import: existing memberships untouched, existing invitations reused, new pending MEMBER invitations only; concurrent/replayed imports do not duplicate or grant elevated roles.
- Permissions: MEMBER cannot import, mutate roles, send or manage organization; admin cannot create/replace an owner or exceed delegation; suspended/removed users cannot access tasks/files/meetings/search/interviews. Cross-organization IDs and manually called server actions fail.
- Ownership: concurrent role/removal/suspension/transfer operations cannot eliminate the last enabled owner. Existing custom capabilities remain authoritative.
- Emails: import is email-free; explicit send queues once; batch/resend/cooldown/hourly limits, duplicate worker clicks, stale authority and revoked/accepted recipients; uncertain SMTP attempts remain SENDING without automatic retry. Verify real provider delivery separately only when deployment is authorized.
- Direct RLS: authenticated and anonymous Supabase clients cannot bypass server authorization or read another user's profile, identity, invitations, import/audit data. Test with actual browser database roles, not only privileged Prisma.
- Desktop/tablet/mobile: settings, request cards, members, CSV preview and checklist; no page overflow, table scrolling is usable, labels/focus/keyboard/errors/confirmation dialogs remain accessible. Existing demo, recruitment, support impersonation and legacy email invite routes still function.

Latest feature validation before this documentation audit: 392 tests passed with HTTP E2E and native concurrency enabled; full migration/legacy-upgrade validation passed with 27 protected tables; lint passed with 31 existing warnings; typecheck/build passed. Chrome upload/preview/import/replay and responsive checks passed. These are historical branch results, not evidence for the future combined branch. During this audit, `git diff --check` and `npm run db:check-path` passed; no runtime changes were made.

## Rollback and operational considerations

There is no existing onboarding feature flag. If integration fails, deploy an explicit temporary server-side denial of onboarding mutations and hide entry points, or revert the application changes in a reviewed release. UI hiding alone is insufficient. Stop explicit send actions and the optional worker together before investigating mail problems. Preserve established memberships and audit data.

Keep the additive database schema, restrictive RLS, ownership guards and ACTIVE membership checks during an application rollback. Older code without those checks can accidentally restore LEFT/suspended members' access. Do not blindly revert the entire commit range or drop tables/enums/columns containing accepted memberships, invitations or delivery history. There are no down migrations; schema removal would require a separately reviewed, backed-up forward migration after data reconciliation.

Take a backup before a later authorized migration deployment. Migrations each use transactions, but the whole stack is not one global transaction. Reconcile applied migration history/checksums; do not rename/reapply a deployed migration. Generated clients must match the deployed schema. Already sent emails cannot be recalled. For uncertain SENDING deliveries, inspect provider logs before any manual resolution/retry; SMTP and database commits cannot guarantee exactly-once delivery across failures.

Integration, production database changes, production scheduling and deployment remain pending authorization. This branch is prepared for the next integration step, not merged.
