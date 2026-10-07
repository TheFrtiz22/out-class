# Club suspension enforcement review

2026-10-06. Implemented for review; no commit/push, production/staging connection, or new schema/migration change in this follow-up. Earlier Prompt 53 changes remain uncommitted.

## Authorization and semantics

`Club.suspendedAt` remains the only suspension state. `requireClubPermission` still verifies the current enabled/verified account, active membership and requested capabilities, then rejects suspended-club operations. `requireClubMembership` inherits the rule. The shared `lib/club-suspension.ts` adds a Club row lock and live suspension check inside operational write transactions. That check is also used by paths with their own existing authorization: organization membership/invitation management, onboarding/acceptance, roster imports, task submissions/reviews, legacy and room-based interview booking, interview reviews, voting and attendance. Club mutations, application saves/submissions, recruitment settings/rules, applicant observations and event edits/uploads recheck state inside their transaction. Club locks serialize these operations against Admin suspension/restoration. The gate adds to resource ownership and capability checks; it never grants access.

Suspension does not demote leaders, deactivate members, change capabilities, rewrite decisions or delete applications, answers, rounds, evaluations, bookings, events, flyers or RSVPs. New applications and edits to drafts are blocked. Existing student applications remain readable by their owner. Historical pipeline and identity reads explicitly retain their existing membership/privacy/capability requirements while allowing a suspended-club read. Operational review/interview/voting surfaces pause. Ordinary previously authorized historical meeting/private attachment reads remain subject to their original access rules. Saved clubs and personal profile/preferences remain separate and usable.

The server workspace page returns an explicit suspended state only after finding an active membership in the verified effective user's record. The client also recognizes the state and keys cached resources by it. Other users receive no membership-derived private suspension view. An already open client can retain previously loaded content until navigation/identity refresh; live server mutations are nevertheless denied immediately.

`setAdminClubSuspended` retains verified enabled allowlisted identity, active PlatformAdmin grant, aal2, independent fresh Admin elevation, and the existing no-impersonation rule. Its transaction only updates the timestamp and appends `platform.club.suspension` with actual actor, reason and suspended boolean. It invalidates public club directory and relevant workspace/Corkboard paths. Restoration clears the timestamp; the preserved ordinary memberships and capabilities govern resumed access. No reconstruction is needed. Elevated Admin inspection/moderation remains available.

## Corkboard and invitations

Public board, detail, legacy public meeting readers and club filters exclude suspended clubs. Public event presentation still requires PUBLISHED, recruitment/public audience and the approved current revision. Uploaded flyer API reads include club state and recheck it after storage download; suspended public requests return 404. Suspended leader preview requires elevated Admin authority, including a post-download state recheck. Files remain in the existing private storage bucket. No publication status, approval revision or event field changes merely because a club is suspended. Existing database withdrawal triggers and self-review restrictions are unchanged. Restoration reveals only still-approved current publications; drafts, pending/rejected/cancelled and stale revisions remain unavailable.

RSVP writes hold a shared Club lock before the existing Event lock and capacity check, serializing with suspension without weakening transactional capacity enforcement. New/affirmed attendance is unavailable while suspended. Stored RSVPs remain unchanged by suspension/restoration; the existing owner cancellation flow stays available.

New invitation operations/acceptance check suspension. The existing delivery worker leaves queued invitations queued while paused. SMTP already claimed and in flight can complete; acceptance still checks live state. Existing invitation expiry is not extended by restoration.

## Notice copy

Admin Settings now says: “These settings are stored for platform administration. Notices are not currently displayed outside Admin or broadcast, emailed, or sent to users.” Existing campusNotice, maintenanceNotice and supportEmail validation/storage remain unchanged. No notice delivery or external rendering was added.

## Verification

- `node scripts/run-admin-local.cjs validate` ran the exact `npm run validate` with only the named disposable services: 697 tests, 691 passed, 6 opt-in integration tests skipped, 0 failed. All 27 migrations applied in fresh and legacy test databases; all 53 application tables passed restrictive RLS/browser CRUD checks. Lint (26 advisory warnings, 0 errors), typecheck and optimized production build passed.
- Focused Admin/club/Corkboard/applicant/server-boundary run: 120 tests, 119 passed, 1 opt-in Corkboard full-stack test skipped, 0 failed. The new suspension file has 9 passing tests covering actual shared authorization, direct action writes, transaction rechecks, legacy booking, application submissions/drafts, capabilities, restoration, Admin guards, publication revisions and notice/workspace state.
- `node scripts/run-admin-local.cjs integration`: 19 passed, 0 skipped/failed, against localhost-only Supabase project outclass-corkboard-e2e (API 56321, DB 56322, app 3109, disposable mail sink 55324/55325). It includes 18 suspension scenarios plus the existing real provider/password/MFA Admin flow. Database snapshots verify that memberships, applications/answers/evaluations/bookings, rounds, event publications/flyers and RSVPs are unchanged across both transitions; direct server actions verify blocked club/recruitment writes/new applications and authorized historical reads. The fixture club is restored in finally.
- Chrome UI verification: fresh password + MFA Admin elevation, active leader overview, actual Admin Suspend and Restore controls, explicit suspended leader and ordinary member workspace pages, restored leader overview and ordinary member overview with original privileges, and public Corkboard 9 → 0 → 9 events. Notice copy visibly verified. View-as was ended after each inspection, retaining actual/effective support attribution. The fixture club was left restored.
- `git diff --check` passed. No new failing release-review issue identified. Advisory lint warnings remain; already-rendered client content and already-in-flight SMTP have the limits described above.

Screenshots: `/tmp/suspension-leader-active.jpg`, `/tmp/suspension-leader-paused.jpg`, `/tmp/suspension-member-paused.jpg`, `/tmp/suspension-admin-restored.jpg`, `/tmp/suspension-leader-restored.jpg`, `/tmp/suspension-member-restored.jpg`, `/tmp/suspension-corkboard-before.jpg`, `/tmp/suspension-corkboard-paused.jpg`, `/tmp/suspension-corkboard-restored.jpg`, `/tmp/suspension-notice-copy.jpg`.
Logs: `/tmp/suspension-validation-final.log`, `/tmp/suspension-focused-final.log`, `/tmp/suspension-integration-final.log`.

## Exact files changed in this follow-up

This inventory includes edits to files already uncommitted from Prompt 53; it does not claim all current worktree changes were made by this fix. No prisma schema/migration file was edited in this follow-up.

- `actions/admin-workspace.ts`
- `actions/applicant-intelligence.ts`
- `actions/applications.ts`
- `actions/campus-events.ts`
- `actions/club-access.ts`
- `actions/club-directory.ts`
- `actions/club-onboarding.ts`
- `actions/club-settings.ts`
- `actions/club-workspace.ts`
- `actions/crm.ts`
- `actions/event-flyers.ts`
- `actions/interview-access-setup.ts`
- `actions/interview-rooms.ts`
- `actions/invitation-emails.ts`
- `actions/meetings.ts`
- `actions/organization-members.ts`
- `actions/recruiting-rules.ts`
- `actions/roster-import.ts`
- `actions/scheduling.ts`
- `actions/tasks.ts`
- `actions/voting.ts`
- `app/api/event-flyers/route.ts`
- `app/club/[clubId]/workspace/page.tsx`
- `components/admin/admin-settings.tsx`
- `components/club-workspace.tsx`
- `lib/campus-events.ts`
- `lib/club-suspension.ts` — new in this follow-up
- `utils/auth.ts`
- `utils/club-onboarding.ts`
- `utils/interview-access.ts`
- `utils/invitation-delivery.ts`
- `tests/admin-workspace.test.cjs`
- `tests/admin-workspace-e2e.test.cjs`
- `tests/authorization.test.cjs`
- `tests/club-marketing.test.cjs`
- `tests/club-suspension.test.cjs` — new in this follow-up
- `tests/integration-audit.test.cjs`
- `tests/meetings.test.cjs`
- `tests/organization-members-database.test.cjs`
- `tests/organization-members.test.cjs`
- `tests/performance-regressions.test.cjs`
- `tests/recruiting-rules.test.cjs`
- `tests/server-boundaries.test.cjs`
- `tests/support-tutorials.test.cjs`
- `docs/admin-workspace.md`
- `docs/club-suspension-review.md` — new in this follow-up

## Git status at completion

No files are staged. The worktree retains the earlier uncommitted Prompt 53 work plus this follow-up. No commit or push was performed.

```text
## main...origin/main [behind 4]
 M actions/applicant-intelligence.ts
 M actions/applications.ts
 M actions/campus-events.ts
 M actions/club-access.ts
 M actions/club-directory.ts
 M actions/club-onboarding.ts
 M actions/club-settings.ts
 M actions/club-workspace.ts
 M actions/crm.ts
 M actions/event-flyers.ts
 M actions/interview-access-setup.ts
 M actions/interview-rooms.ts
 M actions/invitation-emails.ts
 M actions/meetings.ts
 M actions/organization-members.ts
 M actions/platform-admin.ts
 M actions/recruiting-rules.ts
 M actions/roster-import.ts
 M actions/scheduling.ts
 M actions/tasks.ts
 M actions/voting.ts
 M app/api/event-flyers/route.ts
 M app/api/platform/view-as/route.ts
 M app/club/[clubId]/workspace/page.tsx
 M app/platform/claims/page.tsx
 M app/platform/login/page.tsx
 M app/platform/page.tsx
 M components/club-workspace-switcher.tsx
 M components/club-workspace.tsx
 M components/platform-console.tsx
 M components/platform-view-banner.tsx
 M components/shell/product-shell.tsx
 M lib/campus-events.ts
 M lib/platform-console.ts
 M prisma/schema.prisma
 M tests/authorization.test.cjs
 M tests/club-marketing.test.cjs
 M tests/integration-audit.test.cjs
 M tests/meetings.test.cjs
 M tests/organization-members-database.test.cjs
 M tests/organization-members.test.cjs
 M tests/performance-regressions.test.cjs
 M tests/platform-admin.test.cjs
 M tests/platform-organization-onboarding.test.cjs
 M tests/recruiting-rules.test.cjs
 M tests/server-boundaries.test.cjs
 M tests/support-tutorials.test.cjs
 M utils/auth.ts
 M utils/club-onboarding.ts
 M utils/email.ts
 M utils/interview-access.ts
 M utils/invitation-delivery.ts
 M utils/platform-admin.ts
?? actions/admin-workspace.ts
?? app/api/auth/logout/
?? app/api/auth/student-claim/
?? app/api/platform/elevation/
?? app/api/platform/eligibility/
?? app/auth/student-claim/
?? app/platform/[section]/
?? app/platform/layout.tsx
?? components/admin/
?? docs/admin-workspace.md
?? docs/club-suspension-review.md
?? lib/admin-elevation.ts
?? lib/admin-navigation.ts
?? lib/club-suspension.ts
?? lib/request-origin.ts
?? prisma/migrations/20261006010000_admin_workspace/
?? scripts/run-admin-local.cjs
?? tests/admin-elevation.test.cjs
?? tests/admin-workspace-e2e.test.cjs
?? tests/admin-workspace.test.cjs
?? tests/club-suspension.test.cjs
?? utils/admin-elevation.ts
```
